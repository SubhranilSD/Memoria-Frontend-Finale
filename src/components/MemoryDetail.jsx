import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { inferWeather, isFutureLetter, daysUntilUnlock } from '../utils/memoryUtils';
import { useAuth } from '../context/AuthContext';
import { MOOD_COLORS as BASE_COLORS, MOOD_EMOJIS as BASE_EMOJIS } from '../utils/moodProvider';
import './MemoryDetail.css';

const MOOD_PROSE = {
  joyful: 'A golden moment bathed in warmth — pure, unfiltered happiness.',
  nostalgic: 'Tinged with the bittersweet ache of time well lived.',
  proud: 'A milestone hard-earned; a chapter you\'ll revisit with pride.',
  sad: 'A heavy moment, but part of the full tapestry of your story.',
  excited: 'Electricity in the air — the precipice of something new.',
  peaceful: 'Stillness. A breath held perfectly in place.',
  grateful: 'Counting blessings, one heartbeat at a time.',
  adventurous: 'Uncharted territory, met with courage and curiosity.',
};

const MOOD_COLORS = { ...BASE_COLORS };
const MOOD_EMOJIS = { ...BASE_EMOJIS };

function formatDateLong(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function getTimeOfDay(dateStr) {
  if (!dateStr) return null;
  const h = new Date(dateStr).getHours();
  if (isNaN(h)) return null;
  if (h < 5) return { label: 'Deep Night', icon: '🌑', hue: '#1a1b3a' };
  if (h < 10) return { label: 'Morning', icon: '🌅', hue: '#f59e0b' };
  if (h < 14) return { label: 'Midday', icon: '☀️', hue: '#fbbf24' };
  if (h < 18) return { label: 'Afternoon', icon: '🌤', hue: '#fb923c' };
  if (h < 21) return { label: 'Evening', icon: '🌆', hue: '#f97316' };
  return { label: 'Night', icon: '🌙', hue: '#8b5cf6' };
}
function getDaysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff) || diff < 0) return null;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  const yrs = Math.floor(days / 365);
  return `${yrs} year${yrs > 1 ? 's' : ''} ago`;
}

