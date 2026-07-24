"""
notifications/tasks.py
─────────────────────────────────────────────────────────────────────
Celery tasks for the notification system:

  check_budget_alerts(user_id)      — per-user budget threshold check
  send_weekly_summary_all()         — fan-out to all active users (Monday 08:00)
  send_weekly_summary(user_id)      — weekly expense digest for one user
  send_monthly_summary_all()        — fan-out (1st of month 09:00)
  send_monthly_summary(user_id)     — monthly expense recap for one user

Schedule is defined in settings.py → CELERY_BEAT_SCHEDULE.
"""
import logging
from decimal import Decimal
from datetime import date, timedelta

from celery import shared_task
from django.apps import apps
from django.conf import settings
from django.core.mail import send_mail, EmailMultiAlternatives
from django.utils import timezone

logger = logging.getLogger(__name__)

# ── helpers ───────────────────────────────────────────────────────────────────

def _get_user(user_id):
    User = apps.get_model(settings.AUTH_USER_MODEL)
    try:
        return User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return None


def _create_notification(user, notification_type, title, message):
    """Create an in-app Notification record."""
    Notification = apps.get_model('notifications', 'Notification')
    return Notification.objects.create(
        user=user,
        notification_type=notification_type,
        title=title,
        message=message,
    )


def _send_email(user, subject, text_body, html_body=None):
    """
    Send an email to the user using Django's mail backend.
    Silently logs failures so notification tasks never crash.
    Returns True on success, False on failure.
    """
    if not user.email:
        logger.debug(f"User {user.username} has no email; skipping email send.")
        return False
    try:
        if html_body:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
            )
            msg.attach_alternative(html_body, 'text/html')
            msg.send(fail_silently=False)
        else:
            send_mail(
                subject=subject,
                message=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
        return True
    except Exception as exc:
        logger.error(f"Failed to send email to {user.email}: {exc}")
        return False


def _currency_sym(user):
    """Return a currency symbol based on user.currency code."""
    return {'EUR': '€', 'GBP': '£', 'INR': '₹'}.get(getattr(user, 'currency', 'USD'), '$')


# ── Budget Alert ──────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def check_budget_alerts(self, user_id):
    """
    Check all active budgets for *user_id*.
    Creates notifications (and emails) at:
      • 75% threshold  — warning
      • 100% threshold — exceeded
    Avoids duplicate alerts within the same budget period.
    """
    from django.db.models import Q
    Budget       = apps.get_model('budgets',       'Budget')
    Notification = apps.get_model('notifications', 'Notification')
    Expense      = apps.get_model('expenses',      'Expense')

    user = _get_user(user_id)
    if not user:
        return

    today   = date.today()
    sym     = _currency_sym(user)
    budgets = Budget.objects.filter(
        user=user,
        start_date__lte=today,
        end_date__gte=today,
    )

    for budget in budgets:
        total_spent = budget.get_total_spent()
        limit       = float(budget.limit)
        pct         = (float(total_spent) / limit * 100) if limit > 0 else 0
        cat_name    = budget.category.name if budget.category else "Overall"

        # ── 100% exceeded ────────────────────────────────────────────────
        if pct >= 100:
            alert_key = f"budget_exceeded_{budget.id}_{budget.start_date}"
            already   = Notification.objects.filter(
                user=user,
                notification_type='budget_alert',
                message__contains=alert_key,
            ).exists()
            if not already:
                title   = f"🚨 Budget Exceeded: {cat_name}"
                message = (
                    f"[{alert_key}] "
                    f"You have exceeded your {cat_name} budget for "
                    f"{budget.start_date.strftime('%b %Y')}. "
                    f"Spent: {sym}{total_spent:,.2f} / Limit: {sym}{limit:,.2f} "
                    f"({pct:.1f}%)."
                )
                notif = _create_notification(user, 'budget_alert', title, message)

                html = _budget_alert_html(user, cat_name, total_spent, limit, pct, sym, 'exceeded')
                sent = _send_email(
                    user,
                    subject=f"⚠️ Budget Exceeded — {cat_name} | ExpenseTracker",
                    text_body=f"Your {cat_name} budget has been exceeded ({pct:.1f}%). Spent: {sym}{total_spent:,.2f} of {sym}{limit:,.2f}.",
                    html_body=html,
                )
                if sent:
                    notif.email_sent = True
                    notif.save(update_fields=['email_sent'])

        # ── 75% warning ──────────────────────────────────────────────────
        elif pct >= 75:
            alert_key = f"budget_warning75_{budget.id}_{budget.start_date}"
            already   = Notification.objects.filter(
                user=user,
                notification_type='budget_alert',
                message__contains=alert_key,
            ).exists()
            if not already:
                title   = f"⚠️ Budget Warning: {cat_name} at {pct:.0f}%"
                message = (
                    f"[{alert_key}] "
                    f"Your {cat_name} budget is {pct:.1f}% used for "
                    f"{budget.start_date.strftime('%b %Y')}. "
                    f"Spent: {sym}{total_spent:,.2f} / Limit: {sym}{limit:,.2f}."
                )
                notif = _create_notification(user, 'budget_alert', title, message)

                html = _budget_alert_html(user, cat_name, total_spent, limit, pct, sym, 'warning')
                sent = _send_email(
                    user,
                    subject=f"Budget Warning — {cat_name} at {pct:.0f}% | ExpenseTracker",
                    text_body=f"Your {cat_name} budget is {pct:.1f}% used. Spent: {sym}{total_spent:,.2f} of {sym}{limit:,.2f}.",
                    html_body=html,
                )
                if sent:
                    notif.email_sent = True
                    notif.save(update_fields=['email_sent'])


# ── Weekly Summary ────────────────────────────────────────────────────────────

@shared_task
def send_weekly_summary_all():
    """Fan-out weekly summary to all users who have at least one expense."""
    User    = apps.get_model(settings.AUTH_USER_MODEL)
    Expense = apps.get_model('expenses', 'Expense')
    user_ids = Expense.objects.values_list('user_id', flat=True).distinct()
    for uid in user_ids:
        send_weekly_summary.delay(uid)


@shared_task(bind=True, max_retries=2, default_retry_delay=120)
def send_weekly_summary(self, user_id):
    """Build and send the weekly expense digest for one user."""
    from django.db.models import Sum
    Expense = apps.get_model('expenses', 'Expense')

    user = _get_user(user_id)
    if not user:
        return

    today     = date.today()
    week_start = today - timedelta(days=7)
    sym        = _currency_sym(user)

    expenses = Expense.objects.filter(
        user=user,
        date__gte=week_start,
        date__lt=today,
    )
    total = float(expenses.aggregate(t=Sum('amount'))['t'] or 0)
    count = expenses.count()

    if count == 0:
        logger.info(f"No expenses this week for user {user.username}; skipping weekly summary.")
        return

    # Top category
    top_cat = (
        expenses
        .values('category__name')
        .annotate(cat_total=Sum('amount'))
        .order_by('-cat_total')
        .first()
    )
    top_cat_name  = top_cat['category__name'] or 'Uncategorized' if top_cat else '—'
    top_cat_total = float(top_cat['cat_total']) if top_cat else 0

    # Daily average
    daily_avg = total / 7

    title   = f"📅 Weekly Summary — {week_start.strftime('%b %d')} to {today.strftime('%b %d, %Y')}"
    message = (
        f"Your spending summary for the past week:\n"
        f"• Total spent:       {sym}{total:,.2f} across {count} transaction(s)\n"
        f"• Daily average:     {sym}{daily_avg:,.2f}\n"
        f"• Top category:      {top_cat_name} ({sym}{top_cat_total:,.2f})\n"
        f"• Period:            {week_start} → {today}"
    )

    notif = _create_notification(user, 'weekly_summary', title, message)
    html  = _weekly_summary_html(user, total, count, daily_avg, top_cat_name, top_cat_total, week_start, today, sym)
    sent  = _send_email(
        user,
        subject=f"📅 Your Weekly Expense Report | ExpenseTracker",
        text_body=message,
        html_body=html,
    )
    if sent:
        notif.email_sent = True
        notif.save(update_fields=['email_sent'])


# ── Monthly Summary ───────────────────────────────────────────────────────────

@shared_task
def send_monthly_summary_all():
    """Fan-out monthly summary to all users."""
    User    = apps.get_model(settings.AUTH_USER_MODEL)
    Expense = apps.get_model('expenses', 'Expense')
    user_ids = Expense.objects.values_list('user_id', flat=True).distinct()
    for uid in user_ids:
        send_monthly_summary.delay(uid)


@shared_task(bind=True, max_retries=2, default_retry_delay=120)
def send_monthly_summary(self, user_id):
    """Build and send the monthly expense recap for one user."""
    from django.db.models import Sum
    Budget  = apps.get_model('budgets',   'Budget')
    Expense = apps.get_model('expenses',  'Expense')
    Income  = apps.get_model('incomes',   'Income')

    user = _get_user(user_id)
    if not user:
        return

    today      = date.today()
    # Previous month
    first_this = today.replace(day=1)
    last_prev  = first_this - timedelta(days=1)
    first_prev = last_prev.replace(day=1)
    month_name = first_prev.strftime('%B %Y')
    sym        = _currency_sym(user)

    expenses = Expense.objects.filter(user=user, date__gte=first_prev, date__lte=last_prev)
    incomes  = Income.objects.filter(user=user, date__gte=first_prev, date__lte=last_prev)

    total_exp = float(expenses.aggregate(t=Sum('amount'))['t'] or 0)
    total_inc = float(incomes.aggregate(t=Sum('amount'))['t'] or 0)
    net       = total_inc - total_exp
    exp_count = expenses.count()

    if exp_count == 0:
        logger.info(f"No expenses in {month_name} for user {user.username}; skipping.")
        return

    # Category breakdown
    cat_breakdown = list(
        expenses.values('category__name')
        .annotate(cat_total=Sum('amount'))
        .order_by('-cat_total')[:5]
    )

    # Budget performance
    budgets = Budget.objects.filter(user=user, start_date__gte=first_prev, end_date__lte=last_prev)
    budget_lines = []
    for b in budgets:
        spent = float(b.get_total_spent())
        limit = float(b.limit)
        pct   = (spent / limit * 100) if limit > 0 else 0
        cat   = b.category.name if b.category else 'Overall'
        budget_lines.append({'name': cat, 'spent': spent, 'limit': limit, 'pct': pct})

    title   = f"📆 Monthly Summary — {month_name}"
    cat_lines = "\n".join(
        f"  • {(c['category__name'] or 'Uncategorized'):20s}  {sym}{float(c['cat_total']):>10,.2f}"
        for c in cat_breakdown
    )
    budget_text = "\n".join(
        f"  • {b['name']:20s}  {sym}{b['spent']:>8,.2f} / {sym}{b['limit']:>8,.2f}  ({b['pct']:.0f}%)"
        for b in budget_lines
    ) or "  No budgets configured."

    message = (
        f"Your expense report for {month_name}:\n\n"
        f"💰 Total Income:   {sym}{total_inc:,.2f}\n"
        f"💸 Total Expenses: {sym}{total_exp:,.2f} ({exp_count} transactions)\n"
        f"📊 Net Savings:    {sym}{net:,.2f}\n\n"
        f"Top Categories:\n{cat_lines}\n\n"
        f"Budget Performance:\n{budget_text}"
    )

    notif = _create_notification(user, 'monthly_summary', title, message)
    html  = _monthly_summary_html(
        user, month_name, total_exp, total_inc, net,
        exp_count, cat_breakdown, budget_lines, sym
    )
    sent = _send_email(
        user,
        subject=f"📆 Monthly Expense Report — {month_name} | ExpenseTracker",
        text_body=message,
        html_body=html,
    )
    if sent:
        notif.email_sent = True
        notif.save(update_fields=['email_sent'])


# ── Email HTML builders ───────────────────────────────────────────────────────

def _email_base(title, accent, body_html):
    """Minimal but polished HTML email wrapper."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0b0f19; margin: 0; padding: 0; color: #f3f4f6; }}
    .wrapper {{ max-width: 600px; margin: 0 auto; background: #131a26; border-radius: 16px; overflow: hidden; }}
    .header {{ background: linear-gradient(135deg, {accent} 0%, #1a1a2e 100%); padding: 32px 36px; }}
    .header h1 {{ margin: 0; font-size: 22px; color: #fff; }}
    .header p  {{ margin: 6px 0 0; color: rgba(255,255,255,0.7); font-size: 13px; }}
    .body {{ padding: 28px 36px; }}
    .stat-row {{ display: flex; gap: 12px; margin-bottom: 20px; }}
    .stat-card {{ flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
                  border-radius: 10px; padding: 14px; text-align: center; }}
    .stat-val  {{ font-size: 22px; font-weight: 800; color: {accent}; }}
    .stat-lbl  {{ font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: .06em; margin-top: 4px; }}
    table.data {{ width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }}
    table.data th {{ background: rgba(255,255,255,0.06); color: #9ca3af; font-size: 11px;
                     text-transform: uppercase; letter-spacing: .06em; padding: 8px 10px; text-align: left; }}
    table.data td {{ padding: 9px 10px; border-top: 1px solid rgba(255,255,255,0.06); color: #f3f4f6; }}
    .progress-wrap {{ background: rgba(255,255,255,0.08); border-radius: 999px; height: 6px; margin-top: 4px; }}
    .progress-bar  {{ height: 6px; border-radius: 999px; }}
    .footer {{ padding: 18px 36px; background: #0b0f19; font-size: 11px; color: #6b7280; text-align: center; }}
    .badge {{ display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px;
              font-weight: 700; }}
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>💸 ExpenseTracker</h1>
    <p>{title}</p>
  </div>
  <div class="body">
    {body_html}
  </div>
  <div class="footer">
    You are receiving this because you have an ExpenseTracker account.<br/>
    &copy; {__import__('datetime').date.today().year} ExpenseTracker
  </div>
</div>
</body>
</html>"""


def _budget_alert_html(user, cat_name, spent, limit, pct, sym, alert_type):
    bar_color = '#ef4444' if alert_type == 'exceeded' else '#f59e0b'
    bar_pct   = min(pct, 100)
    badge_html = (
        f'<span class="badge" style="background:#ef444420;color:#ef4444;border:1px solid #ef444440;">🚨 EXCEEDED</span>'
        if alert_type == 'exceeded' else
        f'<span class="badge" style="background:#f59e0b20;color:#f59e0b;border:1px solid #f59e0b40;">⚠️ WARNING</span>'
    )
    body = f"""
    <p style="color:#9ca3af;margin-bottom:20px;">Hi {user.username},</p>
    {badge_html}
    <h2 style="font-size:18px;margin:12px 0 4px;">{cat_name} Budget</h2>
    <div class="stat-row" style="margin-top:16px;">
      <div class="stat-card">
        <div class="stat-val" style="color:{bar_color};">{sym}{spent:,.2f}</div>
        <div class="stat-lbl">Spent</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">{sym}{limit:,.2f}</div>
        <div class="stat-lbl">Budget Limit</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:{bar_color};">{pct:.1f}%</div>
        <div class="stat-lbl">Used</div>
      </div>
    </div>
    <div class="progress-wrap">
      <div class="progress-bar" style="width:{bar_pct}%;background:{bar_color};"></div>
    </div>
    <p style="margin-top:20px;color:#9ca3af;font-size:13px;">
      Log in to ExpenseTracker to review your spending and adjust your budget.
    </p>
    """
    return _email_base(f"Budget Alert — {cat_name}", bar_color, body)


def _weekly_summary_html(user, total, count, daily_avg, top_cat, top_cat_total, week_start, today, sym):
    body = f"""
    <p style="color:#9ca3af;margin-bottom:20px;">Hi {user.username}, here's your weekly spending digest.</p>
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-val">{sym}{total:,.2f}</div>
        <div class="stat-lbl">Total Spent</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">{count}</div>
        <div class="stat-lbl">Transactions</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">{sym}{daily_avg:,.2f}</div>
        <div class="stat-lbl">Daily Avg</div>
      </div>
    </div>
    <table class="data">
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Period</td><td>{week_start.strftime('%b %d')} – {today.strftime('%b %d, %Y')}</td></tr>
      <tr><td>Top Category</td><td>{top_cat} &nbsp;<strong>{sym}{top_cat_total:,.2f}</strong></td></tr>
    </table>
    <p style="margin-top:20px;color:#9ca3af;font-size:13px;">
      Log in to ExpenseTracker for detailed analytics and charts.
    </p>
    """
    return _email_base("Weekly Expense Summary", "#6366f1", body)


def _monthly_summary_html(user, month_name, total_exp, total_inc, net, exp_count, cat_breakdown, budget_lines, sym):
    net_color = '#10b981' if net >= 0 else '#ef4444'
    cat_rows  = "".join(
        f"<tr><td>{c['category__name'] or 'Uncategorized'}</td><td><strong>{sym}{float(c['cat_total']):,.2f}</strong></td></tr>"
        for c in cat_breakdown
    ) or "<tr><td colspan='2' style='color:#9ca3af'>No data</td></tr>"

    bud_rows = ""
    for b in budget_lines:
        bar_pct   = min(b['pct'], 100)
        bar_color = '#ef4444' if b['pct'] >= 100 else ('#f59e0b' if b['pct'] >= 75 else '#10b981')
        bud_rows += f"""
        <tr>
          <td>{b['name']}</td>
          <td>{sym}{b['spent']:,.2f} / {sym}{b['limit']:,.2f}
            <div class="progress-wrap">
              <div class="progress-bar" style="width:{bar_pct}%;background:{bar_color};"></div>
            </div>
          </td>
          <td style="color:{bar_color};font-weight:700;">{b['pct']:.0f}%</td>
        </tr>"""
    if not bud_rows:
        bud_rows = "<tr><td colspan='3' style='color:#9ca3af'>No budgets configured</td></tr>"

    body = f"""
    <p style="color:#9ca3af;margin-bottom:20px;">Hi {user.username}, here's your monthly financial recap for <strong style="color:#fff">{month_name}</strong>.</p>
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-val" style="color:#10b981;">{sym}{total_inc:,.2f}</div>
        <div class="stat-lbl">Income</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:#ef4444;">{sym}{total_exp:,.2f}</div>
        <div class="stat-lbl">Expenses</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color:{net_color};">{sym}{net:,.2f}</div>
        <div class="stat-lbl">Net Savings</div>
      </div>
    </div>
    <h3 style="font-size:14px;color:#9ca3af;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.06em;">Top Categories</h3>
    <table class="data"><tr><th>Category</th><th>Total</th></tr>{cat_rows}</table>
    <h3 style="font-size:14px;color:#9ca3af;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.06em;">Budget Performance</h3>
    <table class="data"><tr><th>Budget</th><th>Spent / Limit</th><th>%</th></tr>{bud_rows}</table>
    <p style="margin-top:20px;color:#9ca3af;font-size:13px;">
      Log in to ExpenseTracker to explore full analytics and plan next month.
    </p>
    """
    return _email_base(f"Monthly Summary — {month_name}", "#6366f1", body)
