import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6'];

const CustomTooltip = ({ active, payload, label, formatVal }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '10px',
      padding: '10px 14px',
      boxShadow: 'var(--shadow-md)',
    }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ fontSize: '0.85rem', fontWeight: 700, color: entry.color || 'var(--text-primary)' }}>
          {formatVal(entry.value)}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);

  const formatVal = (val) => {
    const symbol = user?.currency === 'EUR' ? '€' : user?.currency === 'GBP' ? '£' : user?.currency === 'INR' ? '₹' : '$';
    return `${symbol}${parseFloat(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [summaryRes, catRes, monthRes, weekRes] = await Promise.all([
        api.get('/api/analytics/dashboard-summary/'),
        api.get('/api/analytics/category-breakdown/'),
        api.get('/api/analytics/monthly-trend/'),
        api.get('/api/analytics/weekly-trend/'),
      ]);
      setSummary(summaryRes.data);
      setCategoryData(catRes.data);
      setMonthlyData(monthRes.data);
      setWeeklyData(weekRes.data);
    } catch (err) {
      console.error('Dashboard data fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div className="skeleton-box" style={{ width: '280px', height: '28px', marginBottom: '8px' }} />
          <div className="skeleton-box" style={{ width: '400px', height: '16px' }} />
        </div>
        <div className="dashboard-summary-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton-box" style={{ height: '100px', borderRadius: '14px' }} />
          ))}
        </div>
        <div className="dashboard-charts-grid">
          <div className="skeleton-box" style={{ height: '340px', borderRadius: '14px' }} />
          <div className="skeleton-box" style={{ height: '340px', borderRadius: '14px' }} />
        </div>
      </div>
    );
  }

  const currentMonth = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div>
      {/* Page Header */}
      <div className="m-b-6">
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>
          Financial Dashboard
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Overview for <strong>{currentMonth}</strong> — track your spending, budgets, and savings at a glance.
        </p>
      </div>

      {/* ===== SUMMARY CARDS ===== */}
      <div className="dashboard-summary-grid">
        {/* Total Budget */}
        <div className="summary-card">
          <div className="summary-card-icon" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
            💰
          </div>
          <div className="summary-card-content">
            <div className="summary-card-label">Total Budget</div>
            <div className="summary-card-value" style={{ color: 'var(--color-primary)' }}>
              {formatVal(summary?.total_budget)}
            </div>
            <div className="summary-card-sub">Active budget allocation</div>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="summary-card">
          <div className="summary-card-icon" style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
            📉
          </div>
          <div className="summary-card-content">
            <div className="summary-card-label">Total Expenses</div>
            <div className="summary-card-value" style={{ color: 'var(--color-danger)' }}>
              {formatVal(summary?.total_expenses)}
            </div>
            <div className="summary-card-sub">{summary?.expense_count || 0} transactions this month</div>
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="summary-card">
          <div className="summary-card-icon" style={{
            background: (summary?.remaining ?? 0) >= 0 ? 'var(--color-success-light)' : 'var(--color-danger-light)',
            color: (summary?.remaining ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
          }}>
            💵
          </div>
          <div className="summary-card-content">
            <div className="summary-card-label">Remaining Budget</div>
            <div className="summary-card-value" style={{
              color: (summary?.remaining ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
            }}>
              {formatVal(Math.abs(summary?.remaining || 0))}
            </div>
            <div className="summary-card-sub">
              {(summary?.remaining ?? 0) >= 0 ? 'Available to spend' : 'Over budget!'}
            </div>
          </div>
        </div>

        {/* Savings Rate */}
        <div className="summary-card">
          <div className="summary-card-icon" style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
            📊
          </div>
          <div className="summary-card-content">
            <div className="summary-card-label">Savings Rate</div>
            <div className="summary-card-value" style={{
              color: (summary?.savings_rate ?? 0) >= 0 ? 'var(--color-warning)' : 'var(--color-danger)',
            }}>
              {summary?.savings_rate ?? 0}%
            </div>
            <div className="summary-card-sub">
              {(summary?.savings_rate ?? 0) >= 20 ? 'Great saving pace!' : (summary?.savings_rate ?? 0) >= 0 ? 'Room to improve' : 'Overspending'}
            </div>
          </div>
        </div>
      </div>

      {/* ===== CHARTS ROW ===== */}
      <div className="dashboard-charts-grid">
        {/* Monthly Line Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="chart-card-title">
              <span>📈</span> Monthly Spending Trend
            </div>
            <span className="chart-card-badge" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
              Last 6 Months
            </span>
          </div>
          <div style={{ width: '100%', height: '280px' }}>
            {monthlyData.length === 0 ? (
              <div className="dashboard-empty-state">
                <div className="dashboard-empty-state-icon">📊</div>
                <p>No trend data available yet. Start logging expenses!</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a5b4fc" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month_display" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatVal(v)} />
                  <Tooltip content={<CustomTooltip formatVal={formatVal} />} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="url(#lineGradient)"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#6366f1', stroke: '#6366f1', strokeWidth: 2 }}
                    activeDot={{ r: 8, fill: '#a5b4fc', stroke: '#6366f1', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Weekly Bar Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="chart-card-title">
              <span>📊</span> Weekly Breakdown
            </div>
            <span className="chart-card-badge" style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
              This Month
            </span>
          </div>
          <div style={{ width: '100%', height: '280px' }}>
            {weeklyData.length === 0 ? (
              <div className="dashboard-empty-state">
                <div className="dashboard-empty-state-icon">📊</div>
                <p>No weekly data available yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} barCategoryGap="25%">
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="week" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatVal(v)} />
                  <Tooltip content={<CustomTooltip formatVal={formatVal} />} />
                  <Bar dataKey="total" fill="url(#barGradient)" radius={[6, 6, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ===== PIE CHART + CATEGORIES ===== */}
      <div className="dashboard-charts-grid" style={{ marginBottom: '2rem' }}>
        {/* Pie Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="chart-card-title">
              <span>🍩</span> Spending by Category
            </div>
            <span className="chart-card-badge" style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
              All Time
            </span>
          </div>
          <div style={{ width: '100%', height: '280px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {categoryData.length === 0 ? (
              <div className="dashboard-empty-state">
                <div className="dashboard-empty-state-icon">🍩</div>
                <p>No category data available. Add expenses to see breakdown.</p>
              </div>
            ) : (
              <>
                <div style={{ height: '210px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="total"
                        stroke="none"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip formatVal={formatVal} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', fontSize: '0.72rem' }}>
                  {categoryData.slice(0, 6).map((entry, index) => (
                    <div key={entry.category} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length], flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-muted)' }}>{entry.category_display}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Top Categories */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="chart-card-title">
              <span>🏆</span> Top Categories
            </div>
            <span className="chart-card-badge" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
              This Month
            </span>
          </div>
          {(!summary?.top_categories || summary.top_categories.length === 0) ? (
            <div className="dashboard-empty-state">
              <div className="dashboard-empty-state-icon">🏆</div>
              <p>No categories with spending this month.</p>
            </div>
          ) : (
            <div>
              {summary.top_categories.map((cat, i) => (
                <div key={i} className="top-category-item">
                  <div className="top-category-icon" style={{ background: `${cat.color}20`, color: cat.color }}>
                    {cat.icon}
                  </div>
                  <div className="top-category-info">
                    <div className="top-category-name">{cat.name}</div>
                    <div className="top-category-bar">
                      <div
                        className="top-category-bar-fill"
                        style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="top-category-amount">{formatVal(cat.total)}</div>
                    <div className="top-category-pct">{cat.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== BOTTOM ROW: Highlights + Recent Expenses ===== */}
      <div className="dashboard-bottom-grid">
        {/* Highest & Lowest Spending */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="chart-card-title">
              <span>⚡</span> Spending Extremes
            </div>
          </div>

          {/* Highest */}
          {summary?.highest_expense ? (
            <div className="expense-highlight">
              <div className="expense-highlight-icon" style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
                🔺
              </div>
              <div className="expense-highlight-info">
                <div className="expense-highlight-title">{summary.highest_expense.title}</div>
                <div className="expense-highlight-meta">
                  {summary.highest_expense.category_icon} {summary.highest_expense.category_name} · {new Date(summary.highest_expense.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <div className="expense-highlight-amount" style={{ color: 'var(--color-danger)' }}>
                {formatVal(summary.highest_expense.amount)}
              </div>
            </div>
          ) : (
            <div className="expense-highlight" style={{ justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No expenses this month
            </div>
          )}

          {/* Lowest */}
          {summary?.lowest_expense ? (
            <div className="expense-highlight">
              <div className="expense-highlight-icon" style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
                🔻
              </div>
              <div className="expense-highlight-info">
                <div className="expense-highlight-title">{summary.lowest_expense.title}</div>
                <div className="expense-highlight-meta">
                  {summary.lowest_expense.category_icon} {summary.lowest_expense.category_name} · {new Date(summary.lowest_expense.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <div className="expense-highlight-amount" style={{ color: 'var(--color-success)' }}>
                {formatVal(summary.lowest_expense.amount)}
              </div>
            </div>
          ) : null}
        </div>

        {/* Recent Expenses */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="chart-card-title">
              <span>🧾</span> Recent Expenses
            </div>
            <a href="/expenses" style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
              View All →
            </a>
          </div>
          {(!summary?.recent_expenses || summary.recent_expenses.length === 0) ? (
            <div className="dashboard-empty-state">
              <div className="dashboard-empty-state-icon">🧾</div>
              <p>No expenses logged yet this month.</p>
            </div>
          ) : (
            <div>
              {summary.recent_expenses.map((exp, i) => (
                <div key={exp.id || i} className="recent-expense-row">
                  <div className="recent-expense-icon" style={{
                    background: `${exp.category_color || '#6b7280'}20`,
                    color: exp.category_color || '#6b7280',
                  }}>
                    {exp.category_icon || '📦'}
                  </div>
                  <div className="recent-expense-details">
                    <div className="recent-expense-title">{exp.title}</div>
                    <div className="recent-expense-date">
                      {exp.category_name} · {new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="recent-expense-amount">
                    -{formatVal(exp.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Budget Quick Overview */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="chart-card-title">
              <span>🎯</span> Budget Health
            </div>
            <a href="/budgets" style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
              Manage →
            </a>
          </div>

          {summary?.total_budget > 0 ? (
            <div>
              {/* Overall progress */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div className="flex justify-between items-center" style={{ marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Overall Usage</span>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: (summary.total_expenses / summary.total_budget) * 100 >= 100
                      ? 'var(--color-danger)'
                      : (summary.total_expenses / summary.total_budget) * 100 >= 75
                        ? 'var(--color-warning)'
                        : 'var(--color-success)',
                  }}>
                    {Math.round((summary.total_expenses / summary.total_budget) * 100)}%
                  </span>
                </div>
                <div className="progress-bar-container" style={{ height: '10px' }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.min((summary.total_expenses / summary.total_budget) * 100, 100)}%`,
                      background: (summary.total_expenses / summary.total_budget) * 100 >= 100
                        ? 'linear-gradient(90deg, #ef4444, #f87171)'
                        : (summary.total_expenses / summary.total_budget) * 100 >= 75
                          ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                          : 'linear-gradient(90deg, #10b981, #34d399)',
                      transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>
              </div>

              <div className="section-divider" />

              {/* Quick stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Spent</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-danger)' }}>{formatVal(summary.total_expenses)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Remaining</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: summary.remaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {formatVal(Math.abs(summary.remaining))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="dashboard-empty-state">
              <div className="dashboard-empty-state-icon">🎯</div>
              <p>No active budgets. Set a budget to track your spending.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
