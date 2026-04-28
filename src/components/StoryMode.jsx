import { useState, useEffect, useRef } from 'react';
import './StoryMode.css';

const MOOD_EMOJIS = {
  joyful: '😄', nostalgic: '🌙', proud: '🏆', sad: '💧',
  excited: '⚡', peaceful: '🕊', grateful: '🌸', adventurous: '🗺'
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function StoryMode({ events, onClose }) {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);
  const progressRef = useRef(null);
  const SLIDE_DURATION = 5000;

  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));

  useEffect(() => {
    if (playing) {
      progressRef.current = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            setCurrent(c => {
              if (c >= sorted.length - 1) {
                setPlaying(false);
                return c;
              }
              return c + 1;
            });
            return 0;
          }
          return p + (100 / (SLIDE_DURATION / 100));
        });
      }, 100);
    }
    return () => clearInterval(progressRef.current);
  }, [playing, sorted.length]);

  const goTo = (idx) => {
    setCurrent(idx);
    setProgress(0);
  };

  const prev = () => { if (current > 0) goTo(current - 1); };
  const next = () => { if (current < sorted.length - 1) goTo(current + 1); };

  const event = sorted[current];
  if (!event) return null;

  const hasImage = event.media?.[0]?.url;

  return (
    <div className="story-overlay">
      {/* Background */}
      <div
        className="story-bg"
        style={hasImage ? { backgroundImage: `url(${event.media[0].url})` } : {}}
      />
      <div className="story-bg-tint" style={{ background: `linear-gradient(135deg, ${event.color || '#c4813a'}22 0%, #00000088 100%)` }} />

      {/* Top bar */}
      <div className="story-topbar">
        <div className="story-brand">
          <span style={{ color: '#e8a85a' }}>✦</span> Memoria
        </div>
        <div className="story-progress-bars">
          {sorted.map((_, i) => (
            <div key={i} className="story-progress-bar" onClick={() => goTo(i)}>
              <div
                className="story-progress-fill"
                style={{
                  width: i < current ? '100%' : i === current ? `${progress}%` : '0%',
                  background: event.color || '#e8a85a'
                }}
              />
            </div>
          ))}
        </div>
        <button className="story-close" onClick={onClose}>✕</button>
      </div>

      {/* Content */}
      <div className="story-content" key={current}>
        <div className="story-card">
          {hasImage && (
            <div className="story-card-image">
              <img src={event.media[0].url} alt={event.title} />
            </div>
          )}
          <div className="story-card-text">
            <div className="story-date">{formatDate(event.date)}</div>
            <h2 className="story-title">{event.title}</h2>
            {event.location && <div className="story-location">📍 {event.location}</div>}
            {event.description && <p className="story-desc">{event.description}</p>}
            <div className="story-mood">
              {MOOD_EMOJIS[event.mood]} {event.mood}
            </div>
          </div>
        </div>

        <div className="story-counter">{current + 1} / {sorted.length}</div>
      </div>

      {/* Controls */}
      <div className="story-controls">
        <button className="story-nav-btn" onClick={prev} disabled={current === 0}>←</button>
        <button className="story-play-btn" onClick={() => setPlaying(p => !p)}>
          {playing ? '⏸' : '▶'}
        </button>
        <button className="story-nav-btn" onClick={next} disabled={current === sorted.length - 1}>→</button>
      </div>

      {/* Thumbnail strip */}
      <div className="story-thumbnails">
        {sorted.map((e, i) => (
          <button
            key={e._id}
            className={`story-thumb ${i === current ? 'active' : ''}`}
            onClick={() => goTo(i)}
            style={{ borderColor: i === current ? event.color || '#e8a85a' : 'transparent' }}
          >
            {e.media?.[0]?.url
              ? <img src={e.media[0].url} alt={e.title} />
              : <span style={{ fontSize: 20 }}>{MOOD_EMOJIS[e.mood]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
