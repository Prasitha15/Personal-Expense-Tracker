import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { downloadExport } from '../services/exportService';

/* ─── Format definitions ─────────────────────────────────────────── */
const FORMATS = [
  {
    key: 'csv',
    label: 'CSV',
    icon: '📊',
    desc: 'Comma-separated, opens in Excel / Google Sheets',
    color: '#10b981',
  },
  {
    key: 'excel',
    label: 'Excel',
    icon: '📗',
    desc: '.xlsx workbook with styled headers and totals',
    color: '#22c55e',
  },
  {
    key: 'pdf',
    label: 'PDF',
    icon: '📄',
    desc: 'Formatted report ready to print or share',
    color: '#ef4444',
  },
];

/**
 * ExportDropdown
 *
 * Props:
 *   resource  {string}  – 'expenses' | 'incomes'
 *   filters   {Object}  – current filter / ordering params to forward to the API
 *   disabled  {boolean} – disables the trigger button
 */
export default function ExportDropdown({ resource = 'expenses', filters = {}, disabled = false }) {
  const [open,       setOpen]       = useState(false);
  const [exporting,  setExporting]  = useState(null); // key of in-progress format
  const containerRef = useRef(null);

  /* Close on outside click */
  const handleOutsideClick = useCallback((e) => {
    if (containerRef.current && !containerRef.current.contains(e.target)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) document.addEventListener('mousedown', handleOutsideClick);
    else       document.removeEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open, handleOutsideClick]);

  const handleExport = async (format) => {
    setExporting(format);
    try {
      await downloadExport(resource, format, filters);
      toast.success(`${format.toUpperCase()} export downloaded successfully!`);
    } catch (err) {
      console.error(err);
      toast.error(`Export failed: ${err.response?.data?.detail || err.message || 'Unknown error'}`);
    } finally {
      setExporting(null);
      setOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* ── Trigger button ── */}
      <button
        id="export-dropdown-trigger"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen(o => !o)}
        disabled={disabled || exporting !== null}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontWeight: 600,
          transition: 'var(--transition-fast)',
        }}
        title="Export data"
      >
        {exporting ? (
          <>
            <span className="export-spinner" />
            Exporting…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          className="export-dropdown-panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 1000,
            minWidth: '260px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            animation: 'exportDropdownIn 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
          }}>
            Download as
          </div>

          {/* Format options */}
          {FORMATS.map((fmt) => {
            const isLoading = exporting === fmt.key;
            return (
              <button
                key={fmt.key}
                id={`export-${resource}-${fmt.key}`}
                onClick={() => handleExport(fmt.key)}
                disabled={exporting !== null}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: '10px 14px',
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                  opacity: exporting && !isLoading ? 0.5 : 1,
                }}
                className="export-format-btn"
              >
                {/* Colored badge */}
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: `${fmt.color}1a`,
                  border: `1px solid ${fmt.color}44`,
                  fontSize: '1rem',
                  flexShrink: 0,
                }}>
                  {isLoading ? <span className="export-spinner" style={{ borderTopColor: fmt.color }} /> : fmt.icon}
                </span>

                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {fmt.label}
                    {isLoading && (
                      <span style={{ marginLeft: '6px', fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                        Preparing…
                      </span>
                    )}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {fmt.desc}
                  </span>
                </span>

                {/* Arrow */}
                {!isLoading && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </button>
            );
          })}

          {/* Footer hint */}
          <div style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
          }}>
            ✦ Active filters &amp; sorting are applied to the export
          </div>
        </div>
      )}
    </div>
  );
}
