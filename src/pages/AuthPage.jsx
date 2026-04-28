import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import sdLogo from '../assets/sd-logo.png';
import './AuthPage.css';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('mode') === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ name: '', email: '', password: '', otp: '', newPassword: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        navigate('/timeline');
      } else if (mode === 'register') {
        if (!form.name) { setError('Name is required'); setLoading(false); return; }
        await register(form.name, form.email, form.password);
        navigate('/timeline');
      } else if (mode === 'forgot-password') {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${apiUrl}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setMessage('OTP sent to your email');
        setMode('verify-otp');
      } else if (mode === 'verify-otp') {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${apiUrl}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: form.email, 
            otp: form.otp, 
            newPassword: form.newPassword 
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setMessage('Password reset successful! Please sign in.');
        setMode('login');
      }
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-orb auth-orb-1" />
      <div className="auth-bg-orb auth-orb-2" />

      <button className="auth-theme-toggle" onClick={toggleTheme}>
        {theme === 'dark' ? '☀' : '☾'}
      </button>

      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-brand" onClick={() => navigate('/')}>
            <span className="logo-star">✦</span>
            <span className="logo-text">Memoria</span>
          </div>
          <blockquote className="auth-quote">
            <p>"The life of every man is a diary in which he means to write one story, and writes another."</p>
            <footer>— J.M. Barrie</footer>
          </blockquote>
          <div className="auth-timeline-preview">
            {['2021','2022','2023','2024'].map((y, i) => (
              <div key={y} className="auth-timeline-dot" style={{ animationDelay: `${i * 0.2}s` }}>
                <div className="dot-circle" />
                <span>{y}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card glass-card">
          {(mode === 'login' || mode === 'register') && (
            <div className="auth-tabs">
              <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); setMessage(''); }}>
                Sign In
              </button>
              <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError(''); setMessage(''); }}>
                Create Account
              </button>
            </div>
          )}

          <h2 className="auth-title">
            {mode === 'login' && 'Welcome back'}
            {mode === 'register' && 'Begin your story'}
            {mode === 'forgot-password' && 'Reset Password'}
            {mode === 'verify-otp' && 'Verify OTP'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login' && 'Your memories are waiting for you.'}
            {mode === 'register' && 'Create an account to start building your timeline.'}
            {mode === 'forgot-password' && 'Enter your email to receive a reset code.'}
            {mode === 'verify-otp' && `We sent a code to ${form.email}`}
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && (
              <div className="form-group">
                <label className="input-label">Your Name</label>
                <input
                  className="input"
                  type="text"
                  placeholder="What should we call you?"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'forgot-password' || mode === 'verify-otp') && (
              <div className="form-group">
                <label className="input-label">Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  disabled={mode === 'verify-otp'}
                />
              </div>
            )}

            {(mode === 'login' || mode === 'register') && (
              <div className="form-group">
                <div className="label-row">
                  <label className="input-label">Password</label>
                  {mode === 'login' && (
                    <button type="button" className="forgot-link" onClick={() => setMode('forgot-password')}>
                      Forgot?
                    </button>
                  )}
                </div>
                <input
                  className="input"
                  type="password"
                  placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  minLength={6}
                />
              </div>
            )}

            {mode === 'verify-otp' && (
              <>
                <div className="form-group">
                  <label className="input-label">Enter OTP</label>
                  <input
                    className="input otp-input"
                    type="text"
                    placeholder="123456"
                    maxLength={6}
                    value={form.otp}
                    onChange={e => setForm(f => ({ ...f, otp: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="input-label">New Password</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="At least 6 characters"
                    value={form.newPassword}
                    onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
              </>
            )}

            {error && (
              <div className="auth-error">
                <span>⚠</span> {error}
              </div>
            )}
            {message && (
              <div className="auth-message">
                <span>✓</span> {message}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
              {loading ? (
                <span className="auth-spinner" />
              ) : (
                mode === 'login' ? 'Sign In to Memoria' : 
                mode === 'register' ? 'Create My Timeline' :
                mode === 'forgot-password' ? 'Send Reset Code' : 'Update Password'
              )}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? "Don't have an account? " : 
             mode === 'register' ? 'Already have an account? ' : 
             mode === 'forgot-password' ? 'Remembered your password? ' : 'Need another code? '}
            <button onClick={() => { 
              if (mode === 'forgot-password' || mode === 'verify-otp') setMode('login');
              else setMode(mode === 'login' ? 'register' : 'login'); 
              setError('');
              setMessage('');
            }}>
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
        </div>

        <div className="auth-footer-container animate-fadeIn" style={{ animationDelay: '1s' }}>
          <div className="makers-note">
            <div className="note-divider" />
            <div className="note-content">
              <span className="note-emoji">👋</span>
              <p><strong>Hi, I'm Subhranil!</strong><br />
              I built Memoria to help you cherish your story. If you're enjoying the experience, I'd love to hear from you!</p>
              <div className="note-links">
                <a href="https://github.com/SubhranilSD" target="_blank" rel="noreferrer">GitHub</a>
                <span>•</span>
                <a href="https://www.linkedin.com/in/subhranildutta/" target="_blank" rel="noreferrer">LinkedIn</a>
              </div>
            </div>
          </div>

          <div className="auth-footer">
            <div className="sd-logo-container">
              <img src={sdLogo} alt="SD Logo" className="sd-logo-img" />
            </div>
            <p>Made with ❤️ by <span>Subhranil Dutta</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
