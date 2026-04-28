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
  const fileRef = useRef(null);

  const fileToDataUrl = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

  const processFiles = async (files) => {
    setProcessing(true);
    const newItems = [];
    
    if (importMode === 'single') {
      let firstExifData = null;
      const mediaList = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        setProgress(Math.round(((i) / files.length) * 100));
        
        // Extract EXIF from the very first photo that works
        if (!firstExifData) {
          try {
            const exif = await exifr.parse(file, { tiff: true, exif: true, gps: true, translateValues: true });
            if (exif) {
              firstExifData = {};
              const dateStr = exifDateToInputDate(exif.DateTimeOriginal || exif.DateTime);
              if (dateStr) firstExifData.date = dateStr;
              
              if (exif.latitude != null && exif.longitude != null) {
                firstExifData.coordinates = { lat: exif.latitude, lon: exif.longitude };
                const place = await reverseGeocode(exif.latitude, exif.longitude);
                if (place) firstExifData.location = place;
              }
              
              if (exif.Make || exif.Model) {
                firstExifData.camera = [exif.Make, exif.Model].filter(Boolean).join(' ').trim();
              }
              
              const mood = inferMoodFromExif(exif);
              if (mood) firstExifData.mood = mood;
              firstExifData.title = buildTitleFromExif(exif, firstExifData.location);
            }
          } catch (e) {
            // keep firstExifData null so it tries the next photo
          }
        }
        
        const base64 = await fileToDataUrl(file);
        mediaList.push({ url: base64, type: 'image' });
      }

      if (mediaList.length > 0) {
        newItems.push({
          id: Math.random().toString(36).substr(2, 9),
          title: firstExifData?.title || 'Photo Gallery',
          date: firstExifData?.date || new Date().toISOString().split('T')[0],
          location: firstExifData?.location || '',
          mood: firstExifData?.mood || 'joyful',
          coordinates: firstExifData?.coordinates || null,
          media: mediaList,
          color: '#c4813a',
          description: firstExifData?.camera ? `Captured with ${firstExifData.camera}` : '',
        });
      }
    } else {
      // Multiple mode
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        setProgress(Math.round(((i) / files.length) * 100));
        
        let exifData = {};
        try {
          const exif = await exifr.parse(file, { tiff: true, exif: true, gps: true, translateValues: true });
          if (exif) {
            const dateStr = exifDateToInputDate(exif.DateTimeOriginal || exif.DateTime);
            if (dateStr) exifData.date = dateStr;
            
            if (exif.latitude != null && exif.longitude != null) {
              exifData.coordinates = { lat: exif.latitude, lon: exif.longitude };
              const place = await reverseGeocode(exif.latitude, exif.longitude);
              if (place) exifData.location = place;
            }
            
            if (exif.Make || exif.Model) {
              exifData.camera = [exif.Make, exif.Model].filter(Boolean).join(' ').trim();
            }
            
            const mood = inferMoodFromExif(exif);
            if (mood) exifData.mood = mood;
            
            exifData.title = buildTitleFromExif(exif, exifData.location);
          }
        } catch (e) { }

        const base64 = await fileToDataUrl(file);
        
        newItems.push({
          id: Math.random().toString(36).substr(2, 9),
          title: exifData.title || file.name.split('.')[0],
          date: exifData.date || new Date().toISOString().split('T')[0],
          location: exifData.location || '',
          mood: exifData.mood || 'joyful',
          coordinates: exifData.coordinates || null,
          media: [{ url: base64, type: 'image' }],
          color: '#c4813a',
          description: exifData.camera ? `Captured with ${exifData.camera}` : '',
        });
      }
    }

    setItems(prev => [...prev, ...newItems]);
    setProcessing(false);
    setProgress(0);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length > 0) processFiles(Array.from(e.dataTransfer.files));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setProgress(0);
    
    // Staggered save to avoid locking browser/backend
    for (let i = 0; i < items.length; i++) {
      try {
        await api.post('/events', items[i]);
      } catch (err) {
        console.error('Failed to save item', items[i].title, err);
      }
      setProgress(Math.round(((i + 1) / items.length) * 100));
    }
    
    setSaving(false);
    onComplete(); // refresh timeline
  };

  return (
    <div className="bulk-modal-overlay animate-fadeIn">
      <div className="bulk-modal">
        <button className="bulk-close" onClick={onClose} disabled={processing || saving}>✕</button>
        
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', marginBottom: '8px' }}>
          Bulk Photo Import
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
          Drop multiple photos here. We'll automatically extract timestamps and locations to arrange them in your timeline.
        </p>

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
            <p>or click to browse</p>
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
            <h3>Saving to Timeline...</h3>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
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
