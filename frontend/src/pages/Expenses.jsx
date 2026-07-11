import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';

export default function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [viewingExpense, setViewingExpense] = useState(null);

  // Filters State
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        category: category || undefined,
        payment_method: paymentMethod || undefined,
        search: search || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        min_amount: minAmount || undefined,
        max_amount: maxAmount || undefined,
      };

      const res = await api.get('/api/expenses/', { params });
      setExpenses(res.data.results || res.data);
      setCount(res.data.count || res.data.length);
    } catch (err) {
      toast.error("Failed to load expenses data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [page, category, paymentMethod, startDate, endDate, minAmount, maxAmount]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchExpenses();
  };

  const handleResetFilters = () => {
    setCategory('');
    setPaymentMethod('');
    setSearch('');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setPage(1);
  };

  const openAddModal = () => {
    setEditingExpense(null);
    reset({
      title: '',
      category: 'food',
      payment_method: 'cash',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (expense) => {
    setEditingExpense(expense);
    reset({
      title: expense.title || '',
      category: expense.category,
      payment_method: expense.payment_method,
      amount: expense.amount,
      date: expense.date,
      description: expense.description || '',
      notes: expense.notes || '',
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('category', data.category);
    formData.append('payment_method', data.payment_method);
    formData.append('amount', data.amount);
    formData.append('date', data.date);
    formData.append('description', data.description || '');
    formData.append('notes', data.notes || '');
    
    if (data.receipt_image && data.receipt_image[0]) {
      formData.append('receipt_image', data.receipt_image[0]);
    }

    try {
      if (editingExpense) {
        await api.patch(`/api/expenses/${editingExpense.id}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success("Expense updated successfully");
      } else {
        await api.post('/api/expenses/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success("Expense registered. Processing receipt OCR in background if uploaded.");
      }
      setIsModalOpen(false);
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.detail || "An error occurred saving expense");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this expense?")) {
      try {
        await api.delete(`/api/expenses/${id}/`);
        toast.success("Expense deleted successfully");
        fetchExpenses();
      } catch (err) {
        toast.error("Failed to delete expense");
      }
    }
  };

  const handleExport = (format) => {
    const baseUrl = format === 'pdf' ? '/api/expenses/export-pdf/' : '/api/expenses/export-excel/';
    const params = new URLSearchParams({
      category: category || '',
      payment_method: paymentMethod || '',
      search: search || '',
      start_date: startDate || '',
      end_date: endDate || '',
      min_amount: minAmount || '',
      max_amount: maxAmount || '',
    });
    window.open(`${baseUrl}?${params.toString()}`, '_blank');
  };

  const formatVal = (val) => {
    const symbol = user?.currency === 'EUR' ? '€' : user?.currency === 'GBP' ? '£' : user?.currency === 'INR' ? '₹' : '$';
    return `${symbol}${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div>
      <div className="flex justify-between items-center m-b-6">
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Outflow Registry</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Log and organize your outbound transactions, process digital receipt snapshots.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('excel')}>📥 Export Excel</button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')}>📄 Export PDF</button>
          <button className="btn btn-primary" onClick={openAddModal}>➕ Add Expense</button>
        </div>
      </div>

      {/* Filter Bar */}
      <form onSubmit={handleSearchSubmit} className="filter-bar">
        <div className="filter-item">
          <label className="form-label">Search</label>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Search details..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-item">
          <label className="form-label">Category</label>
          <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            <option value="food">Food & Dining</option>
            <option value="transport">Transportation</option>
            <option value="utilities">Utilities</option>
            <option value="entertainment">Entertainment</option>
            <option value="housing">Housing</option>
            <option value="health">Healthcare</option>
            <option value="education">Education</option>
            <option value="others">Others</option>
          </select>
        </div>
        <div className="filter-item">
          <label className="form-label">Payment Method</label>
          <select className="form-control" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="">All Methods</option>
            <option value="cash">Cash</option>
            <option value="credit_card">Credit Card</option>
            <option value="debit_card">Debit Card</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="others">Others</option>
          </select>
        </div>
        <div className="filter-item">
          <label className="form-label">Start Date</label>
          <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="filter-item">
          <label className="form-label">End Date</label>
          <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="filter-item flex gap-2">
          <button type="submit" className="btn btn-primary btn-sm flex-1" style={{ height: '38px' }}>Apply</button>
          <button type="button" className="btn btn-secondary btn-sm flex-1" style={{ height: '38px' }} onClick={handleResetFilters}>Reset</button>
        </div>
      </form>

      {/* Table List */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading transactions...</div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Payment Method</th>
                    <th>Receipt OCR</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No records matches current filters.</td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id}>
                        <td>{new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td>
                          <span 
                            style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--color-primary)' }}
                            onClick={() => setViewingExpense(exp)}
                          >
                            {exp.title}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-success" style={{ textTransform: 'capitalize' }}>
                            {exp.category_display}
                          </span>
                        </td>
                        <td>{exp.payment_method_display}</td>
                        <td>
                          {exp.ocr_status === 'pending' && <span className="badge badge-warning">Pending OCR</span>}
                          {exp.ocr_status === 'completed' && <span className="badge badge-success" title={exp.ocr_text}>OCR Success</span>}
                          {exp.ocr_status === 'failed' && <span className="badge badge-danger">OCR Failed</span>}
                          {exp.ocr_status === 'none' && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No receipt</span>}
                        </td>
                        <td className="text-right" style={{ fontWeight: 700 }}>{formatVal(exp.amount)}</td>
                        <td className="text-right">
                          <button className="btn btn-secondary btn-sm" style={{ marginRight: '6px' }} onClick={() => setViewingExpense(exp)}>🔍</button>
                          <button className="btn btn-secondary btn-sm" style={{ marginRight: '6px' }} onClick={() => openEditModal(exp)}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(exp.id)}>🗑️</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {count > 10 && (
              <div className="flex justify-between items-center" style={{ marginTop: '1.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Showing Page {page} of {Math.ceil(count / 10)}
                </span>
                <div className="flex gap-2">
                  <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
                  <button className="btn btn-secondary btn-sm" disabled={page * 10 >= count} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add / Edit Glassmorphism Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            <h2 className="card-title" style={{ fontSize: '1.3rem', marginBottom: '1.5rem' }}>
              {editingExpense ? 'Modify Expense Outflow' : 'Log New Outflow'}
            </h2>
            
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="form-group">
                <label className="form-label">Title / Heading</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Server hosting fee"
                  {...register('title', { required: 'Title is required' })}
                />
                {errors.title && <p className="form-error">{errors.title.message}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-control" {...register('category', { required: true })}>
                  <option value="food">Food & Dining</option>
                  <option value="transport">Transportation</option>
                  <option value="utilities">Utilities</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="housing">Housing</option>
                  <option value="health">Healthcare</option>
                  <option value="education">Education</option>
                  <option value="others">Others</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-control" {...register('payment_method', { required: true })}>
                  <option value="cash">Cash</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="debit_card">Debit Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="others">Others</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Amount (Outflow)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-control" 
                  placeholder="0.00"
                  {...register('amount', { required: 'Amount is required', min: { value: 0.01, message: 'Must be positive value' } })}
                />
                {errors.amount && <p className="form-error">{errors.amount.message}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Date</label>
                <input 
                  type="date" 
                  className="form-control"
                  {...register('date', { required: 'Date is required' })}
                />
                {errors.date && <p className="form-error">{errors.date.message}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-control" 
                  rows="2"
                  placeholder="Simple explanation..."
                  {...register('description')}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Detailed Notes</label>
                <textarea 
                  className="form-control" 
                  rows="3"
                  placeholder="Items list, extra remarks..."
                  {...register('notes')}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Attach Receipt (OCR Scanner)</label>
                <input 
                  type="file" 
                  className="form-control" 
                  accept="image/*"
                  {...register('receipt_image')}
                />
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  If uploaded, Tesseract OCR will automatically extract amounts in the background.
                </small>
              </div>

              {editingExpense?.receipt_image && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Receipt Image Attached:</label>
                  <img 
                    src={editingExpense.receipt_image} 
                    alt="Receipt Attachment" 
                    style={{ width: '100%', maxHeight: '150px', objectFit: 'contain', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
                  />
                </div>
              )}

              <div className="flex gap-2" style={{ marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Save Details</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {viewingExpense && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <button className="modal-close" onClick={() => setViewingExpense(null)}>×</button>
            <h2 className="card-title" style={{ fontSize: '1.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              Expense Details
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div>
                <span className="form-label">Title</span>
                <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>{viewingExpense.title}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="form-label">Amount</span>
                <p style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--color-primary)' }}>
                  {formatVal(viewingExpense.amount)}
                </p>
              </div>

              <div>
                <span className="form-label">Category</span>
                <p><span className="badge badge-success">{viewingExpense.category_display}</span></p>
              </div>
              <div>
                <span className="form-label">Payment Method</span>
                <p style={{ fontWeight: 600 }}>{viewingExpense.payment_method_display}</p>
              </div>

              <div>
                <span className="form-label">Date Tracked</span>
                <p>{new Date(viewingExpense.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div>
                <span className="form-label">OCR Status</span>
                <p>
                  {viewingExpense.ocr_status === 'pending' && <span className="badge badge-warning">Pending OCR</span>}
                  {viewingExpense.ocr_status === 'completed' && <span className="badge badge-success">OCR Completed</span>}
                  {viewingExpense.ocr_status === 'failed' && <span className="badge badge-danger">OCR Failed</span>}
                  {viewingExpense.ocr_status === 'none' && <span style={{ color: 'var(--text-muted)' }}>No receipt attached</span>}
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <span className="form-label">Brief Description</span>
              <p style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                {viewingExpense.description || <em style={{ color: 'var(--text-muted)' }}>No description provided</em>}
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <span className="form-label">Notes & Remarks</span>
              <p style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                {viewingExpense.notes || <em style={{ color: 'var(--text-muted)' }}>No detailed notes registered</em>}
              </p>
            </div>

            {viewingExpense.receipt_image && (
              <div style={{ display: 'grid', gridTemplateColumns: viewingExpense.ocr_text ? '1fr 1fr' : '1fr', gap: '1.25rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <div>
                  <span className="form-label">Receipt Image</span>
                  <img 
                    src={viewingExpense.receipt_image} 
                    alt="Receipt attachment preview" 
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
                  />
                </div>
                {viewingExpense.ocr_text && (
                  <div>
                    <span className="form-label">OCR Raw Extracted Text</span>
                    <pre style={{ fontSize: '0.75rem', background: 'var(--bg-primary)', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                      {viewingExpense.ocr_text}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setViewingExpense(null)}>Close Details</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
