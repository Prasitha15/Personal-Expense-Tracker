import datetime
from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from .models import Expense
from .serializers import ExpenseSerializer
from .filters import ExpenseFilter
from .tasks import process_receipt_ocr

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    filterset_class = ExpenseFilter
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['title', 'description', 'category__name', 'payment_method']
    ordering_fields = ['date', 'amount', 'created_at']
    ordering = ['-date']

    def get_queryset(self):
        # Strictly return expenses of the authenticated user
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Set user as current user
        has_image = 'receipt_image' in self.request.FILES
        ocr_status = 'pending' if has_image else 'none'
        expense = serializer.save(user=self.request.user, ocr_status=ocr_status)
        
        # Trigger OCR task if receipt image is present
        if has_image:
            process_receipt_ocr.delay(expense.id)

    def perform_update(self, serializer):
        expense = self.get_object()
        old_image = expense.receipt_image
        new_expense = serializer.save()
        
        # If receipt image is added or changed, run OCR
        if new_expense.receipt_image and new_expense.receipt_image != old_image:
            new_expense.ocr_status = 'pending'
            new_expense.save()
            process_receipt_ocr.delay(new_expense.id)

    @action(detail=False, methods=['get'], url_path='export-excel')
    def export_excel(self, request):
        expenses = self.filter_queryset(self.get_queryset())
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Expenses Summary"
        
        # Header formatting
        header_font = Font(name='Arial', size=11, bold=True, color='FFFFFF')
        header_fill = PatternFill(start_color='1F4E78', end_color='1F4E78', fill_type='solid')
        header_alignment = Alignment(horizontal='center', vertical='center')
        
        headers = ["Date", "Title", "Category", "Payment Method", "Amount", "Description", "Notes", "OCR Text Extraction"]
        ws.append(headers)
        
        # Style headers
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment

        # Set column widths
        ws.column_dimensions['A'].width = 12
        ws.column_dimensions['B'].width = 25
        ws.column_dimensions['C'].width = 18
        ws.column_dimensions['D'].width = 18
        ws.column_dimensions['E'].width = 12
        ws.column_dimensions['F'].width = 30
        ws.column_dimensions['G'].width = 30
        ws.column_dimensions['H'].width = 40

        total_sum = 0
        for exp in expenses:
            ws.append([
                exp.date.strftime("%Y-%m-%d") if exp.date else "",
                exp.title,
                exp.category.name if exp.category else "Uncategorized",
                exp.get_payment_method_display(),
                float(exp.amount),
                exp.description or "",
                exp.notes or "",
                exp.ocr_text or ""
            ])
            total_sum += exp.amount

        # Add total row
        row_count = ws.max_row
        ws.cell(row=row_count + 2, column=4, value="Total Summary:").font = Font(bold=True)
        total_cell = ws.cell(row=row_count + 2, column=5, value=float(total_sum))
        total_cell.font = Font(bold=True)
        total_cell.number_format = '$#,##0.00'

        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="expenses_{datetime.date.today()}.xlsx"'
        wb.save(response)
        return response

    @action(detail=False, methods=['get'], url_path='export-pdf')
    def export_pdf(self, request):
        expenses = self.filter_queryset(self.get_queryset())
        
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="expenses_{datetime.date.today()}.pdf"'
        
        doc = SimpleDocTemplate(response, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        elements = []
        
        # PDF Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=20,
            textColor=colors.HexColor('#1F4E78'),
            alignment=1, # Center
            spaceAfter=20
        )
        meta_style = ParagraphStyle(
            'MetaStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            textColor=colors.HexColor('#555555'),
            spaceAfter=15
        )
        
        # Title and Header
        elements.append(Paragraph("Personal Expense Report", title_style))
        elements.append(Paragraph(f"Generated on: {datetime.date.today().strftime('%B %d, %Y')} | Total records: {expenses.count()}", meta_style))
        elements.append(Spacer(1, 10))
        
        # Table data
        data = [["Date", "Title", "Category", "Method", "Amount"]]
        total_sum = 0
        for exp in expenses:
            data.append([
                exp.date.strftime("%Y-%m-%d"),
                Paragraph(exp.title or "", styles['Normal']),
                exp.category.name if exp.category else "Uncategorized",
                exp.get_payment_method_display(),
                f"${exp.amount:,.2f}"
            ])
            total_sum += exp.amount
            
        data.append(["", "", "", "Total Amount:", f"${total_sum:,.2f}"])
        
        t = Table(data, colWidths=[70, 150, 100, 100, 80])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1F4E78')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 10),
            ('BOTTOMPADDING', (0,0), (-1,0), 8),
            ('TOPPADDING', (0,0), (-1,0), 8),
            ('BACKGROUND', (0,1), (-1,-2), colors.HexColor('#F2F2F2')),
            ('GRID', (0,0), (-1,-2), 0.5, colors.HexColor('#CCCCCC')),
            ('LINEABOVE', (0,-1), (-1,-1), 1.5, colors.HexColor('#1F4E78')),
            ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
            ('TOPPADDING', (0,-1), (-1,-1), 8),
        ]))
        
        elements.append(t)
        doc.build(elements)
        return response
