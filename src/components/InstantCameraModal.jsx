import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { sentimentScore, sentimentToMood } from '../utils/memoryUtils';
import './InstantCameraModal.css';

const today = () => new Date().toISOString().split('T')[0];

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    return (
      a.village || a.town || a.city_district || a.suburb ||
      a.city || a.county || a.state || a.country || null
    );
  } catch {
    return null;
  }
}

export default function InstantCameraModal({ onClose, onComplete }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [phase, setPhase] = useState('camera'); // 'camera' | 'preview' | 'form' | 'saving' | 'done'
  const [capturedImage, setCapturedImage] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); 
  const [cameraError, setCameraError] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: today(),
    location: '',
    mood: 'joyful',
    tags: ''
  });
  const [saving, setSaving] = useState(false);

  const startCamera = useCallback(async (mode) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setCameraError('Camera access denied or not available.');
    }
  }, []);

  useEffect(() => {
    if (phase === 'camera') startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [facingMode, startCamera, phase]);

  const flipCamera = () => {
    setFacingMode(m => m === 'environment' ? 'user' : 'environment');
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0);
    const data = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(data);
    setPhase('preview');

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  const saveMemory = async () => {
    setSaving(true);
    setPhase('saving');
    try {
      const sentiment = sentimentScore(form.description || form.title);
      const mood = form.mood || sentimentToMood(sentiment);
      
      const payload = {
        title: form.title || 'Instant Memory',
        description: form.description,
        date: form.date,
        location: form.location,
        mood,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        image: capturedImage
      };

      await api.post('/memories', payload);
      setPhase('done');
      setTimeout(() => {
        onComplete?.();
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Save failed', err);
      setPhase('form');
    }
    setSaving(false);
  };

  return (
    <AnimatePresence>
      <motion.div 
        className="icam-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div 
          className="icam-modal"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          {/* Header */}
          <div className="icam-header">
            <h2 className="icam-title">
              <span className="icam-title-icon">📸</span>
              Instant Memory
            </h2>
            <button className="icam-close" onClick={onClose}>✕</button>
          </div>

          {phase === 'camera' && (
            <div className="icam-camera-wrap">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className={`icam-video ${facingMode === 'user' ? 'mirrored' : ''}`}
              />
              <div className="icam-bottom-ui">
                <div className="icam-controls">
                  <div style={{ width: 50 }} /> 
                  <button className="icam-shutter" onClick={capture}>
                    <div className="icam-shutter-ring">
                      <div className="icam-shutter-core" />
                    </div>
                  </button>
                  <button className="icam-flip-btn" onClick={flipCamera}>🔄</button>
                </div>
              </div>
            </div>
          )}

          {phase === 'preview' && (
            <div className="icam-camera-wrap">
              <img src={capturedImage} className="icam-video" alt="Captured" />
              <div className="icam-bottom-ui">
                <div className="icam-controls">
                  <button onClick={() => setPhase('camera')} style={{ background:'rgba(255,255,255,0.1)', color:'#fff', padding:'14px 28px', borderRadius:16, border:'none', cursor:'pointer' }}>Retake</button>
                  <button className="icam-btn-save" onClick={() => setPhase('form')}>Use Photo</button>
                </div>
              </div>
            </div>
          )}

          {phase === 'form' && (
            <div className="icam-form-wrap">
              <div className="icam-form-group">
                <label className="icam-form-label">Memory Title</label>
                <input 
                  className="icam-input-large" 
                  placeholder="What happened?"
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                />
              </div>

              <div className="icam-form-group">
                <label className="icam-form-label">Description</label>
                <textarea 
                  className="icam-input-large icam-textarea" 
                  placeholder="Tell the story..."
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div className="icam-form-group">
                  <label className="icam-form-label">Date</label>
                  <input 
                    type="date"
                    className="icam-input-large" 
                    value={form.date}
                    onChange={e => setForm({...form, date: e.target.value})}
                  />
                </div>
                <div className="icam-form-group">
                  <label className="icam-form-label">Location</label>
                  <input 
                    className="icam-input-large" 
                    placeholder="Where?"
                    value={form.location}
                    onChange={e => setForm({...form, location: e.target.value})}
                  />
                </div>
              </div>

              <div className="icam-form-group">
                <label className="icam-form-label">How did it feel?</label>
                <div className="icam-mood-grid">
                  {['joyful', 'nostalgic', 'peaceful', 'excited', 'melancholy', 'surprised'].map(m => (
                    <button 
                      key={m}
                      className={`icam-mood-btn ${form.mood === m ? 'active' : ''}`}
                      onClick={() => setForm({...form, mood: m})}
                    >
                      <span style={{fontSize:24}}>{
                        m === 'joyful' ? '😊' : m === 'nostalgic' ? '📜' : m === 'peaceful' ? '🕊️' : 
                        m === 'excited' ? '✨' : m === 'melancholy' ? '🍂' : '😲'
                      }</span>
                      <span style={{fontSize:11, textTransform:'capitalize', fontWeight:600}}>{m}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="icam-form-group" style={{ marginBottom: 120 }}>
                <label className="icam-form-label">Tags (comma separated)</label>
                <input 
                  className="icam-input-large" 
                  placeholder="travel, family, food..."
                  value={form.tags}
                  onChange={e => setForm({...form, tags: e.target.value})}
                />
              </div>

              <div className="icam-save-bar">
                <button className="icam-btn-save" onClick={saveMemory} disabled={saving}>
                  {saving ? 'Preserving Memory...' : 'Save to Timeline'}
                </button>
              </div>
            </div>
          )}

          {phase === 'saving' && (
            <div className="icam-status">
              <div className="animate-spin" style={{ fontSize:50 }}>✨</div>
              <p style={{ fontSize:18, fontWeight:500 }}>Preserving your memory in the stars...</p>
            </div>
          )}

          {phase === 'done' && (
            <div className="icam-status">
              <div className="icam-done-icon">✨</div>
              <h3 style={{ fontFamily:'Playfair Display', fontSize:28, color:'#fff' }}>Memory Captured</h3>
              <p style={{ fontSize:16, color:'var(--text-muted)' }}>Your story has been preserved in the cosmic timeline.</p>
            </div>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
