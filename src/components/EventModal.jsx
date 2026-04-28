import { useState, useRef } from 'react';
import * as exifr from 'exifr';
import api from '../utils/api';
import { sentimentScore, sentimentToMood } from '../utils/memoryUtils';
import { detectFocalPoint } from '../utils/faceUtils';
import { getMoods, addCustomMood } from '../utils/moodProvider';
import { pipeline, env } from '@xenova/transformers';
import './EventModal.css';

// Disable local models to force CDN
env.allowLocalModels = false;
env.useBrowserCache = true;

const COLORS = ['#c4813a','#c46080','#5b72c4','#6b8f71','#e8a85a','#8b5cf6','#06b6d4','#ef4444'];

const today = () => new Date().toISOString().split('T')[0];

/* ── Random autofill pools (fallback when no EXIF) ── */
const AUTOFILL_TITLES = [
  'The morning everything changed', 'Last light at the lake',
  'Found myself in a stranger\'s kindness', 'The road that had no name',
  'Dancing until the city woke up', 'A quiet victory nobody saw',
  'Letters I never sent', 'The day the sky turned amber',
  'Coffee and a conversation I\'ll keep forever', 'Seventeen stops on the wrong train',
  'The night the stars felt close', 'Arriving somewhere I\'d only dreamed about',
  'Learning to let go in slow motion', 'First attempt, first failure, first laugh',
  'A photograph I didn\'t take', 'The celebration that crept up on me',
  'Two a.m. and a revelation', 'That summer between everything',
  'Saying yes when I almost said no', 'The long way home turned into the best way',
  'A moment I want to live inside forever', 'Reunited after all that time',
  'The project that kept me up for weeks', 'When the music made everything make sense',
  'Cooking grandma\'s recipe for the first time', 'Watching the storm roll in from the porch',
  'New city, no plan, wide open', 'The kindest argument I\'ve ever had',
  'Building something with my hands', 'A weekend that felt like a whole season',
  'Finishing what I started a year ago', 'The book that rewired my brain',
  'Rain on the roof and nowhere to be', 'Meeting someone who saw me clearly',
  'Sunrise after a sleepless night', 'Learning the language of a new place',
  'An ordinary Tuesday that wasn\'t', 'Milestone reached in silence',
  'The last summer together',
];

const AUTOFILL_LOCATIONS = [
  'Rooftop, unknown city', 'Back garden', 'Train window seat', 'Lakeside trail',
  'Old café on the corner', 'Airport gate 14', 'Hilltop at dusk', 'Home, finally',
  'Grandmother\'s kitchen', 'Hotel balcony', '', '', '', '',
];

const AUTOFILL_TAGS = [
  ['travel', 'adventure'], ['milestone', 'growth'], ['family', 'warmth'],
  ['friendship', 'joy'], ['solitude', 'reflection'], ['music', 'feeling'],
  ['food', 'memory'], ['nature', 'peace'], ['city', 'night'], ['work', 'proud'],
];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ── EXIF helpers ── */

/** Parse DateTimeOriginal (e.g. "2023:07:14 18:32:00") → "2023-07-14" */
function exifDateToInputDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().split('T')[0];
  const str = String(raw).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const d = new Date(str);
  return isNaN(d) ? null : d.toISOString().split('T')[0];
}

/** Infer a vibe from hour of day & camera model hints */
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

/** Build a poetic title from EXIF data */
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

/** Reverse-geocode GPS coords via OpenStreetMap Nominatim (free, no API key) */
async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    // Build a readable place name from most specific to least
    return (
      a.village || a.town || a.city_district || a.suburb ||
      a.city || a.county || a.state || a.country || null
    );
  } catch {
    return null;
  }
}

