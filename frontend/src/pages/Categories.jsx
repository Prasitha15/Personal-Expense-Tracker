import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  // Emojis list for easy selection
  const POPULAR_EMOJIS = ['🍔', '🚗', '⚡', '🎬', '🏠', '📦', '🎒', '🏥', '💸', '✈️', '🛒', '🏋️', '📚', '🍷'];

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/categories/');
      setCategories(res.data);
    } catch (err) {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openAddModal = () => {
    setEditingCategory(null);
    reset({
      name: '',
      color: '#6366f1',
      icon: '📦'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    reset({
      name: cat.name,
      color: cat.color,
      icon: cat.icon
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data) => {
    try {
      if (editingCategory) {
        await api.put(`/api/categories/${editingCategory.id}/`, data);
        toast.success("Category updated successfully");
      } else {
        await api.post('/api/categories/', data);
        toast.success("Category created successfully");
      }
      setIsModalOpen(false);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.name?.[0] || "An error occurred saving category");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this category? Any linked budgets will be deleted and linked expenses will be marked Uncategorized.")) {
      try {
        await api.delete(`/api/categories/${id}/`);
        toast.success("Category deleted");
        fetchCategories();
      } catch (err) {
        toast.error("Failed to delete category");
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center m-b-6">
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Category Control Panel</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your custom spending tags, select colors, and assign symbolic icons.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>➕ Add Category</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading category details...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {categories.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No categories found. Let's create some!
            </div>
          ) : (
            categories.map((cat) => (
              <div 
                key={cat.id} 
                className="card" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  borderTop: `4px solid ${cat.color}`
                }}
              >
                <div>
                  <div className="flex justify-between items-start m-b-4">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '2rem' }}>{cat.icon}</span>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{cat.name}</h3>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Color: {cat.color}</small>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.5rem' }} onClick={() => openEditModal(cat)}>✏️</button>
                      <button className="btn btn-danger btn-sm" style={{ padding: '0.35rem 0.5rem' }} onClick={() => handleDelete(cat.id)}>🗑️</button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            <h2 className="card-title" style={{ fontSize: '1.3rem', marginBottom: '1.5rem' }}>
              {editingCategory ? 'Modify Category' : 'Register New Category'}
            </h2>
            
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="form-group">
                <label className="form-label">Category Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Subscriptions"
                  {...register('name', { required: 'Name is required' })}
                />
                {errors.name && <p className="form-error">{errors.name.message}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Theme Color</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    type="color" 
                    style={{ width: '50px', height: '40px', border: 'none', background: 'none', cursor: 'pointer' }}
                    {...register('color')}
                  />
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="#6366f1"
                    {...register('color', { required: 'Color hex is required' })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Symbol Icon (Select or Type)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem', padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  {POPULAR_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '0.2rem' }}
                      onClick={() => setValue('icon', emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Paste or write emoji..."
                  {...register('icon', { required: 'Icon emoji is required' })}
                />
              </div>

              <div className="flex gap-2" style={{ marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
