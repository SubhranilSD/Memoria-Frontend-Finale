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

/* ── Simple force simulation (no d3 dependency) ── */
function useForceSimulation(events, links, canvasW, canvasH) {
  const [nodes, setNodes] = useState({});
  const frameRef = useRef(null);
  const velocities = useRef({});
  const running = useRef(true);

  useEffect(() => {
    // Initialize positions in a circle
    const initial = {};
    const vels = {};
    const cx = canvasW / 2, cy = canvasH / 2;
    const radius = Math.min(canvasW, canvasH) * 0.35;
    events.forEach((ev, i) => {
      const angle = (i / events.length) * Math.PI * 2;
      initial[ev._id] = { x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 40, y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 40 };
      vels[ev._id] = { vx: 0, vy: 0 };
    });
    velocities.current = vels;
    setNodes(initial);
    running.current = true;

    let tick = 0;
    const maxTicks = 200;
    const simulate = () => {
      if (!running.current || tick >= maxTicks) return;
      tick++;
      const alpha = 1 - tick / maxTicks;
      const damping = 0.92;
      const repulsion = 3000;
      const attraction = 0.008;
      const centerPull = 0.002;

      setNodes(prev => {
        const next = {};
        const ids = Object.keys(prev);

        // Reset forces
        const forces = {};
        ids.forEach(id => { forces[id] = { fx: 0, fy: 0 }; });

        // Repulsion (all pairs)
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const a = prev[ids[i]], b = prev[ids[j]];
            let dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.max(Math.sqrt(dx*dx + dy*dy), 10);
            const force = repulsion / (dist * dist) * alpha;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            forces[ids[i]].fx -= fx; forces[ids[i]].fy -= fy;
            forces[ids[j]].fx += fx; forces[ids[j]].fy += fy;
          }
        }

        // Attraction (links)
        links.forEach(link => {
          const a = prev[link.source], b = prev[link.target];
          if (!a || !b) return;
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const force = attraction * link.strength * alpha;
          const fx = dx * force, fy = dy * force;
          if (forces[link.source]) { forces[link.source].fx += fx; forces[link.source].fy += fy; }
          if (forces[link.target]) { forces[link.target].fx -= fx; forces[link.target].fy -= fy; }
        });

        // Center gravity
        ids.forEach(id => {
          const p = prev[id];
          forces[id].fx += (cx - p.x) * centerPull * alpha;
          forces[id].fy += (cy - p.y) * centerPull * alpha;
        });

        // Apply
        ids.forEach(id => {
          const p = prev[id];
          const v = velocities.current[id] || { vx: 0, vy: 0 };
          v.vx = (v.vx + forces[id].fx) * damping;
          v.vy = (v.vy + forces[id].fy) * damping;
          next[id] = { x: p.x + v.vx, y: p.y + v.vy };
          velocities.current[id] = v;
        });
        return next;
      });

      frameRef.current = requestAnimationFrame(simulate);
    };
    frameRef.current = requestAnimationFrame(simulate);

    return () => { running.current = false; cancelAnimationFrame(frameRef.current); };
  }, [events, links, canvasW, canvasH]);

  return nodes;
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
  const nodes = useForceSimulation(events, links, dims.w, dims.h);
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
          <filter id="cv-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

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
                  <stop offset="0%" stopColor={colorA} stopOpacity={isHighlighted ? 0.6 : 0.15} />
                  <stop offset="100%" stopColor={colorB} stopOpacity={isHighlighted ? 0.6 : 0.15} />
                </linearGradient>
              </defs>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={`url(#${gradId})`}
                strokeWidth={isHighlighted ? 2 : Math.min(link.strength * 0.3, 1.5)}
                className={isHighlighted ? 'cv-link--active' : ''}
              />
            </g>
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
          const r = Math.min(8 + linkCount * 1.5, 18);

          return (
            <g key={ev._id}
              onClick={() => setSelected(prev => prev === ev._id ? null : ev._id)}
              onMouseEnter={() => setHovered(ev._id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Outer glow */}
              {(isActive || isSelected) && (
                <circle cx={pos.x} cy={pos.y} r={r + 8} fill={color} opacity={0.12} filter="url(#cv-glow)" />
              )}
              {/* Outer ring */}
              <circle cx={pos.x} cy={pos.y} r={r + 3}
                fill="none" stroke={color} strokeWidth="1" strokeOpacity={isActive ? 0.6 : 0.2}
              />
              {/* Main dot */}
              <circle cx={pos.x} cy={pos.y} r={r}
                fill={color} opacity={isActive || isSelected ? 0.9 : 0.55}
                filter={isActive ? 'url(#cv-glow)' : undefined}
              />
              {/* Core white dot */}
              <circle cx={pos.x} cy={pos.y} r={Math.max(r * 0.35, 2)}
                fill="white" opacity={0.8}
              />
              {/* Label */}
              {(isActive || isSelected) && (
                <text x={pos.x} y={pos.y - r - 8} textAnchor="middle"
                  fill="var(--text-primary)" fontSize="11" fontWeight="600"
                  fontFamily="'DM Sans', sans-serif">
                  {ev.title?.slice(0, 20)}
                </text>
              )}
            </g>
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
