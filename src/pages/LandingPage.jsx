import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import './LandingPage.css';
import sdLogo from '../assets/sd-logo.png';

export default function LandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-logo">
          <span className="logo-star">✦</span>
          <span className="logo-text">Memoria</span>
        </div>
        <div className="landing-nav-right">
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/auth')}>Sign In</button>
          <button className="btn btn-primary" onClick={() => navigate('/auth?mode=register')}>Get Started</button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-bg-orb orb-1" />
        <div className="hero-bg-orb orb-2" />
        <div className="hero-bg-orb orb-3" />

        <div className="hero-content">
          <div className="hero-badge">✦ Your life, beautifully told</div>
          <h1 className="hero-title">
            Every memory<br />
            <em>deserves a stage</em>
          </h1>
          <p className="hero-subtitle">
            Memoria is a premium, visual timeline for the moments that shaped you.
            Capture, organize, and relive your story — with the beauty it deserves.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/auth?mode=register')}>
              Begin Your Timeline
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => navigate('/auth')}>
              Sign In
            </button>
          </div>
        </div>

        <div className="hero-preview">
          <div className="preview-card glass-card">
            <div className="preview-dot" style={{ background: '#f59e0b' }} />
            <div>
              <div className="preview-title">First day in Tokyo</div>
              <div className="preview-date">March 12, 2023</div>
            </div>
          </div>
          <div className="preview-card glass-card" style={{ animationDelay: '0.3s' }}>
            <div className="preview-dot" style={{ background: '#10b981' }} />
            <div>
              <div className="preview-title">Graduated university</div>
              <div className="preview-date">June 4, 2022</div>
            </div>
          </div>
          <div className="preview-card glass-card" style={{ animationDelay: '0.6s' }}>
            <div className="preview-dot" style={{ background: '#ec4899' }} />
            <div>
              <div className="preview-title">First apartment</div>
              <div className="preview-date">September 1, 2021</div>
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h2 className="section-title">Crafted for storytellers</h2>
          <div className="features-grid">
            {[
              { icon: '◈', title: 'Visual Timeline', desc: 'A cinematic, scroll-based experience that brings your memories to life.' },
              { icon: '⬡', title: 'Drag & Drop', desc: 'Reorder events with intuitive drag-and-drop. Your story, your order.' },
              { icon: '◉', title: 'Rich Media', desc: 'Attach photos and videos to each memory for a truly immersive experience.' },
              { icon: '◈', title: 'Moods & Tags', desc: 'Tag events by emotion and category to filter and rediscover your memories.' },
              { icon: '⟁', title: 'Story Mode', desc: 'Auto-play your timeline as a cinematic presentation. Sit back and watch.' },
              { icon: '◐', title: 'Light & Dark', desc: 'A gorgeous experience in both light and dark modes, tailored to your preference.' },
            ].map((f, i) => (
              <div key={i} className="feature-card glass-card" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-top">
          <div className="landing-logo-group">
            <span className="logo-star">✦</span>
            <span>Memoria — Your Life, Your Story</span>
          </div>
        </div>

        <div className="landing-maker-section">
          <div className="makers-note">
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

          <div className="sd-branding">
            <div className="sd-logo-container">
              <img src={sdLogo} alt="SD Logo" className="sd-logo-img" />
            </div>
            <p>Made with ❤️ by <span>Subhranil Dutta</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
