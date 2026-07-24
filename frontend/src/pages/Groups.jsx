import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'create', 'view'
  const [selectedGroup, setSelectedGroup] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState(null);
  
  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/groups/');
      // Django REST Framework pagination returns an object with a 'results' array.
      // If pagination is disabled, it returns the array directly.
      setGroups(res.data.results || res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load groups. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/groups/', { name, description });
      setGroups([res.data, ...groups]);
      setActiveTab('list');
      setName('');
      setDescription('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!selectedGroup || !inviteEmail) return;
    
    setInviteLoading(true);
    try {
      const res = await api.post(`/api/groups/${selectedGroup.id}/invitations/`, { email: inviteEmail });
      setInviteMessage({ type: 'success', text: 'Invitation sent successfully!' });
      setInviteEmail('');
      // Refresh group to see new invite
      const updatedGroup = await api.get(`/api/groups/${selectedGroup.id}/`);
      setSelectedGroup(updatedGroup.data);
    } catch (err) {
      setInviteMessage({ type: 'error', text: 'Failed to send invite.' });
    } finally {
      setInviteLoading(false);
      setTimeout(() => setInviteMessage(null), 3000);
    }
  };

  if (loading && groups.length === 0) {
    return (
      <div className="p-4" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Loading groups...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--color-danger)' }}>⚠️</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-danger)' }}>Error</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        <button className="btn btn-primary m-t-4" onClick={fetchGroups}>Try Again</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center m-b-6">
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Shared Budgets</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your expense groups and track shared spending.</p>
        </div>
        {activeTab === 'list' && (
          <button 
            className="btn btn-primary"
            onClick={() => setActiveTab('create')}
          >
            + New Group
          </button>
        )}
        {activeTab !== 'list' && (
          <button 
            className="btn btn-secondary"
            onClick={() => {
              setActiveTab('list');
              setSelectedGroup(null);
            }}
          >
            ← Back to Groups
          </button>
        )}
      </div>

      {activeTab === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {groups.length === 0 ? (
            <div className="dashboard-empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="dashboard-empty-state-icon">👥</div>
              <p>You aren't in any groups yet. Create one to start sharing expenses!</p>
            </div>
          ) : (
            groups.map(group => (
              <div 
                key={group.id} 
                className="chart-card" 
                style={{ cursor: 'pointer', transition: 'transform 0.2s', padding: '1.5rem' }}
                onClick={() => {
                  setSelectedGroup(group);
                  setActiveTab('view');
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{group.name}</h3>
                  <div style={{ 
                    background: 'var(--color-primary-light)', 
                    color: 'var(--color-primary)',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {group.members.length} Members
                  </div>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  {group.description || 'No description provided.'}
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {group.members.slice(0, 5).map(m => (
                    <div key={m.id} title={m.user_details.username} style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: 'var(--bg-secondary)', border: '2px solid var(--bg-body)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-primary)'
                    }}>
                      {m.user_details.username.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {group.members.length > 5 && (
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: 'var(--border-color)', border: '2px solid var(--bg-body)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)'
                    }}>
                      +{group.members.length - 5}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <div className="form-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Create Expense Group</h2>
          <form onSubmit={handleCreateGroup}>
            <div className="form-group">
              <label className="form-label">Group Name</label>
              <input 
                className="form-control" 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
                placeholder="e.g. Ski Trip 2026, Household"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description (Optional)</label>
              <textarea 
                className="form-control" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                rows={3}
                placeholder="What is this group for?"
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button type="submit" className="btn btn-primary">Create Group</button>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('list')}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'view' && selectedGroup && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', alignItems: 'start' }}>
          
          {/* Main Info */}
          <div>
            <div className="chart-card" style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>{selectedGroup.name}</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                {selectedGroup.description || 'No description provided.'}
              </p>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <a href={`/expenses?group_id=${selectedGroup.id}`} className="btn btn-primary" style={{ textDecoration: 'none' }}>View Group Expenses</a>
                <a href={`/budgets?group_id=${selectedGroup.id}`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>View Group Budgets</a>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">Group Members</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {selectedGroup.members.map(member => (
                  <div key={member.id} style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', fontWeight: 'bold'
                      }}>
                        {member.user_details.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{member.user_details.username} {member.user === user.id && '(You)'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{member.user_details.email}</div>
                      </div>
                    </div>
                    <div style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
                      background: member.role === 'admin' ? 'var(--color-warning-light)' : 'var(--color-success-light)',
                      color: member.role === 'admin' ? 'var(--color-warning)' : 'var(--color-success)'
                    }}>
                      {member.role}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar / Invite */}
          <div className="chart-card">
            <div className="chart-card-header">
              <div className="chart-card-title">Invite Member</div>
            </div>
            
            <form onSubmit={handleInvite} style={{ marginBottom: '2rem' }}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-control" 
                  value={inviteEmail} 
                  onChange={e => setInviteEmail(e.target.value)} 
                  required
                  placeholder="friend@example.com"
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={inviteLoading}>
                {inviteLoading ? 'Sending...' : 'Send Invite'}
              </button>
              {inviteMessage && (
                <div style={{ 
                  marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem',
                  background: inviteMessage.type === 'success' ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                  color: inviteMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'
                }}>
                  {inviteMessage.text}
                </div>
              )}
            </form>

            <div className="chart-card-title" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Pending Invitations</div>
            {(!selectedGroup.invitations || selectedGroup.invitations.length === 0) ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No pending invitations.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedGroup.invitations.map(inv => (
                  <div key={inv.id} style={{ 
                    padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{inv.email}</span>
                    <span style={{ 
                      fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px',
                      background: inv.status === 'accepted' ? 'var(--color-success-light)' : 'var(--color-warning-light)',
                      color: inv.status === 'accepted' ? 'var(--color-success)' : 'var(--color-warning)'
                    }}>
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}
