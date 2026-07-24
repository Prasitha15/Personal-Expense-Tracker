import React, { useState, useRef, useCallback } from 'react';
import api from '../services/api';

/* ─── Status badge config ─────────────────────────────────────────── */
const STATUS_META = {
  imported: { label: 'Imported',  color: '#10b981', bg: '#10b98120', icon: '✓' },
  skipped:  { label: 'Skipped',   color: '#f59e0b', bg: '#f59e0b20', icon: '⟳' },
  error:    { label: 'Error',     color: '#ef4444', bg: '#ef444420', icon: '✕' },
};

/* ─── CSV template columns ───────────────────────────────────────── */
const TEMPLATE_HEADERS = ['date', 'title', 'category', 'payment_method', 'amount', 'description', 'notes'];
const TEMPLATE_SAMPLE  = [
  '2024-01-15', 'Monthly Rent', 'Housing', 'bank_transfer', '1200.00', 'January rent payment', '',
];

function downloadTemplate() {
  const rows = [TEMPLATE_HEADERS.join(','), TEMPLATE_SAMPLE.join(',')];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'expenses_import_template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════════════
   CsvImportModal
   Props:
     onClose    () => void
     onImported () => void   — called when ≥1 row was imported so list refreshes
══════════════════════════════════════════════════════════════════ */
export default function CsvImportModal({ onClose, onImported }) {
  const [phase,      setPhase]      = useState('upload'); // upload | uploading | report
  const [dragActive, setDragActive] = useState(false);
  const [file,       setFile]       = useState(null);
  const [progress,   setProgress]   = useState(0);
  const [report,     setReport]     = useState(null);   // { total, imported, skipped, errors, rows }
  const [expandedRow,setExpandedRow]= useState(null);
  const [filterTab,  setFilterTab]  = useState('all');  // all | imported | skipped | error
  const fileInputRef = useRef(null);

  /* ── Drag & drop handlers ────────────────────────────────────────── */
  const onDragOver  = (e) => { e.preventDefault(); setDragActive(true);  };
  const onDragLeave = (e) => { e.preventDefault(); setDragActive(false); };
  const onDrop      = (e) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) pickFile(dropped);
  };

  const pickFile = useCallback((f) => {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a .csv file.');
      return;
    }
    setFile(f);
  }, []);

  /* ── Upload & import ─────────────────────────────────────────────── */
  const handleUpload = async () => {
    if (!file) return;
    setPhase('uploading');
    setProgress(0);

    // Fake smooth progress up to 85% while waiting for the server
    const ticker = setInterval(() => {
      setProgress(p => (p < 85 ? p + Math.random() * 8 : p));
    }, 180);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await api.post('/api/expenses/import-csv/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      clearInterval(ticker);
      setProgress(100);
      setReport(res.data);
      setPhase('report');
      if (res.data.imported > 0) onImported();
    } catch (err) {
      clearInterval(ticker);
      setPhase('upload');
      const msg = err.response?.data?.detail || 'Upload failed. Please try again.';
      alert(msg);
    }
  };

  /* ── Filtered rows ───────────────────────────────────────────────── */
  const filteredRows = report?.rows?.filter(r =>
    filterTab === 'all' ? true : r.status === filterTab
  ) ?? [];

  /* ═══════════════════════════════════════════════════════════════════
     Render
  ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="modal-content"
        style={{ maxWidth: '680px', padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>📥</span>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Import Expenses from CSV</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                Validates data, resolves categories, skips duplicates automatically
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} style={{ position: 'static' }}>×</button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: '75vh' }}>

          {/* ══ PHASE: UPLOAD ══════════════════════════════════════════════ */}
          {phase === 'upload' && (
            <>
              {/* Column spec card */}
              <div style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.9rem 1rem',
                marginBottom: '1.25rem',
                fontSize: '0.82rem',
              }}>
                <p style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  📋 Expected CSV columns
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[
                    { col: 'date',           note: 'required · YYYY-MM-DD',   color: '#ef4444' },
                    { col: 'title',          note: 'required',                 color: '#ef4444' },
                    { col: 'amount',         note: 'required · numeric',       color: '#ef4444' },
                    { col: 'category',       note: 'optional · must match your categories', color: '#6366f1' },
                    { col: 'payment_method', note: 'optional · cash / credit_card / debit_card / bank_transfer / others', color: '#6366f1' },
                    { col: 'description',    note: 'optional',                 color: '#6b7280' },
                    { col: 'notes',          note: 'optional',                 color: '#6b7280' },
                  ].map(({ col, note, color }) => (
                    <span key={col} title={note} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      background: `${color}18`, border: `1px solid ${color}44`,
                      color, borderRadius: '6px', padding: '2px 8px',
                      fontSize: '0.75rem', fontWeight: 600, cursor: 'help',
                    }}>
                      {col}
                    </span>
                  ))}
                </div>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.6rem', fontSize: '0.75rem' }}>
                  Hover a column for details.  Duplicates (same title + date + amount) are skipped automatically.
                </p>
              </div>

              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                style={{
                  border: `2px dashed ${dragActive ? 'var(--color-primary)' : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragActive ? 'var(--color-primary-light)' : 'var(--bg-tertiary)',
                  transition: 'var(--transition-fast)',
                  marginBottom: '1rem',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => { if (e.target.files?.[0]) pickFile(e.target.files[0]); }}
                />
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                  {dragActive ? '📂' : (file ? '📄' : '☁️')}
                </div>
                {file ? (
                  <>
                    <p style={{ fontWeight: 700, color: 'var(--color-primary)', marginBottom: '2px' }}>{file.name}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {(file.size / 1024).toFixed(1)} KB · Click to change
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {dragActive ? 'Drop your CSV here' : 'Drag & drop or click to browse'}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Only .csv files accepted</p>
                  </>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                <button
                  onClick={downloadTemplate}
                  className="btn btn-secondary btn-sm"
                  style={{ marginRight: 'auto' }}
                  title="Download a sample CSV template"
                >
                  ⬇ Download Template
                </button>
                <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={handleUpload}
                  disabled={!file}
                  style={{ opacity: file ? 1 : 0.5 }}
                >
                  ⬆ Upload &amp; Import
                </button>
              </div>
            </>
          )}

          {/* ══ PHASE: UPLOADING ═══════════════════════════════════════════ */}
          {phase === 'uploading' && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}>⚙️</div>
              <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>Processing your CSV…</p>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Validating rows, resolving categories, checking for duplicates
              </p>
              {/* Progress bar */}
              <div style={{
                height: '8px',
                background: 'var(--bg-tertiary)',
                borderRadius: '999px',
                overflow: 'hidden',
                maxWidth: '340px',
                margin: '0 auto',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, var(--color-primary), #818cf8)',
                  borderRadius: '999px',
                  transition: 'width 0.2s ease',
                }} />
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {Math.round(progress)}%
              </p>
            </div>
          )}

          {/* ══ PHASE: REPORT ══════════════════════════════════════════════ */}
          {phase === 'report' && report && (
            <>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'Total',    val: report.total,    color: '#6366f1', icon: '🗃' },
                  { label: 'Imported', val: report.imported, color: '#10b981', icon: '✅' },
                  { label: 'Skipped',  val: report.skipped,  color: '#f59e0b', icon: '⏭' },
                  { label: 'Errors',   val: report.errors,   color: '#ef4444', icon: '❌' },
                ].map(({ label, val, color, icon }) => (
                  <div key={label} style={{
                    background: `${color}12`,
                    border: `1px solid ${color}30`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '1.4rem', marginBottom: '2px' }}>{icon}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{val}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Import result message */}
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                background: report.imported > 0 ? '#10b98115' : '#ef444415',
                border: `1px solid ${report.imported > 0 ? '#10b98140' : '#ef444440'}`,
                color: report.imported > 0 ? '#10b981' : '#ef4444',
                fontWeight: 600,
              }}>
                {report.imported > 0
                  ? `✓ Successfully imported ${report.imported} expense${report.imported !== 1 ? 's' : ''} into your account.`
                  : report.skipped > 0 && report.errors === 0
                    ? '⟳ All rows were duplicates — nothing new was imported.'
                    : '✕ No rows were imported. Review the errors below.'}
              </div>

              {/* Filter tabs */}
              {report.rows?.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    {[
                      { key: 'all',      label: `All (${report.total})` },
                      { key: 'imported', label: `Imported (${report.imported})` },
                      { key: 'skipped',  label: `Skipped (${report.skipped})` },
                      { key: 'error',    label: `Errors (${report.errors})` },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setFilterTab(tab.key)}
                        style={{
                          background: filterTab === tab.key ? 'var(--color-primary)' : 'var(--bg-tertiary)',
                          color: filterTab === tab.key ? '#fff' : 'var(--text-secondary)',
                          border: `1px solid ${filterTab === tab.key ? 'var(--color-primary)' : 'var(--border-color)'}`,
                          borderRadius: '6px',
                          padding: '3px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)',
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Row-by-row table */}
                  <div style={{ maxHeight: '280px', overflowY: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-tertiary)', position: 'sticky', top: 0, zIndex: 1 }}>
                          <th style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Row #</th>
                          <th style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Status</th>
                          <th style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Title</th>
                          <th style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Details / Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                              No rows in this category.
                            </td>
                          </tr>
                        ) : filteredRows.map((r, idx) => {
                          const meta = STATUS_META[r.status] ?? STATUS_META.error;
                          const isExpanded = expandedRow === `${r.row}-${idx}`;
                          const titleVal = r.data?.title || r.data?.Title || '—';
                          return (
                            <React.Fragment key={`${r.row}-${idx}`}>
                              <tr
                                onClick={() => setExpandedRow(isExpanded ? null : `${r.row}-${idx}`)}
                                style={{
                                  borderTop: '1px solid var(--border-color)',
                                  cursor: 'pointer',
                                  background: isExpanded ? 'var(--bg-tertiary)' : 'transparent',
                                  transition: 'background 0.15s',
                                }}
                                className="csv-report-row"
                              >
                                <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                  {r.row}
                                </td>
                                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    background: meta.bg, color: meta.color,
                                    border: `1px solid ${meta.color}44`,
                                    borderRadius: '6px', padding: '1px 8px',
                                    fontSize: '0.73rem', fontWeight: 700,
                                  }}>
                                    {meta.icon} {meta.label}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 10px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                  {titleVal}
                                </td>
                                <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                  {r.reason || (r.status === 'imported'
                                    ? `${r.data?.date} · ${r.data?.amount}`
                                    : '—')}
                                  <span style={{ float: 'right', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                    {isExpanded ? '▲' : '▼'}
                                  </span>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr style={{ background: 'var(--bg-accent)' }}>
                                  <td colSpan={4} style={{ padding: '0 10px 10px 10px' }}>
                                    <pre style={{
                                      fontSize: '0.72rem',
                                      background: 'var(--bg-primary)',
                                      border: '1px solid var(--border-color)',
                                      borderRadius: '6px',
                                      padding: '0.6rem',
                                      whiteSpace: 'pre-wrap',
                                      color: 'var(--text-secondary)',
                                      margin: '6px 0 0 0',
                                      maxHeight: '120px',
                                      overflowY: 'auto',
                                    }}>
                                      {JSON.stringify(r.data, null, 2)}
                                    </pre>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Footer actions */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setPhase('upload'); setFile(null); setReport(null); setProgress(0); setFilterTab('all'); }}
                >
                  ← Import Another File
                </button>
                <button className="btn btn-primary" onClick={onClose}>Done</button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