/** Full EXIF read for a single File object → returns extracted fields */
async function extractExifFromFile(file) {
  try {
    const exif = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      iptc: true,
      xmp: true,
      reviveValues: true,
      translateValues: true
    });
    if (!exif) return null;

    const result = { raw: exif, found: [] };

    // Date - check multiple possible EXIF date fields
    const rawDate = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate || exif.DateTime;
    const dateStr = exifDateToInputDate(rawDate);
    if (dateStr) { result.date = dateStr; result.found.push('date'); }

    // GPS → reverse geocode
    if (exif.latitude != null && exif.longitude != null) {
      result.gps = { lat: exif.latitude, lon: exif.longitude };
      const place = await reverseGeocode(exif.latitude, exif.longitude);
      if (place) { result.location = place; result.found.push('location'); }
    }

    // Metadata Title & Description
    const metaTitle = exif.XPTitle || exif.ObjectName || exif.Title;
    const metaDesc = exif.ImageDescription || exif.UserComment || exif.Caption || exif.XPSubject || exif.XPComment;

    if (metaTitle) { result.title = metaTitle; result.found.push('title'); }
    if (metaDesc) { result.description = metaDesc; result.found.push('description'); }

    // Camera model (for fun, we tag it)
    if (exif.Make || exif.Model) {
      const cam = [exif.Make, exif.Model].filter(Boolean).join(' ').trim();
      result.camera = cam;
    }

    // Infer mood
    const mood = inferMoodFromExif(exif);
    if (mood) { result.mood = mood; result.found.push('vibe'); }

    // Build title (if not found in metadata)
    if (!result.title) {
      result.title = buildTitleFromExif(exif, result.location || null);
      result.found.push('title (auto)');
    }

    return result;
  } catch (e) {
    return null;
  }
}

