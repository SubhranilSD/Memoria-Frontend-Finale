import { useState } from 'react';
import './Lightbox.css';

export default function Lightbox({ event, onClose, onUpdateTitle, onEdit }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(event.title);

  if (!event || !event.media || event.media.length === 0) return null;

  const currentMedia = event.media[0];

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = currentMedia.url;
    a.download = `${event.title || 'memory'}.jpg`;
    a.click();
  };

  const handleSaveTitle = () => {
    onUpdateTitle(event._id, tempTitle);
    setEditingTitle(false);
  };

  return (
    <div className="lightbox-overlay animate-fadeIn">
      <div className="lightbox-backdrop" onClick={onClose} />
      
      {/* Top Bar Controls */}
      <div className="lightbox-header">
        <div className="lightbox-title-area">
          {editingTitle ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                className="input" 
                value={tempTitle} 
                onChange={e => setTempTitle(e.target.value)} 
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSaveTitle()}
              />
              <button className="btn btn-primary btn-sm" onClick={handleSaveTitle}>Save</button>
            </div>
          ) : (
            <>
              <h2>{event.title}</h2>
              <button className="lightbox-icon-btn" onClick={() => setEditingTitle(true)} title="Rename">
                ✏️
              </button>
            </>
          )}
        </div>
        
        <div className="lightbox-actions">
          <button className="lightbox-icon-btn" onClick={() => { onClose(); onEdit(event); }} title="Edit Full Memory">
            📝 Edit Details
          </button>
          <button className="lightbox-icon-btn" onClick={handleDownload} title="Download Image">
            📥 Download
          </button>
          <button className="lightbox-close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
      </div>

      {/* Main Image */}
      <div className="lightbox-content">
        <img src={currentMedia.url} alt={event.title} className="lightbox-img" />
      </div>

      {/* Footer Info */}
      <div className="lightbox-footer">
        <div className="lightbox-date">{new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        {event.location && <div className="lightbox-location">📍 {event.location}</div>}
      </div>
    </div>
  );
}
