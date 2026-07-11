import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categoriesData, setCategoriesData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [summary, setSummary] = useState({ totalSpent: 0, budgetLimit: 0, budgetSpent: 0 });

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#6b7280'];

  const getDashboardData = async () => {
    setLoading(true);
    try {
      const [catRes, trendRes, expRes, budgetRes] = await Promise.all([
        api.get('/api/analytics/category-breakdown/'),
        api.get('/api/analytics/monthly-trend/'),
        api.get('/api/expenses/?limit=5'),
        api.get('/api/analytics/budget-vs-actual/')
      ]);

      setCategoriesData(catRes.data);
      setTrendData(trendRes.data);
      setRecentExpenses(expRes.data.results || expRes.data);

      // Compute summaries
      const total = catRes.data.reduce((sum, item) => sum + item.total, 0);
      const bLimit = budgetRes.data.reduce((sum, b) => sum + b.limit, 0);
      const bSpent = budgetRes.data.reduce((sum, b) => sum + b.actual, 0);

      setSummary({
        totalSpent: total,
        budgetLimit: bLimit,
        budgetSpent: bSpent
      });

    } catch (err) {
      console.error("Error fetching dashboard statistics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getDashboardData();
  }, []);

  const formatVal = (val) => {
    const symbol = user?.currency === 'EUR' ? '€' : user?.currency === 'GBP' ? '£' : user?.currency === 'INR' ? '₹' : '$';
    return `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
        Loading statistical dashboard insights...
      </div>
    );
  }

  return (
    <div>
      <div className="m-b-6">
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Financial Analytics</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Real-time overview of your budget allocations, monthly trends, and spending categories.</p>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-icon" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
            💰
          </div>
          <div>
            <div className="metric-label">Total Outflow (Filtered)</div>
            <div className="metric-value">{formatVal(summary.totalSpent)}</div>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-icon" style={{ backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }}>
            🎯
          </div>
          <div>
            <div className="metric-label">Combined Budgets Limit</div>
            <div className="metric-value">{formatVal(summary.budgetLimit)}</div>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-icon" style={{ backgroundColor: summary.budgetSpent > summary.budgetLimit ? 'var(--color-danger-light)' : 'var(--color-warning-light)', color: summary.budgetSpent > summary.budgetLimit ? 'var(--color-danger)' : 'var(--color-warning)' }}>
            ⚠️
          </div>
          <div>
            <div className="metric-label">Spent in Budgets</div>
            <div className="metric-value">{formatVal(summary.budgetSpent)}</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="dashboard-grid m-b-6">
        {/* Monthly spending trend line chart */}
        <div className="card">
          <div className="card-title">Outflow Trend (Last 6 Months)</div>
          <div style={{ width: '100%', height: '300px' }}>
            {trendData.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
                No trend data available yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="month_display" stroke="var(--text-secondary)" fontSize={11} />
                  <YAxis stroke="var(--text-secondary)" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} 
                    formatter={(value) => [formatVal(value), 'Total Spent']}
                  />
                  <Line type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category breakdown pie chart */}
        <div className="card">
          <div className="card-title">Category Allocations</div>
          <div style={{ width: '100%', height: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {categoriesData.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
                No category expenses tracked
              </div>
            ) : (
              <>
                <div style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoriesData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="total"
                      >
                        {categoriesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                        formatter={(value) => [formatVal(value), 'Spent']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', fontSize: '0.75rem' }}>
                  {categoriesData.map((entry, index) => (
                    <div key={entry.category} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }}></span>
                      <span style={{ color: 'var(--text-secondary)' }}>{entry.category_display}:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{formatVal(entry.total)}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent Expenses List */}
      <div className="card">
        <div className="card-title">
          <span>Recent Outflows</span>
          <a href="/expenses" style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 600 }}>See All</a>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Category</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentExpenses.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No expenses logged yet.</td>
                </tr>
              ) : (
                recentExpenses.map((exp) => (
                  <tr key={exp.id}>
                    <td>{new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td style={{ fontWeight: 600 }}>{exp.title}</td>
                    <td>
                      <span className="badge badge-success" style={{ textTransform: 'capitalize' }}>
                        {exp.category_display}
                      </span>
                    </td>
                    <td className="text-right" style={{ fontWeight: 700 }}>{formatVal(parseFloat(exp.amount))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
