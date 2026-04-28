import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './ConstellationView.css';

const MOOD_COLORS = {
  joyful:'#f59e0b', nostalgic:'#8b5cf6', proud:'#10b981', sad:'#6b7280',
  excited:'#ef4444', peaceful:'#06b6d4', grateful:'#ec4899', adventurous:'#f97316',
};
const MOOD_EMOJIS = {
  joyful:'😄', nostalgic:'🌙', proud:'🏆', sad:'💧',
  excited:'⚡', peaceful:'🕊', grateful:'🌸', adventurous:'🗺',
};

/* ── Compute links between events sharing tags, people, or location ── */
function computeLinks(events) {
  const links = [];
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i], b = events[j];
      let strength = 0;
      const reasons = [];

      // Shared tags
      const sharedTags = (a.tags||[]).filter(t => (b.tags||[]).includes(t));
      if (sharedTags.length) { strength += sharedTags.length * 2; reasons.push(`tags: ${sharedTags.join(', ')}`); }

      // Shared people
      const sharedPeople = (a.people||[]).filter(p => (b.people||[]).includes(p));
      if (sharedPeople.length) { strength += sharedPeople.length * 3; reasons.push(`people: ${sharedPeople.join(', ')}`); }

      // Same location
      if (a.location && b.location && a.location === b.location) { strength += 4; reasons.push(`location: ${a.location}`); }

      // Same mood
      if (a.mood && a.mood === b.mood) { strength += 1; reasons.push(`mood: ${a.mood}`); }

      if (strength > 0) {
        links.push({ source: a._id, target: b._id, strength, reasons });
      }
    }
  }
  return links;
}