function renderAudio(audioUrl) {
  if (!audioUrl) return null;
  if (audioUrl.includes('spotify.com/track/')) {
    const trackId = audioUrl.split('track/')[1].split('?')[0];
    return (
      <iframe
        style={{ borderRadius: '12px', width: '100%', height: '80px' }}
        src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator`}
        frameBorder="0" allowFullScreen
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    );
  }
  return <audio controls src={audioUrl} style={{ width: '100%', height: '40px', borderRadius: '8px' }} />;
}

export default function MemoryDetail({ event, allEvents = [], onClose, onEdit, onUpdateEvent }) {
  const { user } = useAuth();
  const [activeImg, setActiveImg] = useState(0);
  const [activeTab, setActiveTab] = useState('details');
  const [isDragging, setIsDragging] = useState(false);
  const [localComposition, setLocalComposition] = useState(null);
  const [faceClusters, setFaceClusters] = useState([]);
  const imgWrapRef = useRef(null);

  if (!event) return null;

  const allMedia = event.media || [];
  const mediaCount = allMedia.length;
  const hasMedia = mediaCount > 0;

  const currentComp = localComposition || allMedia[activeImg]?.focalPoint || { x: 50, y: 50, scale: 1, aspectRatio: 'original' };

  const updateComposition = (updates) => {
    setLocalComposition(prev => ({
      ...(prev || allMedia[activeImg]?.focalPoint || { x: 50, y: 50, scale: 1, aspectRatio: 'original' }),
      ...updates
    }));
  };

  const handleMouseDown = (e) => {
    if (activeTab !== 'composition') return;
    e.preventDefault();
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    updateComposition({ x, y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || activeTab !== 'composition') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    updateComposition({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    saveComposition();
  };

  const saveComposition = () => {
    if (localComposition) {
      const newMedia = [...allMedia];
      newMedia[activeImg] = {
        ...newMedia[activeImg],
        focalPoint: { ...newMedia[activeImg]?.focalPoint, ...localComposition }
      };
      onUpdateEvent(event._id, { media: newMedia });
      setLocalComposition(null);
    }
  };

  const handleScaleChange = (val) => {
    updateComposition({ scale: val });
    // Debounced save would be better, but for now just save immediately on slider change?
    // Actually, let's just update local and save on MouseUp of the slider if possible.
    // For simplicity, let's just save.
    const newMedia = [...allMedia];
    newMedia[activeImg] = {
      ...newMedia[activeImg],
      focalPoint: { ...(newMedia[activeImg]?.focalPoint || {}), scale: val }
    };
    onUpdateEvent(event._id, { media: newMedia });
  };

  const handleAspectChange = (aspect) => {
    const newMedia = [...allMedia];
    newMedia[activeImg] = {
      ...newMedia[activeImg],
      focalPoint: { ...(newMedia[activeImg]?.focalPoint || {}), aspectRatio: aspect }
    };
    onUpdateEvent(event._id, { media: newMedia });
  };

  // Load face clusters
  useEffect(() => {
    try {
      const clustersKey = `memoria_face_clusters_${user?._id || 'guest'}`;
      const saved = localStorage.getItem(clustersKey);
      if (saved) {
        const cls = JSON.parse(saved);
        setFaceClusters(cls.filter(c => c.eventIds.includes(event._id)));
      }
    } catch { }
  }, [event._id, user?._id]);

  const color = event.color || MOOD_COLORS[event.mood] || '#c4813a';
  const moodEmoji = MOOD_EMOJIS[event.mood] || '✨';
  const moodProse = MOOD_PROSE[event.mood] || `A moment of ${event.mood}.`;
  const weather = inferWeather(event.date, event.location);
  const isFuture = isFutureLetter(event);
  const timeOfDay = getTimeOfDay(event.date);
  const daysSince = getDaysSince(event.date);

  const wordCount = event.description ? event.description.split(/\s+/).filter(Boolean).length : 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <motion.div
      className="md-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="md-backdrop" onClick={onClose} />

      <motion.div
        className="md-sheet"
        style={{ '--mc': color }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 200 }}
      >
        <div className="md-color-bar" style={{ background: `linear-gradient(to right, transparent, ${color}, transparent)` }} />

        <div className="md-top-actions">
          <div className="md-tabs">
            <button
              className={`md-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
              onClick={() => setActiveTab('details')}
            >
              📖 Story
            </button>
            <button
              className={`md-tab-btn ${activeTab === 'composition' ? 'active' : ''}`}
              onClick={() => setActiveTab('composition')}
            >
              🎨 Composition
            </button>
          </div>
          <div className="md-action-group">
            {onEdit && (
              <button className="md-action-btn" onClick={() => { onClose(); onEdit(event); }}>✏ Edit</button>
            )}
            <button className="md-close-btn" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        <div className="md-scroll-body">
          {activeTab === 'composition' ? (
            <div className="md-composition-tab">
              <div className="md-media-panel">
                <div
                  ref={imgWrapRef}
                  className={`md-main-img-wrap aspect-${allMedia[activeImg]?.focalPoint?.aspectRatio || 'original'}`}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  style={allMedia[activeImg]?.focalPoint?.aspectRatio === 'custom' ? {
                    aspectRatio: allMedia[activeImg]?.focalPoint?.customAspect || 1,
                  } : {}}
                >
                  <motion.img
                    key={activeImg}
                    src={allMedia[activeImg]?.url}
                    alt=""
                    className="md-main-img"
                    style={{
                      objectPosition: `${currentComp.x}% ${currentComp.y}%`,
                      transform: `scale(${currentComp.scale})`
                    }}
                  />
                  <div className="md-focus-ring" style={{ left: `${currentComp.x}%`, top: `${currentComp.y}%` }} />
                  <div className="md-img-overlay" style={{ background: `linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.8))` }} />
                </div>

                <div className="md-composition-controls">
                  <div className="md-control-group">
                    <label>Zoom & Pan</label>
                    <div className="md-zoom-slider-wrap">
                      <span>1x</span>
                      <input
                        type="range" min="1" max="4" step="0.1"
                        value={currentComp.scale}
                        onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                      />
                      <span>4x</span>
                    </div>
                  </div>

                  <div className="md-control-group">
                    <label>Crop / Aspect Ratio</label>
                    <div className="md-aspect-grid">
                      {['original', '1:1', '4:5', '2:3', '3:2', '16:9', '21:9'].map(ratio => (
                        <button
                          key={ratio}
                          className={`md-aspect-pill ${allMedia[activeImg]?.focalPoint?.aspectRatio === ratio ? 'active' : ''}`}
                          onClick={() => handleAspectChange(ratio)}
                        >
                          {ratio.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {mediaCount > 1 && (
                  <div className="md-filmstrip">
                    {allMedia.map((m, i) => (
                      <div
                        key={i}
                        className={`md-thumb ${i === activeImg ? 'active' : ''}`}
                        onClick={() => setActiveImg(i)}
                        style={i === activeImg ? { borderColor: color } : {}}
                      >
                        <img src={m.url} alt="" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="md-details-tab">
              <div className="md-hero">
                {hasMedia && !isFuture && (
                  <div className="md-media-panel">
                    <div className="md-main-img-wrap aspect-original">
                      <motion.img
                        key={activeImg}
                        src={allMedia[activeImg]?.url}
                        alt=""
                        className="md-main-img"
                        style={{
                          objectPosition: `${allMedia[activeImg]?.focalPoint?.x || 50}% ${allMedia[activeImg]?.focalPoint?.y || 50}%`,
                          transform: `scale(${allMedia[activeImg]?.focalPoint?.scale || 1})`
                        }}
                      />
                    </div>
                    {mediaCount > 1 && (
                      <div className="md-filmstrip">
                        {allMedia.map((m, i) => (
                          <div
                            key={i}
                            className={`md-thumb ${i === activeImg ? 'active' : ''}`}
                            onClick={() => setActiveImg(i)}
                            style={i === activeImg ? { borderColor: color } : {}}
                          >
                            <img src={m.url} alt="" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="md-hero-info">
                  <div className="md-breadcrumb">
                    <span className="md-crumb">{daysSince}</span>
                    <span className="md-crumb-sep">·</span>
                    <span className="md-crumb">{formatDateLong(event.date)}</span>
                    {timeOfDay && (
                      <>
                        <span className="md-crumb-sep">·</span>
                        <span className="md-crumb">{timeOfDay.icon} {timeOfDay.label}</span>
                      </>
                    )}
                  </div>

                  <h1 className="md-title font-display" style={{ '--mc': color }}>{event.title}</h1>

                  <div className="md-chips">
                    <span className={`md-mood-chip mood-${event.mood}`} style={{ '--mc': color }}>
                      {moodEmoji} {event.mood}
                    </span>
                    {event.location && (
                      <span className="md-chip-pill">📍 {event.location}</span>
                    )}
                    {weather && !isFuture && (
                      <span className="md-chip-pill" title={weather.label}>{weather.icon} {weather.label}</span>
                    )}
                    {event.isPrivate && <span className="md-chip-pill">🔒 Private</span>}
                  </div>

                  {event.mood && (
                    <p className="md-mood-prose">{moodProse}</p>
                  )}

                  <div className="md-stats-grid">
                    {[
                      { icon: '🖼', label: 'Photos', val: mediaCount || '—' },
                      { icon: '📝', label: 'Words', val: wordCount || '—' },
                      { icon: '⏱', label: 'Read', val: wordCount > 0 ? `${readTime}m` : '—' },
                      { icon: '🏷', label: 'Tags', val: event.tags?.length || 0 },
                      { icon: '👥', label: 'People', val: event.people?.length || 0 },
                    ].map((s, i) => (
                      <div key={s.label} className="md-stat-tile">
                        <span className="md-stat-icon">{s.icon}</span>
                        <span className="md-stat-val">{s.val}</span>
                        <span className="md-stat-lbl">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {isFuture && (
                <div className="md-locked-box">
                  <div className="md-locked-icon">🔒</div>
                  <div className="md-locked-title">Memory Sealed</div>
                  <div className="md-locked-sub">This memory unlocks in <strong>{daysUntilUnlock(event)} days</strong>.</div>
                </div>
              )}

              {!isFuture && (
                <div className="md-body-grid">
                  <div className="md-body-main">
                    {event.description ? (
                      <section className="md-section">
                        <div className="md-section-label">✦ The Story</div>
                        <div className="md-story-body markdown-body">
                          <ReactMarkdown>{event.description}</ReactMarkdown>
                        </div>
                      </section>
                    ) : (
                      <section className="md-section">
                        <div className="md-section-label">✦ The Story</div>
                        <p className="md-empty-note">No description recorded for this moment.</p>
                      </section>
                    )}

                    {event.audioUrl && (
                      <section className="md-section">
                        <div className="md-section-label">🎙 Voice / Music</div>
                        {renderAudio(event.audioUrl)}
                      </section>
                    )}

                    {allMedia.length > 1 && (
                      <section className="md-section">
                        <div className="md-section-label">🖼 Gallery ({allMedia.length})</div>
                        <div className="md-gallery-grid">
                          {allMedia.map((m, i) => (
                            <div key={i} className={`md-gallery-item ${i === activeImg ? 'md-gallery-active' : ''}`}
                              onClick={() => setActiveImg(i)}
                              style={i === activeImg ? { borderColor: color } : {}}
                            >
                              <img src={m.url} alt={`Photo ${i + 1}`} />
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>

                  <div className="md-body-side">
                    <section className="md-section md-nuance-card">
                      <div className="md-section-label">🌡 Atmosphere</div>
                      <div className="md-nuance-rows">
                        <div className="md-nuance-row">
                          <span className="md-nkey">Mood</span>
                          <span className="md-nval" style={{ color }}>{moodEmoji} {event.mood}</span>
                        </div>
                        {timeOfDay && (
                          <div className="md-nuance-row">
                            <span className="md-nkey">Time of Day</span>
                            <span className="md-nval">{timeOfDay.icon} {timeOfDay.label}</span>
                          </div>
                        )}
                        {weather && (
                          <div className="md-nuance-row">
                            <span className="md-nkey">Weather</span>
                            <span className="md-nval">{weather.icon} {weather.label}</span>
                          </div>
                        )}
                        {event.color && (
                          <div className="md-nuance-row">
                            <span className="md-nkey">Memory Hue</span>
                            <span className="md-nval">
                              <span className="md-color-swatch" style={{ background: event.color }} />
                              {event.color}
                            </span>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="md-section md-nuance-card">
                      <div className="md-section-label">📅 Timeline</div>
                      <div className="md-nuance-rows">
                        <div className="md-nuance-row">
                          <span className="md-nkey">Date</span>
                          <span className="md-nval">{formatDateShort(event.date)}</span>
                        </div>
                        <div className="md-nuance-row">
                          <span className="md-nkey">Time Ago</span>
                          <span className="md-nval">{daysSince}</span>
                        </div>
                        {event.date && (
                          <div className="md-nuance-row">
                            <span className="md-nkey">Day of Week</span>
                            <span className="md-nval">
                              {new Date(event.date).toLocaleDateString('en-US', { weekday: 'long' })}
                            </span>
                          </div>
                        )}
                        {event.date && (
                          <div className="md-nuance-row">
                            <span className="md-nkey">Season</span>
                            <span className="md-nval">{getSeason(event.date)}</span>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="md-section md-nuance-card">
                      <div className="md-section-label">👥 People & Related Moments</div>
                      {event.people && event.people.length > 0 ? (
                        <div className="md-people-list">
                          {event.people.map(p => {
                            const cluster = faceClusters.find(c => c.name === p);
                            const relatedMemories = allEvents.filter(e =>
                              e._id !== event._id &&
                              (e.people || []).includes(p) &&
                              e.media?.[0]?.url
                            ).slice(0, 5);

                            return (
                              <div key={p} className="md-person-block">
                                <div className="md-person-row">
                                  {cluster?.faceUrl
                                    ? <img src={cluster.faceUrl} alt={p} className="md-person-avatar" />
                                    : <div className="md-person-avatar md-person-initial">{p[0]?.toUpperCase()}</div>
                                  }
                                  <span className="md-person-name">{p}</span>
                                </div>

                                {relatedMemories.length > 0 && (
                                  <div className="md-related-photos">
                                    {relatedMemories.map(rm => (
                                      <div key={rm._id} className="md-related-photo-item" title={rm.title}>
                                        <img src={rm.media[0].url} alt="" />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="md-empty-note">No people tagged in this memory.</p>
                      )}
                    </section>

                    {event.tags && event.tags.length > 0 && (
                      <section className="md-section md-nuance-card">
                        <div className="md-section-label">🏷 Tags</div>
                        <div className="md-tags-cloud">
                          {event.tags.map(t => (
                            <span key={t} className="md-nuance-tag" style={{ '--mc': color }}>#{t}</span>
                          ))}
                        </div>
                      </section>
                    )}

                    <section className="md-section md-nuance-card md-mood-signature">
                      <div className="md-mood-sig-glow" style={{ background: color }} />
                      <div className="md-section-label">✨ Mood Signature</div>
                      <div className="md-mood-sig-emoji">{moodEmoji}</div>
                      <div className="md-mood-sig-name" style={{ color }}>{event.mood?.toUpperCase()}</div>
                      <p className="md-mood-sig-prose">{moodProse}</p>
                    </section>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function getSeason(dateStr) {
  const m = new Date(dateStr).getMonth();
  if (m >= 2 && m <= 4) return '🌸 Spring';
  if (m >= 5 && m <= 7) return '☀️ Summer';
  if (m >= 8 && m <= 10) return '🍂 Autumn';
  return '❄️ Winter';
}