/* ══════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════ */
export default function EventModal({ event, onSubmit, onClose, allPeople = [] }) {
  const [form, setForm] = useState({
    title:       event?.title || '',
    description: event?.description || '',
    date:        event?.date ? new Date(event.date).toISOString().split('T')[0] : today(),
    location:    event?.location || '',
    mood:        event?.mood || 'joyful',
    tags:        event?.tags?.join(', ') || '',
    color:       event?.color || '#c4813a',
    isPrivate:   event?.isPrivate || false,
    media:       event?.media || [],
    people:      event?.people || [],
    audioUrl:    event?.audioUrl || '',
    unlockDate:  event?.unlockDate ? new Date(event.unlockDate).toISOString().split('T')[0] : '',
    coordinates: event?.coordinates || null,
    type:        event?.type || 'event',
    biometrics:  event?.biometrics || { heartRate: null, stressLevel: null },
    collaborators: event?.collaborators || [],
  });
  const [tagInput,      setTagInput]      = useState(event?.tags?.join(', ') || '');
  const [personInput,   setPersonInput]   = useState('');
  const [personSuggest, setPersonSuggest] = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,       setError]       = useState('');
  const [autofilled,  setAutofilled]  = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  // EXIF state
  const [exifScan,     setExifScan]     = useState(false);   // scanning in progress
  const [exifBanner,   setExifBanner]   = useState(null);    // { found: [], camera? }
  const [exifApplied,  setExifApplied]  = useState(false);
  const [autoExif,     setAutoExif]     = useState(true); // Default to auto

  const fileRef = useRef(null);
  const [moods, setMoods] = useState(getMoods());
  const [showCustomMood, setShowCustomMood] = useState(false);
  const [newMood, setNewMood] = useState({ emoji: '✨', label: '' });

  const handleAddMood = () => {
    if (!newMood.label.trim()) return;
    const value = newMood.label.toLowerCase().replace(/\s+/g, '-');
    const moodObj = { 
      value, 
      label: newMood.label, 
      emoji: newMood.emoji,
      color: pickRandom(COLORS)
    };
    if (addCustomMood(moodObj)) {
      setMoods(getMoods());
      setForm(f => ({ ...f, mood: value }));
      setShowCustomMood(false);
      setNewMood({ emoji: '✨', label: '' });
    }
  };

  const [dragOver, setDragOver] = useState(false);

  /* ── Random autofill ── */
  const handleAutofill = () => {
    const mood = pickRandom(MOODS).value;
    const title = pickRandom(AUTOFILL_TITLES);
    const location = pickRandom(AUTOFILL_LOCATIONS);
    const tags = pickRandom(AUTOFILL_TAGS);
    const colorIdx = MOODS.findIndex(m => m.value === mood);
    const color = COLORS[colorIdx % COLORS.length];
    setForm(f => ({ ...f, title, date: today(), mood, location, color }));
    setTagInput(tags.join(', '));
    flashAutofill();
  };

  const flashAutofill = () => {
    setAutofilled(true);
    setTimeout(() => setAutofilled(false), 1200);
  };

  /* ── Apply EXIF data from banner ── */
  const applyExif = (exifData) => {
    setForm(f => ({
      ...f,
      ...(exifData.date     ? { date: exifData.date } : {}),
      ...(exifData.location ? { location: exifData.location } : {}),
      ...(exifData.gps      ? { coordinates: exifData.gps } : {}),
      ...(exifData.mood     ? { mood: exifData.mood } : {}),
      ...(exifData.title    ? { title: exifData.title } : {}),
      ...(exifData.description && !f.description ? { description: exifData.description } : {}),
    }));
    setExifApplied(true);
    setExifBanner(null);
    flashAutofill();
  };

  /* ── File handler with EXIF scan ── */
  const handleFile = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    setExifBanner(null);
    setExifApplied(false);

    // Scan first image for EXIF (do this in parallel with upload)
    const firstImage = [...files].find(f => f.type.startsWith('image/'));
    let exifDataPending = null;

    if (firstImage) { 
      setExifScan(true);
      exifDataPending = extractExifFromFile(firstImage); // promise
    }

    // Upload loop
    const newMedia = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      await new Promise(resolve => {
        reader.onload = async (e) => {
          try {
            const res = await api.post('/upload', { base64: e.target.result, filename: file.name });
            
            // Detect faces for auto-focus/crop
            const focalPoint = await detectFocalPoint(e.target.result);
            
            newMedia.push({
              ...res.data,
              focalPoint
            });
          } catch (err) {
            console.error("Upload/Detection failed", err);
          }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    setForm(f => ({ ...f, media: [...f.media, ...newMedia] }));
    setUploading(false);

    // Await EXIF result
    if (exifDataPending) {
      const exifData = await exifDataPending;
      setExifScan(false);
      if (exifData && exifData.found.length > 0) {
        // If autoExif is on and it's a new memory, apply automatically
        if (autoExif && !event) {
          applyExif(exifData);
        } else {
          setExifBanner(exifData);
        }
      }
    }
  };

  const removeMedia = (idx) => {
    setForm(f => ({ ...f, media: f.media.filter((_, i) => i !== idx) }));
  };

  /* ── People helpers ── */
  const addPerson = (name) => {
    const n = name.trim();
    if (!n || form.people.includes(n)) return;
    setForm(f => ({ ...f, people: [...f.people, n] }));
    setPersonInput('');
    setPersonSuggest(false);
  };
  const removePerson = (name) => setForm(f => ({ ...f, people: f.people.filter(p => p !== name) }));
  const suggestions = allPeople.filter(p => p.toLowerCase().includes(personInput.toLowerCase()) && !form.people.includes(p));

  const handleAutoDescribe = async () => {
    if (!form.media || form.media.length === 0) return;
    
    setAiGenerating(true);
    try {
      // 1. Generate AI caption
      const captioner = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning');
      const result = await captioner(form.media[0].url);
      
      let aiCaption = '';
      if (result && result.length > 0 && result[0].generated_text) {
        aiCaption = result[0].generated_text.trim();
      }

      // 2. Build cohesive statement from people's names and AI caption
      let fullDescription = '';
      const peopleList = form.people.length > 0 
        ? (form.people.length === 1 ? form.people[0] : `${form.people.slice(0, -1).join(', ')} and ${form.people.slice(-1)}`)
        : null;

      if (peopleList && aiCaption) {
        // Try to merge naturally
        const lowerCaption = aiCaption.toLowerCase();
        if (lowerCaption.includes('people') || lowerCaption.includes('person') || lowerCaption.includes('group')) {
          // Replace generic people references with names
          fullDescription = aiCaption.replace(/a group of people|people|a person|someone/gi, peopleList);
        } else {
          fullDescription = `${peopleList} in a moment involving ${lowerCaption}.`;
        }
      } else if (peopleList) {
        fullDescription = `A special moment shared with ${peopleList}.`;
      } else if (aiCaption) {
        fullDescription = aiCaption.charAt(0).toUpperCase() + aiCaption.slice(1) + '.';
      }

      if (fullDescription) {
        // Clean up formatting
        fullDescription = fullDescription.charAt(0).toUpperCase() + fullDescription.slice(1);
        if (!fullDescription.endsWith('.')) fullDescription += '.';

        setForm(prev => ({ 
          ...prev, 
          description: prev.description ? `${prev.description}\n\n${fullDescription}` : fullDescription 
        }));
      }
    } catch (err) {
      console.error("AI Magic failed", err);
    }
    setAiGenerating(false);
  };

  const handleMagicAutofill = async () => {
    setAiGenerating(true);
    try {
      // 1. Basic EXIF/Random autofill first
      handleAutofill();

      // 2. If image exists, describe it
      if (form.media?.length > 0) {
        await handleAutoDescribe();
      }

      // 3. Auto-detect mood after description is updated
      setTimeout(() => {
        setForm(prev => {
          const score = sentimentScore(prev.description);
          return { ...prev, mood: sentimentToMood(score) };
        });
      }, 500);

    } catch (err) {
      console.error("Magic Autofill failed", err);
    }
    setAiGenerating(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) { setError('Title and date are required'); return; }
    setLoading(true);
    setError('');
    try {
      const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
      await onSubmit({ ...form, tags });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal-content event-modal ${autofilled ? 'autofilled' : ''}`}>

        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title font-display">
            {event ? 'Edit Memory' : 'Add a Memory'}
          </h2>
          <div className="modal-header-actions" style={{ gap: '12px' }}>
            <button
              type="button"
              className={`btn btn-primary btn-sm magic-btn ${aiGenerating ? 'loading' : ''}`}
              onClick={handleMagicAutofill}
              disabled={aiGenerating}
              style={{ 
                background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-rose))',
                border: 'none',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '12px',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}
            >
              {aiGenerating ? '🪄 AI Thinking...' : '🪄 Magic Autofill'}
            </button>
            <button className="modal-close btn btn-ghost btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* EXIF scanning indicator */}
        {exifScan && (
          <div className="exif-scanning">
            <span className="exif-scanning-dot" />
            <span>Reading photo metadata…</span>
          </div>
        )}

        {/* EXIF banner — shown after scan, before user applies */}
        {exifBanner && (
          <div className="exif-banner animate-in">
            <div className="exif-banner-left">
              <span className="exif-banner-icon">🪄</span>
              <div>
                <div className="exif-banner-title">Metadata sync available</div>
                <div className="exif-banner-fields">
                  {exifBanner.found.map(f => (
                    <span key={f} className="exif-field-chip">{f}</span>
                  ))}
                  {exifBanner.camera && (
                    <span className="exif-camera-chip">📸 {exifBanner.camera}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="exif-banner-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => applyExif(exifBanner)}
                style={{ background: 'var(--accent-indigo)', color: 'white' }}
              >
                Sync & Apply
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setExifBanner(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* Memory Type Selector (Dream vs Real) */}
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <div className="type-toggle-container">
              <button 
                type="button" 
                className={`type-btn ${form.type === 'event' ? 'active' : ''}`}
                onClick={() => setForm(f => ({ ...f, type: 'event' }))}
              >
                ☀️ Real Moment
              </button>
              <button 
                type="button" 
                className={`type-btn ${form.type === 'dream' ? 'active' : ''} type-btn-dream`}
                onClick={() => setForm(f => ({ ...f, type: 'dream' }))}
              >
                🌙 Dream Log
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="form-group">
            <label className="input-label">Title *</label>
            <input
              className={`input ${autofilled ? 'input-autofilled' : ''}`}
              type="text"
              placeholder="What happened?"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
              maxLength={100}
            />
          </div>

          {/* Date & Location */}
          <div className="modal-row">
            <div className="form-group">
              <label className="input-label">Date *</label>
              <input
                className={`input ${autofilled ? 'input-autofilled' : ''}`}
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="input-label">Location</label>
              <input
                className={`input ${autofilled ? 'input-autofilled' : ''}`}
                type="text"
                placeholder="Where were you?"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              />
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="input-label" style={{ margin: 0 }}>Description</label>
              {form.media?.length > 0 && (
                <button 
                  type="button" 
                  className="btn btn-ghost btn-sm" 
                  onClick={handleAutoDescribe}
                  disabled={aiGenerating}
                  style={{ color: 'var(--accent-indigo)', fontSize: '12px', padding: '4px 8px' }}
                >
                  {aiGenerating ? '✨ AI is thinking...' : '✨ Auto-Describe Image'}
                </button>
              )}
            </div>
            <textarea
              className="input"
              placeholder="Tell the story of this moment…"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={4}
            />
          </div>

          {/* Mood */}
          <div className="form-group">
            <div className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Vibe / Mood</span>
              <button 
                type="button" 
                className="btn btn-ghost btn-sm" 
                style={{ fontSize: '11px', padding: '2px 8px' }}
                onClick={() => {
                  const score = sentimentScore(form.description);
                  const newMood = sentimentToMood(score);
                  setForm(f => ({ ...f, mood: newMood }));
                }}
                title="Detect mood from description"
              >
                ✨ Auto-detect
              </button>
            </div>
            <div className="mood-grid">
              {moods.map(m => (
                <button
                  key={m.value}
                  type="button"
                  className={`mood-btn ${form.mood === m.value ? 'active' : ''} ${autofilled && form.mood === m.value ? 'mood-btn--autofilled' : ''}`}
                  onClick={() => setForm(f => ({ ...f, mood: m.value }))}
                  title={m.label}
                >
                  <span className="mood-emoji">{m.emoji}</span>
                  <span className="mood-label">{m.label}</span>
                </button>
              ))}
              <button
                type="button"
                className={`mood-btn add-mood-btn ${showCustomMood ? 'active' : ''}`}
                onClick={() => setShowCustomMood(!showCustomMood)}
              >
                <span className="mood-emoji">➕</span>
                <span className="mood-label">New</span>
              </button>
            </div>

            {showCustomMood && (
              <div className="custom-mood-input animate-in">
                <input 
                  type="text" 
                  placeholder="Emoji (e.g. 🦊)" 
                  className="mood-emoji-input"
                  value={newMood.emoji}
                  onChange={e => setNewMood(n => ({ ...n, emoji: e.target.value }))}
                  maxLength={2}
                />
                <input 
                  type="text" 
                  placeholder="Mood name..." 
                  className="mood-label-input"
                  value={newMood.label}
                  onChange={e => setNewMood(n => ({ ...n, label: e.target.value }))}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={handleAddMood}>Add</button>
              </div>
            )}
          </div>

          {/* Color */}
          <div className="form-group">
            <label className="input-label">Card Color</label>
            <div className="color-picker">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-dot ${form.color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                />
              ))}
            </div>
          </div>

          {/* Biometric Sync (Idea 6) */}
          <div className="form-group advanced-section">
            <label className="input-label">💓 Biometric Vibe Sync</label>
            <div className="biometric-row">
              <div className="bio-input-wrap">
                <span className="bio-icon">❤️</span>
                <input 
                  type="number" 
                  placeholder="BPM"
                  value={form.biometrics.heartRate || ''} 
                  onChange={e => setForm(f => ({ ...f, biometrics: { ...f.biometrics, heartRate: e.target.value } }))}
                />
              </div>
              <div className="bio-input-wrap">
                <span className="bio-icon">🔥</span>
                <input 
                  type="number" 
                  placeholder="Stress %"
                  value={form.biometrics.stressLevel || ''} 
                  onChange={e => setForm(f => ({ ...f, biometrics: { ...f.biometrics, stressLevel: e.target.value } }))}
                />
              </div>
              <button 
                type="button" 
                className="btn btn-ghost btn-sm bio-sync-btn"
                onClick={() => {
                  // Simulate watch sync
                  setForm(f => ({ 
                    ...f, 
                    biometrics: { 
                      heartRate: Math.floor(Math.random() * (120 - 65) + 65),
                      stressLevel: Math.floor(Math.random() * 40)
                    } 
                  }));
                }}
              >
                🔄 Sync Watch
              </button>
            </div>
          </div>

          {/* Memory Portal / Collaborators (Idea 7) */}
          <div className="form-group advanced-section">
            <label className="input-label">🌌 Memory Portal (Collaborators)</label>
            <div className="portal-input-row">
              <input 
                type="text" 
                className="input"
                placeholder="Invite friend by username..."
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const name = e.target.value.trim();
                    if (name && !form.collaborators.includes(name)) {
                      setForm(f => ({ ...f, collaborators: [...f.collaborators, name] }));
                      e.target.value = '';
                    }
                  }
                }}
              />
            </div>
            {form.collaborators.length > 0 && (
              <div className="collaborator-list">
                {form.collaborators.map(c => (
                  <span key={c} className="collaborator-pill">
                    @{c} <button type="button" onClick={() => setForm(f => ({ ...f, collaborators: f.collaborators.filter(col => col !== c) }))}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="form-group">
            <label className="input-label">Tags (comma separated)</label>
            <input
              className={`input ${autofilled ? 'input-autofilled' : ''}`}
              type="text"
              placeholder="travel, milestone, family…"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
            />
          </div>

          {/* People */}
          <div className="form-group">
            <label className="input-label">People in this memory
              <span className="input-label-hint">— type a name, press Enter</span>
            </label>
            {/* Chips */}
            {form.people.length > 0 && (
              <div className="people-chips">
                {form.people.map(name => (
                  <span key={name} className="people-chip">
                    <span className="people-chip-avatar">{name.charAt(0).toUpperCase()}</span>
                    {name}
                    <button type="button" className="people-chip-remove" onClick={() => removePerson(name)}>✕</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type="text"
                placeholder="Add a name…"
                value={personInput}
                onChange={e => { setPersonInput(e.target.value); setPersonSuggest(true); }}
                onFocus={() => setPersonSuggest(true)}
                onBlur={() => setTimeout(() => setPersonSuggest(false), 150)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); addPerson(personInput); }
                  if (e.key === ',')     { e.preventDefault(); addPerson(personInput); }
                }}
              />
              {/* Suggestions dropdown */}
              {personSuggest && suggestions.length > 0 && (
                <div className="people-suggestions">
                  {suggestions.map(s => (
                    <button key={s} type="button" className="people-suggestion-item" onMouseDown={() => addPerson(s)}>
                      <span className="people-chip-avatar">{s.charAt(0).toUpperCase()}</span>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Media upload */}
          <div className="form-group">
            <label className="input-label">
              Photos
              <span className="input-label-hint">— drop a photo to auto-read its metadata</span>
            </label>
            <div
              className={`media-dropzone ${dragOver ? 'drag-over' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files); }}
            >
              {uploading ? (
                <span className="media-uploading">Uploading…</span>
              ) : (
                <>
                  <span className="media-icon">📷</span>
                  <span>Drop photos here or click to browse</span>
                  <div className="media-exif-control" onClick={e => e.stopPropagation()}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <input 
                        type="checkbox" 
                        checked={autoExif} 
                        onChange={e => setAutoExif(e.target.checked)} 
                      />
                      Auto-sync metadata (Date, Location, Title)
                    </label>
                  </div>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files)}
              />
            </div>

            {form.media.length > 0 && (
              <div className="media-preview-container">
                <label className="input-label-hint" style={{ marginBottom: '8px', display: 'block' }}>
                  🎯 Click on the image to set the crop focus
                </label>
                <div className="media-preview">
                  {form.media.map((m, i) => (
                    <div 
                      key={i} 
                      className="media-preview-item focal-point-target"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                        const y = ((e.clientY - rect.top) / rect.height) * 100;
                        const newMedia = [...form.media];
                        newMedia[i] = { ...newMedia[i], focalPoint: { x, y } };
                        setForm(f => ({ ...f, media: newMedia }));
                      }}
                    >
                      <img 
                        src={m.url} 
                        alt="" 
                        style={{ 
                          objectPosition: `${m.focalPoint?.x || 50}% ${m.focalPoint?.y || 50}%` 
                        }} 
                      />
                      <div 
                        className="focal-point-marker"
                        style={{ 
                          left: `${m.focalPoint?.x || 50}%`, 
                          top: `${m.focalPoint?.y || 50}%` 
                        }}
                      />
                      <button type="button" className="media-remove" onClick={(e) => { e.stopPropagation(); removeMedia(i); }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Vault & Future Lock */}
          <div className="form-group-row" style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label className="toggle-label" style={{ marginTop: '24px' }}>
                <input
                  type="checkbox"
                  checked={form.isPrivate}
                  onChange={e => setForm(f => ({ ...f, isPrivate: e.target.checked }))}
                />
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong>🔒 Private (Vault)</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Hide behind PIN</span>
                </span>
              </label>
            </div>

            <div style={{ flex: 1 }}>
              <label className="input-label">⏳ Future Lock (Unlock Date)</label>
              <input
                type="date"
                className="input"
                value={form.unlockDate}
                onChange={e => setForm(f => ({ ...f, unlockDate: e.target.value }))}
                min={today()}
              />
            </div>
          </div>

          {/* Voice Note (Base64 for Demo) */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="input-label">🎙️ Voice Note URL (Base64 or Link)</label>
            <input
              type="text"
              className="input"
              placeholder="Paste audio URL or Base64 data..."
              value={form.audioUrl}
              onChange={e => setForm(f => ({ ...f, audioUrl: e.target.value }))}
            />
            {form.audioUrl && (
              <audio controls src={form.audioUrl} style={{ width: '100%', marginTop: '8px', height: '36px' }} />
            )}
          </div>

          {error && <div className="auth-error" style={{ marginBottom: '16px' }}><span>⚠</span> {error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '…' : event ? 'Save Changes' : 'Add Memory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
