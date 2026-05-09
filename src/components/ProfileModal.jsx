import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './EventModal.css'; // Reuse glassmorphism styles

export default function ProfileModal({ user, onClose, onUpdate }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    confirmPassword: '',
    avatar: user?.avatar || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { logout } = useAuth();

  const compressImage = (file, maxWidth = 400, quality = 0.8) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
      };
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return setError('Image must be less than 5MB');
    }

    try {
      const compressedBase64 = await compressImage(file, 400, 0.8);
      setForm({ ...form, avatar: compressedBase64 });
      setError('');
    } catch (err) {
      setError('Failed to compress image');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password && form.password !== form.confirmPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true);
    setError('');
    try {
      const updateData = {
        name: form.name,
        email: form.email,
        avatar: form.avatar
      };
      if (form.password) updateData.password = form.password;

      const res = await api.put('/auth/me', updateData);
      onUpdate(res.data);
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div 
        className="modal-content event-modal"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
      >
        <div className="modal-header">
          <h2 className="modal-title font-display">Edit Profile</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div className="timeline-empty" style={{ padding: '40px 0' }}>
            <div className="empty-icon">✨</div>
            <h3>Profile Updated!</h3>
            <p>Your changes have been saved successfully.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
              <div 
                style={{ 
                  width: '90px', height: '90px', borderRadius: '50%', background: 'var(--bg-secondary)', 
                  border: '2px solid var(--accent-gold)', position: 'relative', overflow: 'hidden', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)'
                }}
                onClick={() => document.getElementById('avatar-upload').click()}
                title="Click to change photo"
              >
                {form.avatar ? (
                  <img src={form.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '36px', color: 'var(--text-muted)', fontFamily: 'Playfair Display' }}>
                    {form.name?.[0]?.toUpperCase() || '👤'}
                  </span>
                )}
                <div style={{
                  position: 'absolute', bottom: 0, width: '100%', background: 'rgba(0,0,0,0.6)', 
                  color: 'white', fontSize: '10px', textAlign: 'center', padding: '3px 0',
                  textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600
                }}>Edit</div>
              </div>
              <input id="avatar-upload" type="file" accept="image/jpeg, image/png, image/webp" hidden onChange={handleImageChange} />
              {form.avatar && (
                <button 
                  type="button" 
                  className="btn btn-ghost btn-sm" 
                  style={{ marginTop: '12px', fontSize: '11px', padding: '4px 8px' }} 
                  onClick={() => setForm({...form, avatar: ''})}
                >
                  Remove Photo
                </button>
              )}
            </div>

            <div className="form-group">
              <label className="input-label">Display Name</label>
              <input
                className="input"
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="input-label">Email Address</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="modal-row">
              <div className="form-group">
                <label className="input-label">New Password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="Leave blank to keep"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="input-label">Confirm Password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="Repeat password"
                  value={form.confirmPassword}
                  onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <button 
                type="submit" 
                className="btn btn-primary btn-lg" 
                style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: '16px', letterSpacing: '0.5px' }} 
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Update Profile'}
              </button>
              <button 
                type="button" 
                className="btn btn-ghost btn-sm" 
                style={{ border: 'none', color: 'var(--text-muted)' }}
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
