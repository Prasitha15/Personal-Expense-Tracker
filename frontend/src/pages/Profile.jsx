import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  // Form 1: Profile preferences
  const { register: registerProfile, handleSubmit: handleProfileSubmit, reset: resetProfile } = useForm();

  // Form 2: Change password
  const { 
    register: registerPassword, 
    handleSubmit: handlePasswordSubmit, 
    reset: resetPassword, 
    formState: { errors: passwordErrors },
    watch: watchPassword 
  } = useForm();

  const newPassword = watchPassword('new_password');

  useEffect(() => {
    if (user) {
      resetProfile({
        currency: user.currency,
      });
    }
  }, [user, resetProfile]);

  const onUpdateProfile = async (data) => {
    setSubmittingProfile(true);
    const formData = new FormData();
    formData.append('currency', data.currency);
    if (data.profile_picture && data.profile_picture[0]) {
      formData.append('profile_picture', data.profile_picture[0]);
    }

    const result = await updateProfile(formData);
    setSubmittingProfile(false);

    if (result.success) {
      toast.success("Profile preferences updated successfully");
    } else {
      toast.error("Failed to update profile settings");
    }
  };

  const onChangePassword = async (data) => {
    setSubmittingPassword(true);
    try {
      await api.post('/api/users/change-password/', {
        old_password: data.old_password,
        new_password: data.new_password,
      });
      toast.success("Password changed successfully!");
      resetPassword();
    } catch (err) {
      toast.error(err.response?.data?.old_password?.[0] || err.response?.data?.detail || "Failed to change password.");
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="m-b-6">
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Profile & Settings</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage your user account credentials and localization preferences.</p>
      </div>

      {/* Profile settings card */}
      <div className="card m-b-6">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary-light)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 800,
            border: '2px solid var(--border-color)',
            overflow: 'hidden'
          }}>
            {user?.profile_picture ? (
              <img src={user.profile_picture} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              user?.username?.substring(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{user?.username}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit(onUpdateProfile)}>
          <div className="form-group">
            <label className="form-label">Preferred Currency Symbol</label>
            <select className="form-control" {...registerProfile('currency')}>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="INR">INR (₹)</option>
              <option value="CAD">CAD ($)</option>
              <option value="AUD">AUD ($)</option>
            </select>
            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              Used to format currency values in dashboard visualizations.
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">Upload Profile Picture</label>
            <input 
              type="file" 
              className="form-control" 
              accept="image/*"
              {...registerProfile('profile_picture')}
            />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" disabled={submittingProfile}>
              {submittingProfile ? 'Saving modifications...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password card */}
      <div className="card">
        <h2 className="card-title" style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Update Password</h2>
        
        <form onSubmit={handlePasswordSubmit(onChangePassword)}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="••••••••"
              {...registerPassword('old_password', { required: 'Current password is required' })}
            />
            {passwordErrors.old_password && <p className="form-error">{passwordErrors.old_password.message}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">New Password</label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="••••••••"
              {...registerPassword('new_password', { 
                required: 'New password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' }
              })}
            />
            {passwordErrors.new_password && <p className="form-error">{passwordErrors.new_password.message}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="••••••••"
              {...registerPassword('confirm_new_password', { 
                required: 'Please confirm your new password',
                validate: value => value === newPassword || 'Passwords do not match'
              })}
            />
            {passwordErrors.confirm_new_password && <p className="form-error">{passwordErrors.confirm_new_password.message}</p>}
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" disabled={submittingPassword}>
              {submittingPassword ? 'Updating Password...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
