import React from 'react';
import './MobileBottomBar.css';

const MobileBottomBar = ({ 
  view, 
  setView, 
  theme, 
  toggleTheme, 
  onAddClick, 
  onProfileClick 
}) => {
  return (
    <nav className="mobile-bottom-bar">
      <button 
        className={`mbb-item ${view === 'timeline' ? 'active' : ''}`} 
        onClick={() => setView('timeline')}
      >
        <span className="mbb-icon">◈</span>
        <span className="mbb-label">Timeline</span>
      </button>
      
      <button 
        className={`mbb-item ${view === 'horizon' ? 'active' : ''}`} 
        onClick={() => setView('horizon')}
      >
        <span className="mbb-icon">〰</span>
        <span className="mbb-label">Horizon</span>
      </button>
      
      <button className="mbb-item mbb-add" onClick={onAddClick}>
        <div className="mbb-add-inner">
          <span className="mbb-icon">+</span>
        </div>
        <span className="mbb-label">Add</span>
      </button>
      
      <button className="mbb-item" onClick={toggleTheme}>
        <span className="mbb-icon">{theme === 'dark' ? '☀' : '☾'}</span>
        <span className="mbb-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
      </button>
      
      <button className="mbb-item" onClick={onProfileClick}>
        <span className="mbb-icon">👤</span>
        <span className="mbb-label">Profile</span>
      </button>
    </nav>
  );
};

export default MobileBottomBar;
