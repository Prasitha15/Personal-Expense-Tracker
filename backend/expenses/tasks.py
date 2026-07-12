import re
import logging
from decimal import Decimal
from celery import shared_task
from django.conf import settings
from django.apps import apps
from PIL import Image
import pytesseract  # noqa  # pyright: ignore[reportMissingImports]

logger = logging.getLogger(__name__)

@shared_task
def process_receipt_ocr(expense_id):

    # Configure tesseract executable path if set
    tesseract_cmd = getattr(settings, 'TESSERACT_CMD', 'tesseract')
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    Expense = apps.get_model('expenses', 'Expense')
    try:
        expense = Expense.objects.get(id=expense_id)
    except Expense.DoesNotExist:
        logger.error(f"Expense with id {expense_id} does not exist.")
        return False

    if not expense.receipt_image:
        logger.warning(f"Expense {expense_id} does not have a receipt image.")
        expense.ocr_status = 'none'
        expense.save()
        return False

    try:
        expense.ocr_status = 'pending'
        expense.save()

        # Open image using Pillow
        img = Image.open(expense.receipt_image.path)
        
        # Perform OCR
        text = pytesseract.image_to_string(img)
        expense.ocr_text = text
        expense.ocr_status = 'completed'

        # Optional simple heuristics to parse amount if amount is 0.00
        # Look for patterns like "Total: $12.34" or "TOTAL 12.34"
        if expense.amount == Decimal('0'):
            lines = text.split('\n')
            total_patterns = [
                re.compile(r'total[\s\:\$]+(\d+[\.\,]\d{2})', re.IGNORECASE),
                re.compile(r'amount[\s\:\$]+(\d+[\.\,]\d{2})', re.IGNORECASE),
                re.compile(r'sum[\s\:\$]+(\d+[\.\,]\d{2})', re.IGNORECASE)
            ]
            found_amount = None
            for line in lines:
                for pat in total_patterns:
                    match = pat.search(line)
                    if match:
                        try:
                            val = float(match.group(1).replace(',', '.'))
                            found_amount = val
                            break
                        except ValueError:
                            pass
                if found_amount:
                    break
            
            if found_amount:
                expense.amount = Decimal(str(found_amount))
                logger.info(f"Auto-extracted amount {found_amount} for expense {expense_id}")

        expense.save()
        
        # Check budget limits after updating the expense amount
        # Import dynamically to avoid circular dependencies
        try:
            from django.db.models import Q
            from budgets.models import Budget
            from notifications.models import Notification
            
            # Check budgets for this user and category (or overall) in the month of the expense
            budgets = Budget.objects.filter(
                user=expense.user, 
                start_date__lte=expense.date,
                end_date__gte=expense.date
            ).filter(Q(category=expense.category) | Q(category__isnull=True))
            for budget in budgets:
                total_spent = budget.get_total_spent()
                if total_spent > budget.limit:
                    if budget.category:
                        msg = f"Budget alert! You have exceeded your budget limit of {budget.limit} for '{budget.category.name}' in current period. Total spent: {total_spent}."
                    else:
                        msg = f"Budget alert! You have exceeded your overall monthly budget limit of {budget.limit} in current period. Total spent: {total_spent}."
                    Notification.objects.create(
                        user=expense.user,
                        message=msg
                    )
        except Exception as e:
            logger.error(f"Error checking budget alerts during OCR task: {e}")

        return True

    except Exception as e:
        logger.error(f"OCR failed for expense {expense_id}: {e}")
        expense.ocr_status = 'failed'
        expense.ocr_text = f"Error details: {str(e)}"
        expense.save()
        return False
