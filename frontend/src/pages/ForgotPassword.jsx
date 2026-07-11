import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function ForgotPassword() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      await api.post('/api/users/forgot-password/', { email: data.email });
      setSent(true);
      toast.success("Password reset link sent to your email!");
    } catch (err) {
      toast.error(err.response?.data?.email?.[0] || err.response?.data?.detail || "Request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Recover Password</h1>
          <p>Enter your email and we'll send you a password reset link</p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', margin: '2rem 0' }}>
            <p style={{ color: 'var(--color-success)', fontWeight: 600, marginBottom: '1.5rem' }}>
              ✓ Email sent successfully!
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
              Please check your console/log files (or inbox) for the reset link and follow the instructions to reset your password.
            </p>
            <Link to="/login" className="btn btn-secondary btn-full">
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                type="email" 
                className="form-control" 
                placeholder="name@example.com"
                {...register('email', { required: 'Email address is required' })}
              />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>

            <button type="submit" className="btn btn-primary btn-full m-b-4" disabled={submitting}>
              {submitting ? 'Sending Request...' : 'Send Recovery Link'}
            </button>
          </form>
        )}

        {!sent && (
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Remember your password? <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Sign In</Link>
          </p>
        )}
      </div>
    </div>
  );
}
