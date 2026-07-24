import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import ExportDropdown from '../components/ExportDropdown';
import CsvImportModal from '../components/CsvImportModal';

/* ─── constants ─────────────────────────────────────────────────── */
const PAGE_SIZE = 10;

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'credit_card',   label: 'Credit Card' },
  { value: 'debit_card',    label: 'Debit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'others',        label: 'Others' },
];

const SORT_OPTIONS = [
  { value: '-date',        label: 'Date ↓ (newest)' },
  { value: 'date',         label: 'Date ↑ (oldest)' },
  { value: '-amount',      label: 'Amount ↓ (highest)' },
  { value: 'amount',       label: 'Amount ↑ (lowest)' },
  { value: '-created_at',  label: 'Added ↓ (newest)' },
];

const SOURCE_META = {
  salary:      { icon: '💼', color: '#6366f1' },
  business:    { icon: '🏢', color: '#10b981' },
  investment:  { icon: '📈', color: '#f59e0b' },
  freelancing: { icon: '💻', color: '#06b6d4' },
  other:       { icon: '💰', color: '#ec4899' },
};

/* ─── helpers ───────────────────────────────────────────────────── */
function useCurrencyFmt(currency) {
  return (val) => {
    const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'INR' ? '₹' : '$';
    return `${sym}${parseFloat(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
}

/* ─── tiny sub-components ───────────────────────────────────────── */
function SortableHeader({ label, field, ordering, onSort }) {
  const isActive = ordering === field || ordering === `-${field}`;
  const isDesc   = ordering === `-${field}`;
  return (
    <th
      onClick={() => onSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {label}{' '}
      <span style={{ opacity: isActive ? 1 : 0.25, fontSize: '0.75rem' }}>
        {isActive ? (isDesc ? '▼' : '▲') : '⇅'}
      </span>
    </th>
  );
}

function Chip({ label, onRemove, color = 'var(--color-primary)' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
      background: `${color}22`, color, border: `1px solid ${color}44`,
    }}>
      {label}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color, lineHeight: 1, padding: 0, fontSize: '0.9rem' }}>×</button>
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EXPENSES PAGE
══════════════════════════════════════════════════════════════════ */
export default function Expenses() {
  const { user } = useAuth();
  const fmt = useCurrencyFmt(user?.currency);

  /* ─── list state ────────────────────────────────────────────── */
  const [expenses,       setExpenses]       = useState([]);
  const [categories,     setCategories]     = useState([]);
  const [groups,         setGroups]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [page,           setPage]           = useState(1);
  const [count,          setCount]          = useState(0);

  /* ─── filter state ──────────────────────────────────────────── */
  const queryParams = new URLSearchParams(window.location.search);
  const initialGroup = queryParams.get('group_id') || '';

  const [search,         setSearch]         = useState('');
  const [appliedSearch,  setAppliedSearch]  = useState('');
  const [category,       setCategory]       = useState('');
  const [groupIdFilter,  setGroupIdFilter]  = useState(initialGroup);
  const [paymentMethod,  setPaymentMethod]  = useState('');
  const [startDate,      setStartDate]      = useState('');
  const [endDate,        setEndDate]        = useState('');
  const [minAmount,      setMinAmount]      = useState('');
  const [maxAmount,      setMaxAmount]      = useState('');
  const [ordering,       setOrdering]       = useState('-date');
  const [filtersOpen,    setFiltersOpen]    = useState(true);

  /* ─── modal state ───────────────────────────────────────────── */
  const [isModalOpen,    setIsModalOpen]    = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [submitting,     setSubmitting]     = useState(false);
  const [isImportOpen,   setIsImportOpen]   = useState(false);
  const [scanning,       setScanning]       = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  /* ─── fetch categories and groups ───────────────────────────── */
  useEffect(() => {
    api.get('/api/categories/').then(r => setCategories(r.data.results || r.data)).catch(() => {});
    api.get('/api/groups/').then(r => setGroups(r.data.results || r.data)).catch(() => {});
  }, []);

  /* ─── fetch expenses ────────────────────────────────────────── */
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        ordering,
        search:          appliedSearch || undefined,
        category:        category      || undefined,
        group:           groupIdFilter || undefined,
        payment_method:  paymentMethod || undefined,
        start_date:      startDate     || undefined,
        end_date:        endDate       || undefined,
        min_amount:      minAmount     || undefined,
        max_amount:      maxAmount     || undefined,
      };
      const res = await api.get('/api/expenses/', { params });
      setExpenses(res.data.results ?? res.data);
      setCount(res.data.count ?? (res.data.results ?? res.data).length);
    } catch {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [page, ordering, appliedSearch, category, groupIdFilter, paymentMethod, startDate, endDate, minAmount, maxAmount]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  /* ─── apply / reset filters ─────────────────────────────────── */
  const applyFilters = (e) => {
    e?.preventDefault();
    setAppliedSearch(search);
    setPage(1);
  };

  const resetFilters = () => {
    setSearch(''); setAppliedSearch('');
    setCategory(''); setGroupIdFilter(''); setPaymentMethod('');
    setStartDate(''); setEndDate('');
    setMinAmount(''); setMaxAmount('');
    setOrdering('-date'); setPage(1);
  };

  /* ─── sort toggle ───────────────────────────────────────────── */
  const handleSort = (field) => {
    setOrdering(prev => prev === `-${field}` ? field : `-${field}`);
    setPage(1);
  };

  /* ─── active filter chips ───────────────────────────────────── */
  const activeChips = [
    appliedSearch  && { key: 'search',  label: `"${appliedSearch}"`,          color: '#6366f1', clear: () => { setSearch(''); setAppliedSearch(''); setPage(1); } },
    category       && { key: 'cat',     label: categories.find(c=>c.id==category)?.name || `Cat #${category}`, color: '#10b981', clear: () => { setCategory(''); setPage(1); } },
    groupIdFilter  && { key: 'grp',     label: groups.find(g=>g.id==groupIdFilter)?.name || `Group #${groupIdFilter}`, color: '#8b5cf6', clear: () => { setGroupIdFilter(''); setPage(1); } },
    paymentMethod  && { key: 'pm',      label: PAYMENT_METHODS.find(p=>p.value===paymentMethod)?.label, color: '#f59e0b', clear: () => { setPaymentMethod(''); setPage(1); } },
    startDate      && { key: 'from',    label: `From ${startDate}`,           color: '#06b6d4', clear: () => { setStartDate(''); setPage(1); } },
    endDate        && { key: 'to',      label: `To ${endDate}`,               color: '#06b6d4', clear: () => { setEndDate(''); setPage(1); } },
    minAmount      && { key: 'min',     label: `≥ ${fmt(minAmount)}`,         color: '#ec4899', clear: () => { setMinAmount(''); setPage(1); } },
    maxAmount      && { key: 'max',     label: `≤ ${fmt(maxAmount)}`,         color: '#ec4899', clear: () => { setMaxAmount(''); setPage(1); } },
  ].filter(Boolean);

  /* ─── modal helpers ─────────────────────────────────────────── */
  const openAddModal = () => {
    setEditingExpense(null);
    reset({ title: '', category: '', group: '', payment_method: 'cash', amount: '', date: new Date().toISOString().slice(0,10), description: '', notes: '' });
    setIsModalOpen(true);
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setScanning(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await api.post('/api/expenses/scan-receipt/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const ext = res.data.extracted;
      if (ext.title) setValue('title', ext.title);
      if (ext.amount) setValue('amount', ext.amount);
      if (ext.date) setValue('date', ext.date);
      if (ext.category_id) setValue('category', ext.category_id);
      if (ext.payment_method) setValue('payment_method', ext.payment_method);
      if (ext.description) {
        const currentDesc = (document.querySelector('textarea[name="description"]')?.value || '');
        setValue('description', currentDesc ? currentDesc + '\n' + ext.description : ext.description);
      }
      
      toast.success(`OCR Scan complete! Confidence: ${res.data.confidence}%`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'OCR failed');
    } finally {
      setScanning(false);
    }
  };

  const openEditModal = (exp) => {
    setEditingExpense(exp);
    reset({ title: exp.title, category: exp.category, group: exp.group || '', payment_method: exp.payment_method, amount: exp.amount, date: exp.date, description: exp.description || '', notes: exp.notes || '' });
    setIsModalOpen(true);
  };

  const onSubmit = async (data) => {
    setSubmitting(true);
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (k !== 'receipt_image') {
        if (v !== '' && v !== null && v !== undefined) {
          fd.append(k, v);
        }
      }
    });
    if (data.receipt_image?.[0]) fd.append('receipt_image', data.receipt_image[0]);
    try {
      if (editingExpense) {
        await api.patch(`/api/expenses/${editingExpense.id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Expense updated');
      } else {
        await api.post('/api/expenses/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Expense logged. OCR will run in background if receipt uploaded.');
      }
      setIsModalOpen(false);
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return;
    try {
      await api.delete(`/api/expenses/${id}/`);
      toast.success('Expense deleted');
      fetchExpenses();
    } catch { toast.error('Delete failed'); }
  };

  const exportFilters = {
    category:       category      || undefined,
    group:          groupIdFilter || undefined,
    payment_method: paymentMethod || undefined,
    search:         appliedSearch || undefined,
    start_date:     startDate     || undefined,
    end_date:       endDate       || undefined,
    min_amount:     minAmount     || undefined,
    max_amount:     maxAmount     || undefined,
    ordering,
  };

  const totalPages = Math.ceil(count / PAGE_SIZE);

  /* ─── render ────────────────────────────────────────────────── */
  return (
    <div>
      {/* Page header */}
      <div className="flex justify-between items-center m-b-6" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Outflow Registry</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Log and organise your outbound transactions with advanced filters.</p>
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <ExportDropdown resource="expenses" filters={exportFilters} disabled={loading} />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsImportOpen(true)}
            title="Import expenses from a CSV file"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Import CSV
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>➕ Add Expense</button>
        </div>
      </div>

      {/* ── Advanced Filter Panel ─────────────────────────────── */}
      <div className="adv-filter-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="adv-filter-header" onClick={() => setFiltersOpen(o => !o)}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔍</span> Advanced Filters
            {activeChips.length > 0 && (
              <span style={{ background: 'var(--color-primary)', color: '#fff', borderRadius: '999px', fontSize: '0.7rem', padding: '1px 8px', fontWeight: 700 }}>
                {activeChips.length} active
              </span>
            )}
          </span>
          <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: filtersOpen ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
        </div>

        {filtersOpen && (
          <form onSubmit={applyFilters} className="adv-filter-body">
            {/* Row 1: Search + Category + Payment Method */}
            <div className="adv-filter-grid">
              <div className="adv-filter-field" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Search</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>🔍</span>
                  <input
                    type="text" className="form-control" style={{ paddingLeft: '36px' }}
                    placeholder="Title, description, category…"
                    value={search} onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="adv-filter-field">
                <label className="form-label">Category</label>
                <select className="form-control" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
                  <option value="">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="adv-filter-field">
                <label className="form-label">Payment Method</label>
                <select className="form-control" value={paymentMethod} onChange={e => { setPaymentMethod(e.target.value); setPage(1); }}>
                  <option value="">All Methods</option>
                  {PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {/* Row 2: Date range + Amount range + Sort */}
            <div className="adv-filter-grid" style={{ marginTop: '0.75rem' }}>
              <div className="adv-filter-field">
                <label className="form-label">From Date</label>
                <input type="date" className="form-control" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} />
              </div>
              <div className="adv-filter-field">
                <label className="form-label">To Date</label>
                <input type="date" className="form-control" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} />
              </div>
              <div className="adv-filter-field">
                <label className="form-label">Min Amount</label>
                <input type="number" step="0.01" min="0" className="form-control" placeholder="0.00" value={minAmount} onChange={e => { setMinAmount(e.target.value); setPage(1); }} />
              </div>
              <div className="adv-filter-field">
                <label className="form-label">Max Amount</label>
                <input type="number" step="0.01" min="0" className="form-control" placeholder="∞" value={maxAmount} onChange={e => { setMaxAmount(e.target.value); setPage(1); }} />
              </div>
              <div className="adv-filter-field">
                <label className="form-label">Sort By</label>
                <select className="form-control" value={ordering} onChange={e => { setOrdering(e.target.value); setPage(1); }}>
                  {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2" style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary btn-sm">Apply Search</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters}>Reset All</button>
            </div>
          </form>
        )}

        {/* Active chips */}
        {activeChips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-color)' }}>
            {activeChips.map(c => <Chip key={c.key} label={c.label} color={c.color} onRemove={c.clear} />)}
            <button onClick={resetFilters} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', alignSelf: 'center', textDecoration: 'underline' }}>clear all</button>
          </div>
        )}
      </div>

      {/* ── Results Summary ───────────────────────────────────── */}
      {!loading && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {count === 0 ? 'No results' : `${count} record${count !== 1 ? 's' : ''} found`}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Page {page} of {Math.max(totalPages, 1)}
          </span>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="skeleton-box" style={{ height: '44px', marginBottom: '8px', borderRadius: '8px' }} />
            ))}
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <SortableHeader label="Date"   field="date"       ordering={ordering} onSort={handleSort} />
                    <th>Title</th>
                    <th>Category</th>
                    <th>Payment</th>
                    <SortableHeader label="Amount" field="amount"     ordering={ordering} onSort={handleSort} />
                    <th>OCR</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan="7">
                        <div className="dashboard-empty-state">
                          <div className="dashboard-empty-state-icon">🧾</div>
                          <p>No expenses match your current filters.<br/>Try adjusting or resetting them.</p>
                        </div>
                      </td>
                    </tr>
                  ) : expenses.map(exp => (
                    <tr key={exp.id} style={{ cursor: 'default' }}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--color-primary)', cursor: 'pointer' }} onClick={() => setViewingExpense(exp)}>
                          {exp.title}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          background: `${exp.category_color || '#6b7280'}22`,
                          color: exp.category_color || '#6b7280',
                          padding: '2px 10px', borderRadius: '999px',
                          fontSize: '0.78rem', fontWeight: 700,
                        }}>
                          {exp.category_icon} {exp.category_display || exp.category_name || 'Uncategorized'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{exp.payment_method_display}</td>
                      <td style={{ fontWeight: 800, color: 'var(--color-danger)', whiteSpace: 'nowrap' }}>
                        -{fmt(exp.amount)}
                      </td>
                      <td>
                        {exp.ocr_status === 'pending'   && <span className="badge badge-warning">OCR Pending</span>}
                        {exp.ocr_status === 'completed' && <span className="badge badge-success" title={exp.ocr_text}>✓ OCR</span>}
                        {exp.ocr_status === 'failed'    && <span className="badge badge-danger">OCR Failed</span>}
                        {exp.ocr_status === 'none'      && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}
                      </td>
                      <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-secondary btn-sm" style={{ marginRight: '4px' }} onClick={() => setViewingExpense(exp)} title="View">🔍</button>
                        <button className="btn btn-secondary btn-sm" style={{ marginRight: '4px' }} onClick={() => openEditModal(exp)} title="Edit">✏️</button>
                        <button className="btn btn-danger    btn-sm"                                onClick={() => handleDelete(exp.id)} title="Delete">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center" style={{ marginTop: '1.25rem', padding: '0 0.25rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Showing {Math.min((page - 1) * PAGE_SIZE + 1, count)}–{Math.min(page * PAGE_SIZE, count)} of {count}
                </span>
                <div className="flex gap-2 items-center">
                  <button className="btn btn-secondary btn-sm" disabled={page === 1}          onClick={() => setPage(1)}>«</button>
                  <button className="btn btn-secondary btn-sm" disabled={page === 1}          onClick={() => setPage(p => p - 1)}>‹ Prev</button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', padding: '0 4px' }}>{page} / {totalPages}</span>
                  <button className="btn btn-secondary btn-sm" disabled={page >= totalPages}  onClick={() => setPage(p => p + 1)}>Next ›</button>
                  <button className="btn btn-secondary btn-sm" disabled={page >= totalPages}  onClick={() => setPage(totalPages)}>»</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ ADD / EDIT MODAL ═════════════════════════════════════ */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            <h2 className="card-title" style={{ fontSize: '1.3rem', marginBottom: '1.5rem' }}>
              {editingExpense ? '✏️ Edit Expense' : '➕ Log New Outflow'}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input type="text" className="form-control" placeholder="e.g. Monthly rent" {...register('title', { required: 'Title is required' })} />
                  {errors.title && <p className="form-error">{errors.title.message}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Group (Optional)</label>
                  <select className="form-control" {...register('group')}>
                    <option value="">Personal (No Group)</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-control" {...register('category', { required: true })}>
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select className="form-control" {...register('payment_method', { required: true })}>
                    {PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Amount</label>
                  <input type="number" step="0.01" className="form-control" placeholder="0.00" {...register('amount', { required: 'Amount required', min: { value: 0.01, message: 'Must be > 0' } })} />
                  {errors.amount && <p className="form-error">{errors.amount.message}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-control" {...register('date', { required: 'Date required' })} />
                  {errors.date && <p className="form-error">{errors.date.message}</p>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows="2" placeholder="Brief summary…" {...register('description')} />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows="3" placeholder="Itemised list, extra remarks…" {...register('notes')} />
              </div>

              <div className="form-group">
                <label className="form-label">Receipt (OCR scan)</label>
                <input 
                  type="file" 
                  className="form-control" 
                  accept="image/*" 
                  {...register('receipt_image', {
                    onChange: handleReceiptUpload
                  })} 
                />
                <small style={{ color: scanning ? 'var(--color-primary)' : 'var(--text-muted)', fontWeight: scanning ? 600 : 400 }}>
                  {scanning ? '🔄 Scanning receipt...' : 'Upload a receipt to auto-fill fields via OCR.'}
                </small>
              </div>

              {editingExpense?.receipt_image && (
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Current Receipt</label>
                  <img src={editingExpense.receipt_image} alt="Receipt" style={{ width: '100%', maxHeight: '120px', objectFit: 'contain', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }} />
                </div>
              )}

              <div className="flex gap-2" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ DETAIL VIEW MODAL ════════════════════════════════════ */}
      {viewingExpense && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <button className="modal-close" onClick={() => setViewingExpense(null)}>×</button>
            <h2 className="card-title" style={{ fontSize: '1.3rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              Expense Details
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div>
                <span className="form-label">Title</span>
                <p style={{ fontWeight: 700, fontSize: '1.05rem' }}>{viewingExpense.title}</p>
                {viewingExpense.group_name && (
                  <span className="badge badge-warning" style={{ marginTop: '0.25rem' }}>Group: {viewingExpense.group_name}</span>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="form-label">Amount</span>
                <p style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--color-danger)' }}>-{fmt(viewingExpense.amount)}</p>
              </div>
              <div>
                <span className="form-label">Category</span>
                <p><span className="badge badge-success">{viewingExpense.category_display || viewingExpense.category_name}</span></p>
              </div>
              <div>
                <span className="form-label">Payment Method</span>
                <p style={{ fontWeight: 600 }}>{viewingExpense.payment_method_display}</p>
              </div>
              <div>
                <span className="form-label">Date</span>
                <p>{new Date(viewingExpense.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div>
                <span className="form-label">OCR Status</span>
                <p>
                  {viewingExpense.ocr_status === 'pending'   && <span className="badge badge-warning">Pending</span>}
                  {viewingExpense.ocr_status === 'completed' && <span className="badge badge-success">Completed</span>}
                  {viewingExpense.ocr_status === 'failed'    && <span className="badge badge-danger">Failed</span>}
                  {viewingExpense.ocr_status === 'none'      && <span style={{ color: 'var(--text-muted)' }}>No receipt</span>}
                </p>
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <span className="form-label">Description</span>
              <p style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                {viewingExpense.description || <em style={{ color: 'var(--text-muted)' }}>No description</em>}
              </p>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <span className="form-label">Notes</span>
              <pre style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                {viewingExpense.notes || <em style={{ color: 'var(--text-muted)' }}>No notes</em>}
              </pre>
            </div>
            {viewingExpense.receipt_image && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <span className="form-label">Receipt Image</span>
                <img src={viewingExpense.receipt_image} alt="Receipt" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginTop: '8px' }} />
                {viewingExpense.ocr_text && (
                  <div style={{ marginTop: '1rem' }}>
                    <span className="form-label">OCR Extracted Text</span>
                    <pre style={{ fontSize: '0.75rem', background: 'var(--bg-primary)', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                      {viewingExpense.ocr_text}
                    </pre>
                  </div>
                )}
              </div>
            )}
            <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setViewingExpense(null); openEditModal(viewingExpense); }}>✏️ Edit</button>
              <button className="btn btn-danger    btn-sm" onClick={() => { setViewingExpense(null); handleDelete(viewingExpense.id); }}>🗑️ Delete</button>
              <button className="btn btn-secondary"        onClick={() => setViewingExpense(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {/* ═══ CSV IMPORT MODAL ════════════════════════════════════════ */}
      {isImportOpen && (
        <CsvImportModal
          onClose={() => setIsImportOpen(false)}
          onImported={() => { fetchExpenses(); toast.success('CSV imported — list refreshed.'); }}
        />
      )}
    </div>
  );
}
