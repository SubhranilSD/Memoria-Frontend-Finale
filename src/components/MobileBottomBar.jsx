import React from 'react';
import './MobileBottomBar.css';

const MobileBottomBar = ({ 
  view, 
  setView, 
  theme, 
  toggleTheme, 
  onAddClick, 
  onBulkAddClick,
  onProfileClick 
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleAddMainClick = () => {
    setIsExpanded(!isExpanded);
  };

  const handleSubAction = (action) => {
    setIsExpanded(false);
    action();
  };
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
      
      <div className={`mbb-add-container ${isExpanded ? 'expanded' : ''}`}>
        <button 
          className="mbb-sub-item mbb-sub-bulk" 
          onClick={() => handleSubAction(onBulkAddClick)}
          title="Bulk Add"
        >
          <div className="mbb-sub-inner">
            <span className="mbb-icon">📸</span>
          </div>
          <span className="mbb-label">Bulk</span>
        </button>

        <button 
          className="mbb-sub-item mbb-sub-single" 
          onClick={() => handleSubAction(onAddClick)}
          title="Add Single"
        >
          <div className="mbb-sub-inner">
            <span className="mbb-icon">✦</span>
          </div>
          <span className="mbb-label">Single</span>
        </button>

        <button className="mbb-item mbb-add" onClick={handleAddMainClick}>
          <div className="mbb-add-inner">
            <span className="mbb-icon">{isExpanded ? '×' : '+'}</span>
          </div>
          <span className="mbb-label">Add</span>
        </button>
      </div>
      
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
