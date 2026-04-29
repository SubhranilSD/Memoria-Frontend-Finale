import { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { isFutureLetter, daysUntilUnlock, inferWeather } from '../utils/memoryUtils';
import { useAuth } from '../context/AuthContext';
import { MOOD_EMOJIS as BASE_EMOJIS, MOOD_COLORS as BASE_COLORS } from '../utils/moodProvider';
import './EventCard.css';

const MOOD_EMOJIS = { ...BASE_EMOJIS };
const MOOD_COLORS = { ...BASE_COLORS };

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderAudio(audioUrl) {
  if (!audioUrl) return null;
  // Spotify embed
  if (audioUrl.includes('spotify.com/track/')) {
    const trackId = audioUrl.split('track/')[1].split('?')[0];
    return (
      <iframe
        style={{ borderRadius: '12px', marginTop: '12px', width: '100%', height: '80px' }}
        src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator`}
        frameBorder="0"
        allowFullScreen=""
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    );
  }
  // Standard audio
  return (
    <audio controls src={audioUrl} style={{ width: '100%', height: '36px', marginTop: '12px', borderRadius: '8px' }} />
  );
}

export default function EventCard({ event, view, editMode, onEdit, onDelete, onClickMedia }) {
  const { user } = useAuth();
  const cardRef = useRef(null);
  const [peopleInEvent, setPeopleInEvent] = useState([]);
  const [showPeople, setShowPeople] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Lazy Loading / Virtualization: Only render complex parts when visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // Load slightly before coming into view
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  // Load people clusters
  useEffect(() => {
    if (!isVisible) return;
    try {
      const clustersKey = `memoria_face_clusters_${user?._id || 'guest'}`;
      const saved = localStorage.getItem(clustersKey);
      if (saved) {
        const clusters = JSON.parse(saved);
        const matches = clusters.filter(c => c.eventIds.includes(event._id));
        setPeopleInEvent(matches);
      }
    } catch { }
  }, [event._id, isVisible, user?._id]);

  // Framer Motion values for 3D tilt
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth springs for the tilt
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 20 });

  // Map mouse position to rotation (max 15 degrees)
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  // Map mouse position to glare position
  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ["100%", "0%"]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ["100%", "0%"]);

  const handleMouseMove = (e) => {
    if (!cardRef.current || !isVisible) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const mouseX = (e.clientX - rect.left) / width - 0.5;
    const mouseY = (e.clientY - rect.top) / height - 0.5;

    x.set(mouseX);
    y.set(mouseY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const moodColor = MOOD_COLORS[event.mood] || '#c4813a';
  const hasMedia = event.media && event.media.length > 0;
  const isFuture = isFutureLetter(event);
  const weather = inferWeather(event.date, event.location);

  const isDream = event.type === 'dream';

  return (
    <div className={`event-card-container ${view} ${isDream ? 'dream-container' : ''}`} style={{ perspective: 1000 }} ref={cardRef}>
      {!isVisible ? (
        <div className="skeleton-card" style={{ height: '180px', width: '100%', borderRadius: '16px' }} />
      ) : (
        <motion.div
          className={`event-card glass-card ${isDream ? 'dream-card' : ''}`}
          style={{
            '--event-color': event.color || moodColor,
            rotateX,
            rotateY,
            transformStyle: "preserve-3d"
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Dynamic Glare/Shine */}
          <motion.div
            className="event-card-glare"
            style={{
              background: `radial-gradient(circle at center, rgba(255,255,255,0.4) 0%, transparent 60%)`,
              left: glareX,
              top: glareY,
              transform: 'translate(-50%, -50%)'
            }}
          />

          <div className="event-card-accent" style={{ background: event.color || moodColor }} />

          {/* Media */}
          {hasMedia && !isFuture && (
            <div className="event-card-media" onClick={() => onClickMedia && onClickMedia(event)} style={{ cursor: onClickMedia ? 'zoom-in' : 'default' }}>
              <img
                src={event.media[0].url}
                alt={event.title}
                className="event-card-img"
                style={{
                  objectPosition: `${event.media[0].focalPoint?.x || 50}% ${event.media[0].focalPoint?.y || 50}%`,
                  transform: `scale(${event.media[0].focalPoint?.scale || 1})`
                }}
              />
              {event.media.length > 1 && (
                <div className="event-card-media-count">+{event.media.length - 1}</div>
              )}
            </div>
          )}

          <div className="event-card-body" style={{ transform: 'translateZ(30px)' }}>
            {/* Header */}
            <div className="event-card-header">
              <div>
                <div className="event-card-date">{formatDate(event.date)}</div>
                <h3 className="event-card-title">{event.title}</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {peopleInEvent.length > 0 && (
                  <button
                    className={`people-count-badge ${showPeople ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setShowPeople(!showPeople); }}
                    title={peopleInEvent.map(p => p.name).join(', ')}
                  >
                    <span className="people-icon">👥</span>
                    <span className="people-count-n">{peopleInEvent.length}</span>
                  </button>
                )}
                <div className={`mood-badge mood-${event.mood}`}>
                  {MOOD_EMOJIS[event.mood] || '✨'} {event.mood}
                </div>
              </div>
            </div>

            {/* Location & Weather */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
              {event.location && (
                <div className="event-card-location" style={{ marginBottom: 0 }}>📍 {event.location}</div>
              )}
              {weather && !isFuture && (
                <div className="event-card-location" style={{ marginBottom: 0 }} title={weather.label}>
                  {weather.icon} {weather.label}
                </div>
              )}
            </div>

            {/* Description or People View */}
            {!isFuture && (
              <div className="event-card-content-area">
                {showPeople ? (
                  <div className="event-card-people-view animate-in">
                    <h4 style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Detected Faces</h4>
                    <div className="event-card-people-badges">
                      {peopleInEvent.map(p => (
                        <div key={p.id} className="person-badge" title={p.name}>
                          <img src={p.faceUrl} alt="" />
                          <span>{p.name}</span>
                        </div>
                      ))}
                    </div>
                    {event.people?.length > 0 && (
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}><strong>Tagged:</strong> {event.people.join(', ')}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  event.description && (
                    <div className="event-card-desc markdown-body animate-in">
                      <ReactMarkdown>{event.description}</ReactMarkdown>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Future Lock State */}
            {isFuture && (
              <div style={{ padding: '16px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '8px', margin: '16px 0', border: '1px dashed var(--border-color)' }}>
                <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>🔒</span>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '4px' }}>Memory Locked</strong>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Unlocks in {daysUntilUnlock(event)} days</span>
              </div>
            )}

            {/* Audio Player */}
            {!isFuture && renderAudio(event.audioUrl)}

            {/* Tags & Meta */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
              {event.tags?.length > 0 && (
                <div className="event-card-tags">
                  {event.tags.map(tag => <span key={tag} className="tag">#{tag}</span>)}
                </div>
              )}
              {event.people?.length > 0 && (
                <span className="tag" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>👥 {event.people.join(', ')}</span>
              )}
              {event.audioUrl && !isFuture && (
                <span className="tag" style={{ background: 'var(--accent-indigo)', color: 'white', border: 'none' }}>🎙️ Voice Note</span>
              )}
              {event.isPrivate && (
                <span className="tag" style={{ background: 'var(--accent-rose)', color: 'white', border: 'none' }}>🔒 Vault</span>
              )}

              {/* Advanced: Biometrics */}
              {event.biometrics?.heartRate && (
                <span className="tag bio-tag" title="Recorded Heart Rate">
                  <span className="pulse">💓</span> {event.biometrics.heartRate} BPM
                </span>
              )}
              {event.biometrics?.stressLevel && (
                <span className="tag bio-tag" title="Stress Level">
                  🧠 {event.biometrics.stressLevel}% Stress
                </span>
              )}

              {/* Advanced: Portals */}
              {event.collaborators?.length > 0 && (
                <div className="portal-badges">
                  {event.collaborators.map(c => (
                    <span key={c} className="portal-chip" title={`Collaborator: ${c}`}>
                      <span className="portal-dot" /> @{c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            {editMode && (
              <div className="event-card-actions" style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(event); }}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); onDelete(event._id); }}>Delete</button>
              </div>
            )}
          </div>

          {/* Explore cue — shown on hover when card is clickable */}
          <div className="event-card-explore-cue">Explore →</div>
        </motion.div>
      )}
    </div>
  );
}