/* ── Background Stars ── */
const BackgroundStars = ({ width, height }) => {
  const stars = useMemo(() => {
    return Array.from({ length: 150 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5,
      opacity: Math.random() * 0.4 + 0.1,
      duration: Math.random() * 3 + 2
    }));
  }, [width, height]);

  return (
    <g className="bg-stars">
      {stars.map((star, i) => (
        <motion.circle
          key={i}
          cx={star.x}
          cy={star.y}
          r={star.size}
          fill="white"
          initial={{ opacity: star.opacity }}
          animate={{ opacity: [star.opacity, star.opacity * 0.3, star.opacity] }}
          transition={{ duration: star.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </g>
  );
};

/* ── Compute chronological layout ── */
function computeTimelinePositions(events, w, h) {
  if (events.length === 0) return {};
  const sorted = [...events].sort((a,b) => new Date(a.date) - new Date(b.date));
  const minDate = new Date(sorted[0].date).getTime();
  const maxDate = new Date(sorted[sorted.length-1].date).getTime();
  const timeRange = Math.max(maxDate - minDate, 1);
  
  const positions = {};
  const padding = 100;
  
  sorted.forEach((ev, i) => {
    const timeRatio = (new Date(ev.date).getTime() - minDate) / timeRange;
    
    // Create a wave/constellation pattern
    // X progresses with time
    const x = padding + timeRatio * (w - padding * 2);
    
    // Y oscillates to create a natural constellation look
    const angle = timeRatio * Math.PI * 4; // 2 full waves
    const y = h / 2 + Math.sin(angle + i) * (h * 0.25) + (Math.random() - 0.5) * 40;
    
    positions[ev._id] = { x, y, index: i };
  });
  
  return positions;
}

/* ── Main ── */
export default function ConstellationView({ events }) {
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ w: 900, h: 600 });
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const links = useMemo(() => computeLinks(events), [events]);
  const nodes = useMemo(() => computeTimelinePositions(events, dims.w, dims.h), [events, dims.w, dims.h]);
  const evMap = useMemo(() => { const m = {}; events.forEach(ev => { m[ev._id] = ev; }); return m; }, [events]);

  const selectedEv = selected ? evMap[selected] : null;

  // Links connected to hovered node
  const hoveredLinks = useMemo(() => {
    if (!hovered) return new Set();
    const s = new Set();
    links.forEach(l => { if (l.source === hovered || l.target === hovered) { s.add(l.source); s.add(l.target); } });
    return s;
  }, [hovered, links]);

  if (!events.length) {
    return (
      <div className="cv-empty">
        <div className="empty-icon animate-float">✦</div>
        <h3>No constellation to map</h3>
        <p>Add memories with shared tags, people, or locations to see connections bloom.</p>
      </div>
    );
  }

  return (
    <div className="cv-wrapper" ref={wrapRef}>
      <div className="cv-info-badge">
        {events.length} stars · {links.length} connections
      </div>

      <svg className="cv-svg" width={dims.w} height={dims.h}>
        <defs>
          <filter id="cv-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <BackgroundStars width={dims.w} height={dims.h} />

        {/* Links */}
        {links.map((link, i) => {
          const a = nodes[link.source], b = nodes[link.target];
          if (!a || !b) return null;
          const isHighlighted = hovered && (link.source === hovered || link.target === hovered);
          const colorA = MOOD_COLORS[evMap[link.source]?.mood] || '#c4813a';
          const colorB = MOOD_COLORS[evMap[link.target]?.mood] || '#c4813a';
          const gradId = `cv-lg-${i}`;
          return (
            <g key={`${link.source}-${link.target}`}>
              <defs>
                <linearGradient id={gradId} x1={a.x} y1={a.y} x2={b.x} y2={b.y} gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={colorA} stopOpacity={isHighlighted ? 0.4 : 0.08} />
                  <stop offset="100%" stopColor={colorB} stopOpacity={isHighlighted ? 0.4 : 0.08} />
                </linearGradient>
              </defs>
              <motion.line
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.5, delay: i * 0.01 }}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={`url(#${gradId})`}
                strokeWidth={isHighlighted ? 2 : 1}
                className={isHighlighted ? 'cv-link--active' : ''}
              />
            </g>
          );
        })}

        {/* Main chronological path */}
        {events.length > 1 && [...events].sort((a,b) => new Date(a.date) - new Date(b.date)).map((ev, i, arr) => {
          if (i === 0) return null;
          const a = nodes[arr[i-1]._id];
          const b = nodes[ev._id];
          if (!a || !b) return null;
          return (
            <motion.line
              key={`path-${i}`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.2 }}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="white"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Nodes */}
        {events.map(ev => {
          const pos = nodes[ev._id];
          if (!pos) return null;
          const color = ev.color || MOOD_COLORS[ev.mood] || '#c4813a';
          const isActive = hovered === ev._id || (hovered && hoveredLinks.has(ev._id));
          const isSelected = selected === ev._id;
          const linkCount = links.filter(l => l.source === ev._id || l.target === ev._id).length;
          const r = Math.min(4 + linkCount, 10);

          return (
            <motion.g key={ev._id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: (pos.index || 0) * 0.05 }}
              onClick={() => setSelected(prev => prev === ev._id ? null : ev._id)}
              onMouseEnter={() => setHovered(ev._id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Pulsing Outer Glow */}
              <motion.circle 
                cx={pos.x} cy={pos.y} r={r + 15} 
                fill={color} 
                animate={{ opacity: [0.05, 0.15, 0.05], scale: [1, 1.2, 1] }}
                transition={{ duration: 3 + Math.random() * 2, repeat: Infinity }}
                filter="url(#cv-glow)"
              />
              
              {/* Main Dot */}
              <circle cx={pos.x} cy={pos.y} r={isSelected ? r + 3 : r}
                fill={color} 
                className="cv-node-main"
                style={{ filter: 'url(#cv-glow)' }}
              />
              
              {/* Core Star */}
              <circle cx={pos.x} cy={pos.y} r={2} fill="white" opacity={0.9} />

              {/* Label */}
              {(isActive || isSelected) && (
                <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <text x={pos.x} y={pos.y - r - 12} textAnchor="middle"
                    fill="white" fontSize="10" fontWeight="500"
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                    {ev.title}
                  </text>
                  <text x={pos.x} y={pos.y - r - 2} textAnchor="middle"
                    fill="rgba(255,255,255,0.6)" fontSize="8">
                    {new Date(ev.date).toLocaleDateString()}
                  </text>
                </motion.g>
              )}
            </motion.g>
          );
        })}
      </svg>

      {/* Selected detail card */}
      <AnimatePresence>
        {selectedEv && nodes[selected] && (
          <motion.div
            className="cv-detail"
            style={{ left: Math.min(nodes[selected].x + 20, dims.w - 280), top: Math.max(nodes[selected].y - 100, 10) }}
            initial={{ opacity: 0, scale: 0.9, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="cv-detail-bar" style={{ background: selectedEv.color || MOOD_COLORS[selectedEv.mood] || '#c4813a' }} />
            <button className="cv-detail-close" onClick={() => setSelected(null)}>✕</button>
            <div className="cv-detail-emoji">{MOOD_EMOJIS[selectedEv.mood] || '✦'}</div>
            <h3 className="cv-detail-title">{selectedEv.title}</h3>
            <div className="cv-detail-date">{new Date(selectedEv.date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</div>
            {selectedEv.location && <div className="cv-detail-loc">📍 {selectedEv.location}</div>}
            {selectedEv.description && (
              <p className="cv-detail-desc">{selectedEv.description.slice(0, 120)}{selectedEv.description.length > 120 ? '…' : ''}</p>
            )}
            {/* Connections list */}
            <div className="cv-detail-connections">
              <div className="cv-detail-conn-label">🔗 Connections</div>
              {links.filter(l => l.source === selected || l.target === selected).slice(0, 5).map((l, i) => {
                const otherId = l.source === selected ? l.target : l.source;
                const other = evMap[otherId];
                return (
                  <div key={i} className="cv-detail-conn-row"
                    onClick={() => setSelected(otherId)} style={{ cursor: 'pointer' }}>
                    <span className="cv-detail-conn-dot" style={{ background: other?.color || MOOD_COLORS[other?.mood] || '#c4813a' }} />
                    <span className="cv-detail-conn-title">{other?.title?.slice(0, 25)}</span>
                    <span className="cv-detail-conn-reason">{l.reasons[0]}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="cv-hint">Hover to highlight connections · Click to inspect · Linked by shared tags, people & locations</div>
    </div>
  );
}
