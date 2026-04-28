import { useTheme } from '../context/ThemeContext';
import './TopBar.css';

export default function TopBar({ search, setSearch }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="topbar">
      <div className="topbar-search">
        <span className="topbar-search-icon">🔍</span>
        <input 
          type="text" 
          placeholder="Search memories by title, location, tag, or person (Cmd+K)" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="topbar-search-input"
        />
        {search && (
          <button className="topbar-search-clear" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      <div className="topbar-actions">
        <button 
          className="topbar-theme-toggle" 
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  );
}
