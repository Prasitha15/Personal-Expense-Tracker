import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { toast } from 'react-toastify';

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/api/notifications/');
      setNotifications(res.data.results || res.data); // Support paginated or unpaginated list
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const markAllRead = async () => {
    try {
      await api.post('/api/notifications/mark-all-read/');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error("Failed to update notifications");
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileOpen ? 'active' : ''}`} style={mobileOpen ? { transform: 'translateX(0)' } : undefined}>
        <div className="sidebar-logo">
          <span>💸</span>
          <span className="logo-text">ExpenseTracker</span>
        </div>
        
        <ul className="sidebar-menu">
          <li>
            <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
              <span>📊</span> Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/expenses" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
              <span>🧾</span> Expenses
            </NavLink>
          </li>
          <li>
            <NavLink to="/budgets" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
              <span>🎯</span> Budgets
            </NavLink>
          </li>
          <li>
            <NavLink to="/groups" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
              <span>👥</span> Shared Groups
            </NavLink>
          </li>
          <li>
            <NavLink to="/profile" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
              <span>👤</span> Settings & Profile
            </NavLink>
          </li>
        </ul>

        <div className="sidebar-footer">
          <div className="user-snippet">
            <div className="user-avatar">
              {user?.username?.substring(0, 2).toUpperCase()}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.username}</div>
              <div className="user-role">Currency: {user?.currency}</div>
            </div>
          </div>
          <button className="btn btn-secondary btn-full btn-sm" onClick={logout}>
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main View Area */}
      <div className="main-content">
        <header className="header">
          <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
            ☰
          </button>
          
          <div className="header-title">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Workspace</h2>
          </div>

          <div className="header-right">
            <button 
              onClick={toggleTheme} 
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px' }}
              title="Toggle Theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* Notification Bell with Custom Dropdown */}
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <div className="notification-bell" onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}>
                🔔
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </div>

              {notifDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '50px',
                  right: 0,
                  width: '320px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 200,
                  padding: '1rem',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  <div className="flex items-center justify-between m-b-4">
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button 
                        style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                        onClick={markAllRead}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }} />
                  {notifications.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                      No notifications yet
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {notifications.slice(0, 10).map((n) => (
                        <div 
                          key={n.id} 
                          style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            background: n.is_read ? 'transparent' : 'var(--color-primary-light)',
                            borderLeft: n.is_read ? '2px solid transparent' : '2px solid var(--color-primary)',
                            fontSize: '0.8rem'
                          }}
                        >
                          <p style={{ color: 'var(--text-primary)' }}>{n.message}</p>
                          <small style={{ color: 'var(--text-muted)' }}>
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Welcome, <strong>{user?.username}</strong></span>
            </div>
          </div>
        </header>

        <main className="page-container">
          {children}
        </main>
      </div>
    </div>
  );
};
