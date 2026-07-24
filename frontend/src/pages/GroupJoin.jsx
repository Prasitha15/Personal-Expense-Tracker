import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

export default function GroupJoin() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('Verifying your invitation...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid invitation link. No token provided.');
      return;
    }

    const acceptInvite = async () => {
      try {
        const res = await api.post('/api/groups/join/', { token });
        setStatus('success');
        setMessage(res.data.message || 'You have successfully joined the group!');
        
        // Redirect to groups page after 3 seconds
        setTimeout(() => {
          navigate('/groups');
        }, 3000);
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Failed to accept invitation. The link may have expired or you are already a member.');
      }
    };

    acceptInvite();
  }, [token, navigate]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="form-card" style={{ maxWidth: '450px', textAlign: 'center', padding: '3rem' }}>
        
        {status === 'loading' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>Joining Group...</h2>
            <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--color-success)' }}>🎉</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--color-success)' }}>Success!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{message}</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Redirecting you to the groups dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--color-danger)' }}>⚠️</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--color-danger)' }}>Oops!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{message}</p>
            <button className="btn btn-primary" onClick={() => navigate('/groups')}>Go to Groups</button>
          </>
        )}

      </div>
    </div>
  );
}
