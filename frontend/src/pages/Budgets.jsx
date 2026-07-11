import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';

export default function Budgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const fetchBudgets = async () => {
    try {
      const res = await api.get('/api/budgets/');
      setBudgets(res.data.results || res.data);
    } catch (err) {
      toast.error("Failed to load budgets");
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/api/categories/');
      setCategories(res.data);
    } catch (err) {
      console.error("Failed to load categories", err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchBudgets(), fetchCategories()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingBudget(null);
    reset({
      category: '',
      limit: '',
      start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (budget) => {
    setEditingBudget(budget);
    reset({
      category: budget.category || '',
      limit: budget.limit,
      start_date: budget.start_date,
      end_date: budget.end_date,
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data) => {
    const payload = {
      ...data,
      category: data.category === "" ? null : parseInt(data.category, 10),
      limit: parseFloat(data.limit),
    };
    try {
      if (editingBudget) {
        await api.put(`/api/budgets/${editingBudget.id}/`, payload);
        toast.success("Budget updated successfully");
      } else {
        await api.post('/api/budgets/', payload);
        toast.success("New budget target added successfully");
      }
      setIsModalOpen(false);
      fetchBudgets();
    } catch (err) {
      const errorMsg = err.response?.data?.non_field_errors?.[0] || err.response?.data?.detail || "Error saving budget configurations";
      toast.error(errorMsg);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this budget threshold?")) {
      try {
        await api.delete(`/api/budgets/${id}/`);
        toast.success("Budget limit deleted");
        fetchBudgets();
      } catch (err) {
        toast.error("Failed to remove budget limit");
      }
    }
  };

  const formatVal = (val) => {
    const symbol = user?.currency === 'EUR' ? '€' : user?.currency === 'GBP' ? '£' : user?.currency === 'INR' ? '₹' : '$';
    return `${symbol}${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Compute alerts / warnings (any budget with progress >= 85%)
  const budgetAlerts = budgets.filter(b => b.progress >= 85);

  return (
    <div>
      <div className="flex justify-between items-center m-b-6">
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Budget Control Center</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Establish category spending boundaries and analyze consumption in real-time.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>🎯 Set New Budget</button>
      </div>

      {/* Budget Warnings / Alert Banners */}
      {budgetAlerts.length > 0 && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {budgetAlerts.map((b) => {
            const exceeded = b.progress >= 100;
            return (
              <div 
                key={b.id} 
                className="card" 
                style={{ 
                  padding: '1rem 1.25rem', 
                  borderLeft: `5px solid ${exceeded ? 'var(--color-danger)' : 'var(--color-warning)'}`,
                  background: exceeded ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  animation: 'slideIn 0.3s ease'
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>{exceeded ? '🚨' : '⚠️'}</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: exceeded ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                    {exceeded ? 'Critical Budget Exceeded' : 'Budget Warning Alert'}
                  </strong>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                    You have spent <strong>{b.progress.toFixed(1)}%</strong> of your <strong>{b.category_name}</strong> limit. 
                    ({formatVal(b.total_spent)} spent of {formatVal(b.limit)} limit). 
                    {exceeded 
                      ? ` Overspent by ${formatVal(b.total_spent - b.limit)}.` 
                      : ` Only ${formatVal(b.limit - b.total_spent)} remaining.`
                    }
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading budget configurations...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {budgets.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No budget limits created yet. Click "Set New Budget" to begin planning!
            </div>
          ) : (
            budgets.map((b) => {
              const exceeded = b.total_spent > b.limit;
              const remaining = b.limit - b.total_spent;
              const isMonthly = !b.category;
              
              return (
                <div 
                  key={b.id} 
                  className="card" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between',
                    borderTop: `4px solid ${b.category_color}`,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {isMonthly && (
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      fontSize: '0.7rem',
                      background: 'var(--color-primary-light)',
                      color: 'var(--color-primary)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      Monthly Overall
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center m-b-4" style={{ paddingRight: isMonthly ? '80px' : '0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.5rem' }}>{b.category_icon}</span>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                          {b.category_name}
                        </h3>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.6rem' }} onClick={() => openEditModal(b)}>✏️</button>
                        <button className="btn btn-danger btn-sm" style={{ padding: '0.3rem 0.6rem' }} onClick={() => handleDelete(b.id)}>🗑️</button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center m-b-4" style={{ marginTop: '1.25rem' }}>
                      <div>
                        <small style={{ color: 'var(--text-secondary)' }}>Spent</small>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: exceeded ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                          {formatVal(b.total_spent)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <small style={{ color: 'var(--text-secondary)' }}>Limit</small>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                          {formatVal(b.limit)}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="progress-bar-container" style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden', margin: '0.75rem 0' }}>
                      <div 
                        className="progress-bar-fill" 
                        style={{ 
                          height: '100%',
                          width: `${Math.min(b.progress, 100)}%`, 
                          backgroundColor: exceeded ? 'var(--color-danger)' : b.progress > 85 ? 'var(--color-warning)' : 'var(--color-primary)',
                          transition: 'width 0.5s ease-in-out'
                        }}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                      <span style={{ fontWeight: 600, color: exceeded ? 'var(--color-danger)' : b.progress > 85 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                        {exceeded ? 'Limit Exceeded!' : `${b.progress.toFixed(0)}% consumed`}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {remaining >= 0 ? `Remaining: ${formatVal(remaining)}` : `Overby: ${formatVal(Math.abs(remaining))}`}
                      </span>
                    </div>

                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span>Active: {new Date(b.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} to {new Date(b.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add / Edit Budget Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            <h2 className="card-title" style={{ fontSize: '1.3rem', marginBottom: '1.5rem' }}>
              {editingBudget ? 'Adjust Budget Target' : 'Establish Budget Threshold'}
            </h2>
            
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="form-group">
                <label className="form-label">Scope / Category</label>
                <select className="form-control" {...register('category')}>
                  <option value="">📅 Overall Monthly Budget (All Categories)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
                <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)' }}>
                  Select "Overall Monthly Budget" to apply this limit to your entire spending.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Target Limit Amount</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-control" 
                  placeholder="0.00"
                  {...register('limit', { required: 'Limit is required', min: { value: 0.01, message: 'Must be positive value' } })}
                />
                {errors.limit && <p className="form-error">{errors.limit.message}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input 
                  type="date" 
                  className="form-control"
                  {...register('start_date', { required: 'Start date is required' })}
                />
                {errors.start_date && <p className="form-error">{errors.start_date.message}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">End Date</label>
                <input 
                  type="date" 
                  className="form-control"
                  {...register('end_date', { required: 'End date is required' })}
                />
                {errors.end_date && <p className="form-error">{errors.end_date.message}</p>}
              </div>

              <div className="flex gap-2" style={{ marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Apply Target</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
