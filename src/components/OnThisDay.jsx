import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './OnThisDay.css';

const MOOD_EMOJIS = {
  joyful:'😄', nostalgic:'🌙', proud:'🏆', sad:'💧',
  excited:'⚡', peaceful:'🕊', grateful:'🌸', adventurous:'🗺',
};

export default function OnThisDay({ events, onClose }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  /* Filter events that happened on today's date in any past year */
  const today = new Date();
  const matches = events.filter(ev => {
    const d = new Date(ev.date);
    return d.getMonth() === today.getMonth() &&
           d.getDate()  === today.getDate()  &&
           d.getFullYear() !== today.getFullYear();
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  /* Auto-advance every 6 seconds unless paused */
  useEffect(() => {
    if (paused || matches.length <= 1) return;
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % matches.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [paused, matches.length]);

  const goNext = useCallback(() => setIndex(i => (i + 1) % matches.length), [matches.length]);
  const goPrev = useCallback(() => setIndex(i => (i - 1 + matches.length) % matches.length), [matches.length]);

  /* Keyboard */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === ' ') { e.preventDefault(); setPaused(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goNext, goPrev]);

  if (matches.length === 0) {
    return (
      <motion.div className="otd-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="otd-empty" onClick={e => e.stopPropagation()}>
          <div className="otd-empty-icon">📅</div>
          <h2>Nothing happened on this day</h2>
          <p>No memories recorded on {today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} in previous years.</p>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </motion.div>
    );
  }

  const ev    = matches[index];
  const emoji = MOOD_EMOJIS[ev.mood] || '✦';
  const year  = new Date(ev.date).getFullYear();
  const yearsAgo = today.getFullYear() - year;
  const hasPhoto = ev.media?.length > 0;
  const fmtDate  = new Date(ev.date).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });

  return (
    <motion.div className="otd-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      {/* Background photo with Ken Burns */}
      <AnimatePresence mode="wait">
        <motion.div
          key={ev._id}
          className="otd-bg-layer"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1.12 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1 }, scale: { duration: 12, ease: 'linear' } }}
        >
          {hasPhoto && (
            <img src={ev.media[0].url} alt="" className="otd-bg-img" />
          )}
          <div className="otd-bg-overlay" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="otd-content">
        {/* Header */}
        <motion.div className="otd-header"
          initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="otd-header-badge">📅 On This Day</div>
          <div className="otd-header-years">{yearsAgo} year{yearsAgo > 1 ? 's' : ''} ago</div>
        </motion.div>

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={ev._id}
            className="otd-card"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
          >
            {/* Photo */}
            {hasPhoto && (
              <div className="otd-card-photo">
                <img src={ev.media[0].url} alt="" />
                {ev.media.length > 1 && (
                  <div className="otd-card-photo-gallery">
                    {ev.media.slice(1, 4).map((m, i) => (
                      <img key={i} src={m.url} alt="" className="otd-card-photo-mini" />
                    ))}
                    {ev.media.length > 4 && <span className="otd-card-more">+{ev.media.length - 4}</span>}
                  </div>
                )}
              </div>
            )}

            <div className="otd-card-body">
              <div className="otd-card-emoji">{emoji}</div>
              <h2 className="otd-card-title">{ev.title}</h2>
              <div className="otd-card-date">{fmtDate}</div>
              {ev.location && <div className="otd-card-loc">📍 {ev.location}</div>}
              {ev.description && (
                <p className="otd-card-desc">{ev.description.slice(0, 250)}{ev.description.length > 250 ? '…' : ''}</p>
              )}
              {ev.people?.length > 0 && (
                <div className="otd-card-people">
                  {ev.people.map(p => (
                    <span key={p} className="otd-card-person">
                      <span className="otd-card-person-av">{p[0].toUpperCase()}</span>{p}
                    </span>
                  ))}
                </div>
              )}
              {ev.tags?.length > 0 && (
                <div className="otd-card-tags">
                  {ev.tags.map(t => <span key={t} className="tag">#{t}</span>)}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Controls */}
        <div className="otd-controls">
          <button className="otd-ctrl-btn" onClick={goPrev} title="Previous">‹</button>

          {/* Progress dots */}
          <div className="otd-dots">
            {matches.map((_, i) => (
              <button key={i} className={`otd-dot ${i === index ? 'otd-dot--active' : ''}`}
                onClick={() => setIndex(i)} />
            ))}
          </div>

          <button className="otd-ctrl-btn" onClick={() => setPaused(p => !p)} title={paused ? 'Play' : 'Pause'}>
            {paused ? '▶' : '⏸'}
          </button>

          <button className="otd-ctrl-btn" onClick={goNext} title="Next">›</button>
        </div>

        {/* Counter */}
        <div className="otd-counter">{index + 1} / {matches.length}</div>

        {/* Close */}
        <motion.button className="otd-close" onClick={onClose}
          whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}>✕</motion.button>
      </div>
    </motion.div>
  );
}
