import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './HorizonView.css';

const MOOD_COLORS = {
  joyful: '#f59e0b', nostalgic: '#8b5cf6', proud: '#10b981', sad: '#6b7280',
  excited: '#ef4444', peaceful: '#06b6d4', grateful: '#ec4899', adventurous: '#f97316',
};
const MOOD_EMOJIS = {
  joyful: '😄', nostalgic: '🌙', proud: '🏆', sad: '💧',
  excited: '⚡', peaceful: '🕊', grateful: '🌸', adventurous: '🗺',
};

const SVG_H = 560;
const MID_Y = SVG_H / 2;
const H_GAP = 310;
const CARD_W = 220;
const CARD_H = 185;
const TENDRILS = 6;

/* Catmull-Rom → cubic bezier path through points */
function smoothPath(pts) {
  if (!pts.length) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 5;
    const cp1y = p1.y + (p2.y - p0.y) / 5;
    const cp2x = p2.x - (p3.x - p1.x) / 5;
    const cp2y = p2.y - (p3.y - p1.y) / 5;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/* Build layout for N events */
function buildLayout(events) {
  return events.map((ev, i) => {
    const cx = 140 + i * H_GAP;
    const wave = Math.sin(i * 1.1) * 28;
    const above = i % 2 === 0;
    return {
      ev,
      cx,
      dotY: MID_Y + wave,
      cardX: cx - CARD_W / 2,
      cardY: above ? MID_Y + wave - CARD_H - 52 : MID_Y + wave + 52,
      above,
      color: ev.color || MOOD_COLORS[ev.mood] || '#c4813a',
    };
  });
}

/* Tendril path (decorative energy arc) */
function tendrilPath(seed, totalW) {
  const amp = 60 + seed * 22;
  const freq = 0.008 + seed * 0.002;
  const yOff = MID_Y + (seed % 2 === 0 ? -amp : amp);
  let d = `M 0 ${yOff}`;
  for (let x = 0; x <= totalW; x += 40) {
    const y = yOff + Math.sin(x * freq + seed) * (amp * 0.6);
    d += ` L ${x} ${y}`;
  }
  return d;
}

/* ─── Detail overlay ─── */
function MemoryDetail({ item, onClose, rank, total }) {
  const { ev, color } = item;
  const emoji = MOOD_EMOJIS[ev.mood] || '✦';
  const fmtDate = new Date(ev.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <motion.div className="hv-detail-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div className="hv-detail-panel"
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      >
        {/* Color accent bar */}
        <div className="hv-dp-bar" style={{ background: `linear-gradient(90deg, ${color}, ${color}44)` }} />

        {/* Header */}
        <div className="hv-dp-header">
          <div className="hv-dp-rank">Memory #{rank} of {total}</div>
          <motion.button className="hv-dp-close" onClick={onClose}
            whileHover={{ scale: 1.12, rotate: 90 }} whileTap={{ scale: 0.9 }}>✕</motion.button>
        </div>

        <div className="hv-dp-body">
          {/* Left — media gallery */}
          <div className="hv-dp-left">
            {ev.media?.length > 0 ? (
              <div className="hv-dp-gallery">
                {ev.media.map((m, i) => (
                  <img key={i} src={m.url} alt="" className="hv-dp-img" />
                ))}
              </div>
            ) : (
              <div className="hv-dp-no-img" style={{ '--card-color': color }}>
                <span>{emoji}</span>
              </div>
            )}

            {/* Mood pill */}
            <div className="hv-dp-mood" style={{ background: `${color}22`, border: `1px solid ${color}44`, color }}>
              {emoji} {ev.mood}
            </div>

            {/* People */}
            {ev.people?.length > 0 && (
              <div className="hv-dp-people">
                <div className="hv-dp-sublabel">👤 People</div>
                <div className="hv-dp-people-chips">
                  {ev.people.map(p => (
                    <span key={p} className="hv-dp-person">
                      <span className="hv-dp-person-av">{p[0].toUpperCase()}</span>{p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — text details */}
          <div className="hv-dp-right">
            <div className="hv-dp-meta-row">
              <span className="hv-dp-date">📅 {fmtDate}</span>
              {ev.isPrivate && <span className="hv-dp-private">🔒 Private</span>}
            </div>

            <h2 className="hv-dp-title" style={{ '--card-color': color }}>{ev.title}</h2>

            {ev.location && (
              <div className="hv-dp-location">
                <span>📍</span>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(ev.location)}`}
                  target="_blank" rel="noreferrer" className="hv-dp-loc-link">
                  {ev.location}
                </a>
              </div>
            )}

            {ev.description && (
              <div className="hv-dp-desc-wrap">
                <div className="hv-dp-desc-bar" style={{ background: color }} />
                <p className="hv-dp-desc">{ev.description}</p>
              </div>
            )}

            {ev.tags?.length > 0 && (
              <div className="hv-dp-section">
                <div className="hv-dp-sublabel">Tags</div>
                <div className="hv-dp-tags">
                  {ev.tags.map(t => <span key={t} className="tag">#{t}</span>)}
                </div>
              </div>
            )}

            {/* Stats strip */}
            <div className="hv-dp-stats">
              {ev.media?.length > 0 && (
                <div className="hv-dp-stat">
                  <span className="hv-dp-stat-n">{ev.media.length}</span>
                  <span className="hv-dp-stat-l">Photo{ev.media.length > 1 ? 's' : ''}</span>
                </div>
              )}
              {ev.description && (
                <div className="hv-dp-stat">
                  <span className="hv-dp-stat-n">{ev.description.trim().split(/\s+/).length}</span>
                  <span className="hv-dp-stat-l">Words</span>
                </div>
              )}
              {ev.people?.length > 0 && (
                <div className="hv-dp-stat">
                  <span className="hv-dp-stat-n">{ev.people.length}</span>
                  <span className="hv-dp-stat-l">People</span>
                </div>
              )}
              {ev.tags?.length > 0 && (
                <div className="hv-dp-stat">
                  <span className="hv-dp-stat-n">{ev.tags.length}</span>
                  <span className="hv-dp-stat-l">Tags</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main HorizonView ─── */
export default function HorizonView({ events, editMode, onEdit }) {
  const sorted = useMemo(() => [...events].sort((a, b) => new Date(a.date) - new Date(b.date)), [events]);
  const layout = useMemo(() => buildLayout(sorted), [sorted]);
  const totalW = 280 + sorted.length * H_GAP;

  const [selected, setSelected] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const scrollRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef(0);
  const scrollStart = useRef(0);

  /* Mouse-drag horizontal scroll */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onDown = e => { isDragging.current = true; dragStart.current = e.clientX; scrollStart.current = el.scrollLeft; el.style.cursor = 'grabbing'; };
    const onMove = e => { if (!isDragging.current) return; el.scrollLeft = scrollStart.current - (e.clientX - dragStart.current); };
    const onUp = () => { isDragging.current = false; el.style.cursor = 'grab'; };
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { el.removeEventListener('mousedown', onDown); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  /* Scroll-wheel → horizontal */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = e => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; e.preventDefault(); el.scrollLeft += e.deltaY * 1.8; };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const mainPath = smoothPath(layout.map(l => ({ x: l.cx, y: l.dotY })));
  const tendrils = Array.from({ length: TENDRILS }, (_, i) => ({
    d: tendrilPath(i, totalW),
    color: ['#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#10b981'][i],
    width: 0.8 + i * 0.2,
    opacity: 0.12 + i * 0.03,
    dashLen: 20 + i * 15,
    dur: 8 + i * 3,
  }));

  const selectedLayout = layout.find(l => l.ev._id === selected);

  return (
    <div className="hv-wrapper">
      {/* Scroll hint */}
      <div className="hv-scroll-hint">← Scroll or drag to explore your timeline →</div>

      {/* Horizontal scroller */}
      <div className="hv-scroller" ref={scrollRef}>
        <div className="hv-canvas" style={{ width: totalW, height: SVG_H }}>

          {/* ── SVG layer: glow + tendrils + dots ── */}
          <svg className="hv-svg" width={totalW} height={SVG_H}>
            <defs>
              {/* Animated sweep gradient */}
              <linearGradient id="hv-main-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
                <stop offset="25%" stopColor="#ec4899" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.9" />
                <stop offset="75%" stopColor="#06b6d4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0.6" />
              </linearGradient>
              <filter id="hv-glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="hv-glow-strong">
                <feGaussianBlur stdDeviation="7" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Tendrils */}
            {tendrils.map((t, i) => (
              <path key={i} d={t.d} fill="none"
                stroke={t.color} strokeWidth={t.width} strokeOpacity={t.opacity}
                strokeDasharray={`${t.dashLen} ${t.dashLen * 2}`}
                className="hv-tendril"
                style={{ animationDuration: `${t.dur}s`, animationDelay: `${i * 0.8}s` }}
              />
            ))}

            {/* Inner primary glow (thickened) */}
            <path d={mainPath} fill="none" stroke="url(#hv-main-grad)"
              strokeWidth="20" strokeOpacity="0.1" filter="url(#hv-glow-strong)" />

            {/* Outer secondary glow */}
            <path d={mainPath} fill="none" stroke="white"
              strokeWidth="1" strokeOpacity="0.1" filter="url(#hv-glow-strong)"
              className="hv-aura-path"
            />

            {/* Mid glow path (thickened) */}
            <path d={mainPath} fill="none" stroke="url(#hv-main-grad)"
              strokeWidth="8" strokeOpacity="0.4" filter="url(#hv-glow)" />

            {/* Core path */}
            <path d={mainPath} fill="none" stroke="url(#hv-main-grad)"
              strokeWidth="4" strokeOpacity="0.95"
              strokeDasharray="8 0"
              className="hv-core-path"
            />

            {/* Multiple Particle Layers */}
            {[0, 0.2, 0.4, 0.6, 0.8].map((offset, i) => (
              <g key={i}>
                <circle r={2 + i % 3} fill="white" opacity={0.6 + i * 0.05} filter="url(#hv-glow)">
                  <animateMotion dur={`${6 + i * 2}s`} repeatCount="indefinite" begin={`${offset * 6}s`}>
                    <mpath href="#hv-main-path-ref" />
                  </animateMotion>
                </circle>
                {/* Secondary trailing particle */}
                <circle r="1.5" fill="white" opacity="0.3">
                  <animateMotion dur={`${6 + i * 2}s`} repeatCount="indefinite" begin={`${offset * 6 + 0.1}s`}>
                    <mpath href="#hv-main-path-ref" />
                  </animateMotion>
                </circle>
              </g>
            ))}

            <path id="hv-main-path-ref" d={mainPath} fill="none" stroke="none" />

            {/* Connector lines from dot to card */}
            {layout.map(({ cx, dotY, cardY, above, color }) => (
              <line key={cx}
                x1={cx} y1={dotY}
                x2={cx} y2={above ? cardY + CARD_H : cardY}
                stroke={color} strokeWidth="1" strokeOpacity="0.35"
                strokeDasharray="3 3"
              />
            ))}

            {/* Dots on the timeline */}
            {layout.map(({ ev, cx, dotY, color }) => {
              const isHovered = hoveredId === ev._id;
              return (
                <g key={ev._id} onClick={() => setSelected(ev._id)} style={{ cursor: 'pointer' }}>
                  {/* Outer ring */}
                  <circle cx={cx} cy={dotY} r={isHovered ? 14 : 10}
                    fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.5"
                    style={{ transition: 'r 0.2s ease' }}
                  />
                  {/* Glow dot */}
                  <circle cx={cx} cy={dotY} r={isHovered ? 7 : 5}
                    fill={color} opacity="0.85" filter="url(#hv-glow)"
                    style={{ transition: 'r 0.2s ease' }}
                  />
                  {/* Core dot */}
                  <circle cx={cx} cy={dotY} r={isHovered ? 4 : 3}
                    fill="white" opacity="0.95"
                  />
                </g>
              );
            })}
          </svg>

          {/* ── Memory cards ── */}
          {layout.map(({ ev, cardX, cardY, above, color }, idx) => {
            const emoji = MOOD_EMOJIS[ev.mood] || '✦';
            const isHovered = hoveredId === ev._id;
            return (
              <motion.div
                key={ev._id}
                className={`hv-card ${above ? 'hv-card--above' : 'hv-card--below'}`}
                style={{ left: cardX, top: cardY, '--card-color': color, width: CARD_W }}
                whileHover={{ y: above ? -6 : 6, scale: 1.03 }}
                onClick={() => setSelected(ev._id)}
                onHoverStart={() => setHoveredId(ev._id)}
                onHoverEnd={() => setHoveredId(null)}
                initial={{ opacity: 0, y: above ? -20 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06, type: 'spring', damping: 20 }}
              >
                {/* Top accent bar */}
                <div className="hv-card-bar" style={{ background: `linear-gradient(90deg, ${color}, ${color}55)` }} />

                {/* Photo thumbnail */}
                {ev.media?.[0]?.url && (
                  <div className="hv-card-thumb">
                    <img src={ev.media[0].url} alt="" />
                    {ev.media.length > 1 && (
                      <span className="hv-card-thumb-count">+{ev.media.length - 1}</span>
                    )}
                  </div>
                )}

                <div className="hv-card-body">
                  <div className="hv-card-emoji-row">
                    <span className="hv-card-emoji">{emoji}</span>
                    {ev.isPrivate && <span className="hv-card-private">🔒</span>}
                    <span className="hv-card-num">#{idx + 1}</span>
                  </div>
                  <div className="hv-card-title">{ev.title}</div>
                  <div className="hv-card-date">
                    {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  {ev.location && <div className="hv-card-loc">📍 {ev.location}</div>}
                  {ev.people?.length > 0 && (
                    <div className="hv-card-people">
                      {ev.people.slice(0, 3).map(p => (
                        <span key={p} className="hv-card-person-dot" title={p}>{p[0].toUpperCase()}</span>
                      ))}
                      {ev.people.length > 3 && <span className="hv-card-person-more">+{ev.people.length - 3}</span>}
                    </div>
                  )}
                  {ev.tags?.length > 0 && (
                    <div className="hv-card-tags">
                      {ev.tags.slice(0, 2).map(t => <span key={t} className="hv-card-tag">#{t}</span>)}
                    </div>
                  )}
                </div>

                <div className="hv-card-click-hint">Click to explore →</div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Detail overlay ── */}
      <AnimatePresence>
        {selected && selectedLayout && (
          <MemoryDetail
            item={selectedLayout}
            rank={layout.findIndex(l => l.ev._id === selected) + 1}
            total={layout.length}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
