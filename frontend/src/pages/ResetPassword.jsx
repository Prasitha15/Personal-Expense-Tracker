import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function ResetPassword() {
  const { uidb64, token } = useParams();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors }, watch } = useForm();
  const newPassword = watch('new_password');

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      await api.post('/api/users/reset-password/', {
        uidb64,
        token,
        new_password: data.new_password
      });
      toast.success("Password reset successfully! Please log in.");
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.token?.[0] || err.response?.data?.detail || "Failed to reset password. Link may be expired.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Reset Password</h1>
          <p>Choose a new secure password for your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="••••••••"
              {...register('new_password', { 
                required: 'New password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' }
              })}
            />
            {errors.new_password && <p className="form-error">{errors.new_password.message}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="••••••••"
              {...register('confirm_password', { 
                required: 'Please confirm your password',
                validate: value => value === newPassword || 'Passwords do not match'
              })}
            />
            {errors.confirm_password && <p className="form-error">{errors.confirm_password.message}</p>}
          </div>

          <button type="submit" className="btn btn-primary btn-full m-b-4" disabled={submitting}>
            {submitting ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Remember your password? <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
