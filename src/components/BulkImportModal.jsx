import { useState, useRef } from 'react';
import * as exifr from 'exifr';
import api from '../utils/api';
import './BulkImportModal.css';

const AUTOFILL_TITLES = [
  'A moment frozen in time', 'Lost in the details', 'Light and shadow',
  'Unexpected discovery', 'A quiet afternoon', 'The journey there',
  'Colors of the day', 'Before the rain', 'Wandering aimlessly',
  'A familiar place', 'Something new', 'The world outside'
];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const MAX_FILES = 100;

function exifDateToInputDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().split('T')[0];
  const str = String(raw).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const d = new Date(str);
  return isNaN(d) ? null : d.toISOString().split('T')[0];
}

function inferMoodFromExif(exif) {
  const dt = exif.DateTimeOriginal || exif.DateTime;
  if (!dt) return null;
  const d = dt instanceof Date ? dt : new Date(String(dt).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'));
  if (isNaN(d)) return null;
  const hour = d.getHours();
  if (hour >= 5  && hour < 8)  return 'peaceful';
  if (hour >= 8  && hour < 12) return 'joyful';
  if (hour >= 12 && hour < 16) return 'excited';
  if (hour >= 16 && hour < 19) return 'adventurous';
  if (hour >= 19 && hour < 22) return 'nostalgic';
  return 'grateful';
}

function buildTitleFromExif(exif, location) {
  const dt = exif.DateTimeOriginal || exif.DateTime;
  let d = null;
  if (dt) {
    d = dt instanceof Date ? dt : new Date(String(dt).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'));
    if (isNaN(d)) d = null;
  }
  const hour = d ? d.getHours() : null;
  const month = d ? d.toLocaleDateString('en-US', { month: 'long' }) : null;

  const timeOfDay = hour == null ? null
    : hour < 6  ? 'before dawn'
    : hour < 10 ? 'morning'
    : hour < 13 ? 'midday'
    : hour < 17 ? 'afternoon'
    : hour < 20 ? 'evening'
    : 'night';

  if (location && timeOfDay && month) return `${month} ${timeOfDay} in ${location}`;
  if (location && timeOfDay)          return `A ${timeOfDay} in ${location}`;
  if (location && month)              return `${month} in ${location}`;
  if (timeOfDay && month)             return `${month} ${timeOfDay}`;
  if (location)                       return `A moment in ${location}`;
  return pickRandom(AUTOFILL_TITLES);
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    return a.village || a.town || a.city_district || a.suburb || a.city || a.county || a.state || a.country || null;
  } catch { return null; }
}

export default function BulkImportModal({ onClose, onComplete }) {
  const [items, setItems] = useState([]);
  const [importMode, setImportMode] = useState('multiple'); // 'multiple' | 'single'
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [limitWarning, setLimitWarning] = useState(false);
  const fileRef = useRef(null);

  const today = () => new Date().toISOString().split('T')[0];

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const compressImage = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = 1000; // Balanced speed/quality
        
        if (width > height && width > max) {
          height *= max / width;
          width = max;
        } else if (height > max) {
          width *= max / height;
          height = max;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.65)); // Restored quality
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const processFiles = async (rawFiles) => {
    setLimitWarning(false);
    let files = rawFiles;
    if (files.length > MAX_FILES) {
      setLimitWarning(true);
      files = files.slice(0, MAX_FILES);
    }
    setProcessing(true);
    const newItems = [];
    
    // Process in small parallel chunks for speed
    const batchSize = 3;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (file, idx) => {
        if (!file.type.startsWith('image/')) return null;
        
        // Extract EXIF
        let exifData = {};
        try {
          const exif = await exifr.parse(file, { tiff:true, exif:true, gps:true });
          if (exif) {
            exifData.date = exifDateToInputDate(exif.DateTimeOriginal || exif.DateTime);
            if (exif.latitude != null) {
              const place = await reverseGeocode(exif.latitude, exif.longitude);
              if (place) exifData.location = place;
            }
            exifData.title = buildTitleFromExif(exif, exifData.location);
          }
        } catch (e) {}

        const compressed = await compressImage(file);
        return {
          id: Math.random().toString(36).substr(2, 9),
          title: exifData.title || file.name.split('.')[0],
          date: exifData.date || today(),
          location: exifData.location || '',
          mood: inferMoodFromExif({}) || 'joyful',
          media: [{ url: compressed, type: 'image' }],
          description: '',
        };
      }));
      
      newItems.push(...results.filter(Boolean));
      setProgress(Math.round(((i + batch.length) / files.length) * 100));
    }

    setItems(prev => [...prev, ...newItems]);
    setProcessing(false);
    setProgress(0);
  };

  const [savedCount, setSavedCount] = useState(0);

  const handleSaveAll = async () => {
    setSaving(true);
    setProgress(0);
    setSavedCount(0);
    
    if (importMode === 'single') {
      // Combine all media into ONE memory
      const first = items[0];
      const combinedEvent = {
        ...first,
        title: first.title || 'Bulk Import Gallery',
        media: items.flatMap(item => item.media),
        description: `Batch import of ${items.length} photos.`
      };
      
      try {
        await api.post('/events', combinedEvent);
        setSavedCount(items.length);
        setProgress(100);
      } catch (e) {
        console.error("Failed to save combined event", e);
      }
    } else {
      // Individual processing for "Live" 1/10 counter
      for (let i = 0; i < items.length; i++) {
        try {
          await api.post('/events', items[i]);
          setSavedCount(i + 1);
          setProgress(Math.round(((i + 1) / items.length) * 100));
        } catch (e) {
          console.error("Failed to save item", i, e);
        }
      }
    }
    
    setSaving(false);
    onComplete();
  };

  return (
    <div className="bulk-modal-overlay animate-fadeIn">
      <div className="bulk-modal">
        <button className="bulk-close" onClick={onClose} disabled={processing || saving}>✕</button>
        
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', marginBottom: '8px' }}>
          Bulk Photo Import
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
          Drop multiple photos here. We'll automatically extract timestamps and locations to arrange them in your timeline.
        </p>

        {/* Limit warning */}
        {limitWarning && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px', padding: '10px 14px', marginBottom: '12px',
            color: '#ef4444', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center'
          }}>
            ⚠️ You selected more than 100 photos. Only the first <strong>100</strong> will be imported.
          </div>
        )}

        {/* Mode Selector */}
        {!items.length && !processing && (
          <div className="bulk-mode-selector">
            <label className={`bulk-mode-btn ${importMode === 'multiple' ? 'active' : ''}`}>
              <input type="radio" name="importMode" value="multiple" checked={importMode === 'multiple'} onChange={() => setImportMode('multiple')} />
              <div>
                <strong>Multiple Cards</strong>
                <span>Each photo becomes its own memory</span>
              </div>
            </label>
            <label className={`bulk-mode-btn ${importMode === 'single' ? 'active' : ''}`}>
              <input type="radio" name="importMode" value="single" checked={importMode === 'single'} onChange={() => setImportMode('single')} />
              <div>
                <strong>All In One Card</strong>
                <span>Group all photos into a single gallery</span>
              </div>
            </label>
          </div>
        )}

        {/* Dropzone */}
        {!items.length && !processing && (
          <div 
            className={`bulk-dropzone ${dragOver ? 'dragover' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              ref={fileRef} 
              style={{ display: 'none' }}
              onChange={e => processFiles(Array.from(e.target.files))}
            />
            <div className="bulk-drop-icon">📸</div>
            <h3>Drag & Drop Photos</h3>
            <p>or click to browse &mdash; <strong>max 100 photos</strong></p>
          </div>
        )}

        {/* Processing State */}
        {processing && (
          <div className="bulk-progress-state">
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <h3>Extracting EXIF Metadata...</h3>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <p>{progress}% complete</p>
          </div>
        )}

        {/* Saving State */}
        {saving && (
          <div className="bulk-progress-state">
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <h3>Syncing Memories...</h3>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <div style={{ 
              marginTop: '12px', 
              fontSize: '18px', 
              fontWeight: '700', 
              color: 'var(--accent-gold)',
              fontFamily: 'Playfair Display, serif'
            }}>
              {savedCount} <span style={{ opacity: 0.5, fontSize: '14px' }}>/ {items.length}</span>
            </div>
            <p>{progress}% complete</p>
          </div>
        )}

        {/* Preview Grid */}
        {items.length > 0 && !processing && !saving && (
          <>
            <div className="bulk-preview-grid">
              {items.map(item => (
                <div key={item.id} className="bulk-preview-card">
                  <div className="bulk-preview-img-wrap">
                    <img src={item.media[0].url} alt="" />
                    {item.media.length > 1 && (
                      <div className="bulk-preview-img-count">+{item.media.length - 1}</div>
                    )}
                  </div>
                  <div className="bulk-preview-info">
                    <input 
                      className="input bulk-inline-input" 
                      value={item.title} 
                      onChange={e => setItems(items.map(i => i.id === item.id ? { ...i, title: e.target.value } : i))}
                    />
                    <div className="bulk-preview-meta">
                      <input 
                        type="date" 
                        className="input bulk-inline-input small" 
                        value={item.date}
                        onChange={e => setItems(items.map(i => i.id === item.id ? { ...i, date: e.target.value } : i))}
                      />
                      {item.location && <span title={item.location}>📍 {item.location.split(',')[0]}</span>}
                    </div>
                  </div>
                  <button className="bulk-remove-item" onClick={() => setItems(items.filter(i => i.id !== item.id))}>✕</button>
                </div>
              ))}
            </div>

            <div className="bulk-actions">
              <button className="btn btn-ghost" onClick={() => setItems([])}>Clear All</button>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveAll}
                style={{ background: 'var(--accent-indigo)' }}
              >
                Save {items.length} Memories
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
