import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import './InstantCameraModal.css';

const today = () => new Date().toISOString().split('T')[0];

export default function InstantCameraModal({ onClose, onComplete }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [phase, setPhase] = useState('camera'); // 'camera' | 'preview' | 'form' | 'saving' | 'done'
  const [capturedImage, setCapturedImage] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // back camera by default
  const [cameraError, setCameraError] = useState(null);
  const [form, setForm] = useState({
    title: '',
    date: today(),
    location: '',
    mood: 'joyful',
  });
  const [saving, setSaving] = useState(false);

  const startCamera = useCallback(async (mode) => {
    // Stop any existing stream first
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
      setCameraError('Camera access denied or not available on this device.');
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [facingMode, startCamera]);

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
    
    // Mirror if front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);

    // Stop camera stream to free resources
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());

    setPhase('preview');
  };

  const retake = () => {
    setCapturedImage(null);
    setPhase('camera');
    startCamera(facingMode);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setPhase('saving');
    try {
      // Compress image before upload
      const compressedBase64 = await compressDataUrl(capturedImage);
      const uploadRes = await api.post('/upload', { base64: compressedBase64, filename: `instant_${Date.now()}.jpg` });
      
      await api.post('/events', {
        title: form.title,
        date: form.date,
        location: form.location,
        mood: form.mood,
        media: [{ url: uploadRes.data.url, type: 'image' }],
        color: '#c4813a',
      });

      setPhase('done');
      setTimeout(() => {
        onComplete();
      }, 1200);
    } catch (err) {
      setSaving(false);
      setPhase('form');
    }
  };

  return (
    <div className="icam-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="icam-modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
      >
        {/* Header */}
        <div className="icam-header">
          <div className="icam-title">
            <span className="icam-title-icon">📸</span>
            Instant Memory
          </div>
          <button className="icam-close" onClick={onClose}>✕</button>
        </div>

        {/* Camera Phase */}
        <AnimatePresence mode="wait">
          {phase === 'camera' && (
            <motion.div key="camera" className="icam-camera-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {cameraError ? (
                <div className="icam-error">
                  <span>📵</span>
                  <p>{cameraError}</p>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`icam-video ${facingMode === 'user' ? 'mirrored' : ''}`}
                />
              )}
              <div className="icam-controls">
                <button className="icam-flip-btn" onClick={flipCamera} title="Flip camera">🔄</button>
                <button className="icam-shutter" onClick={capture} disabled={!!cameraError}>
                  <div className="icam-shutter-ring">
                    <div className="icam-shutter-core" />
                  </div>
                </button>
                <div style={{ width: 44 }} />
              </div>
            </motion.div>
          )}

          {phase === 'preview' && (
            <motion.div key="preview" className="icam-preview-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <img src={capturedImage} alt="Captured" className="icam-preview-img" />
              <div className="icam-preview-actions">
                <button className="btn btn-ghost" onClick={retake}>↩ Retake</button>
                <button className="btn btn-primary" onClick={() => setPhase('form')}>
                  Use This Photo →
                </button>
              </div>
            </motion.div>
          )}

          {phase === 'form' && (
            <motion.div key="form" className="icam-form-wrap" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <img src={capturedImage} alt="" className="icam-form-thumb" />
              <div className="form-group">
                <label className="input-label">Memory Title *</label>
                <input
                  className="input"
                  placeholder="What happened here?"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="icam-form-row">
                <div className="form-group">
                  <label className="input-label">Date</label>
                  <input type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="input-label">Mood</label>
                  <select className="input" value={form.mood} onChange={e => setForm({ ...form, mood: e.target.value })}>
                    {['joyful','nostalgic','proud','sad','excited','peaceful','grateful','adventurous'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="input-label">Location</label>
                <input className="input" placeholder="Where was this?" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="icam-form-footer">
                <button className="btn btn-ghost" onClick={() => setPhase('preview')}>← Back</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={!form.title.trim()}>
                  Save Memory ✦
                </button>
              </div>
            </motion.div>
          )}

          {phase === 'saving' && (
            <motion.div key="saving" className="icam-status" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="spinner" />
              <p>Saving your memory...</p>
            </motion.div>
          )}

          {phase === 'done' && (
            <motion.div key="done" className="icam-status icam-done" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
              <span className="icam-done-icon">✦</span>
              <p>Memory saved!</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </motion.div>
    </div>
  );
}

// Compress a dataURL to reduce upload size
async function compressDataUrl(dataUrl, maxWidth = 1600, quality = 0.82) {
  return new Promise(resolve => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) { height = (maxWidth / width) * height; width = maxWidth; }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
  });
}
