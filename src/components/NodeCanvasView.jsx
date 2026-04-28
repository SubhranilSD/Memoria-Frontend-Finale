import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import './NodeCanvasView.css';

/* ── Constants ── */
const MOOD_EMOJIS = {
  joyful:'😄', nostalgic:'🌙', proud:'🏆', sad:'💧',
  excited:'⚡', peaceful:'🕊', grateful:'🌸', adventurous:'🗺',
};
const MOOD_COLORS = {
  joyful:'#f59e0b', nostalgic:'#8b5cf6', proud:'#10b981', sad:'#6b7280',
  excited:'#ef4444', peaceful:'#06b6d4', grateful:'#ec4899', adventurous:'#f97316',
};
const NODE_W = 182;
const NODE_H = 140;
const MINIMAP_W = 150;
const MINIMAP_H = 95;

/* ── Layout: chronological rows × mood columns ── */
function computeInitialPositions(events) {
  const positions = {};
  if (!events.length) return positions;

  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
  const COLS = Math.ceil(Math.sqrt(sorted.length * 1.4));
  const H_GAP = NODE_W + 60;
  const V_GAP = NODE_H + 70;
  const originX = 80;
  const originY = 80;

  sorted.forEach((ev, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    // Stagger alternate rows slightly for a natural feel
    const stagger = (row % 2 === 1) ? H_GAP / 2 : 0;
    positions[ev._id] = {
      x: originX + col * H_GAP + stagger,
      y: originY + row * V_GAP,
    };
  });
  return positions;
}

/* ── Node size based on richness ── */
function nodeSize(event) {
  let w = NODE_W, h = NODE_H;
  if (event.media?.length > 0) { w += 10; h += 10; }
  if (event.description?.length > 80) { h += 12; }
  if (event.tags?.length > 3) { h += 8; }
  return { w, h };
}

function formatFullDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
}
function formatYear(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month:'short', year:'numeric' });
}
function getYear(dateStr) { return new Date(dateStr).getFullYear(); }

/* ── Gradient connection between two colors ── */
function Connection({ id, from, to, colorA, colorB, timeDiffDays }) {
  const x1 = from.x + from.w / 2;
  const y1 = from.y + from.h / 2;
  const x2 = to.x + to.w / 2;
  const y2 = to.y + to.h / 2;
  const cx1 = x1 + (x2 - x1) * 0.3;
  const cy1 = y1 - Math.abs(x2 - x1) * 0.15;
  const cx2 = x1 + (x2 - x1) * 0.7;
  const cy2 = y2 - Math.abs(x2 - x1) * 0.15;

  // Thicker line = events closer in time
  const strokeW = Math.max(0.8, Math.min(2.5, 180 / Math.max(timeDiffDays, 1)));
  const gradId = `grad-${id}`;

  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={colorA} stopOpacity="0.5" />
          <stop offset="100%" stopColor={colorB} stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <path
        d={`M ${x1} ${y1} C ${cx1} ${cy1} ${cx2} ${cy2} ${x2} ${y2}`}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={strokeW}
        strokeDasharray="6 5"
        className="nc-connection"
      />
    </>
  );
}

/* ── Year floating label ── */
function YearLabel({ year, x, y }) {
  return (
    <div className="nc-year-label" style={{ left: x, top: y }}>
      {year}
    </div>
  );
}

/* ── Mood legend ── */
function MoodLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className={`nc-legend ${open ? 'nc-legend--open' : ''}`}>
      <button className="nc-legend-toggle" onClick={() => setOpen(o => !o)} title="Mood legend">
        {open ? '✕' : '◐ Legend'}
      </button>
      {open && (
        <div className="nc-legend-body">
          {Object.entries(MOOD_EMOJIS).map(([k, emoji]) => (
            <div key={k} className="nc-legend-row">
              <span className="nc-legend-dot" style={{ background: MOOD_COLORS[k] }} />
              <span>{emoji} {k.charAt(0).toUpperCase() + k.slice(1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Mini-map ── */
function MiniMap({ events, positions, sizes, viewport, canvasEl, connections }) {
  const visibleEvents = events.filter(ev => positions[ev._id]);
  if (!visibleEvents.length) return null;

  const xs = visibleEvents.map(ev => positions[ev._id].x);
  const ys = visibleEvents.map(ev => positions[ev._id].y);
  const minX = Math.min(...xs) - 20;
  const maxX = Math.max(...xs) + NODE_W + 20;
  const minY = Math.min(...ys) - 20;
  const maxY = Math.max(...ys) + NODE_H + 20;
  const worldW = Math.max(maxX - minX, 1);
  const worldH = Math.max(maxY - minY, 1);
  const scale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH) * 0.88;

  const toMap = (x, y) => ({
    mx: (x - minX) * scale + (MINIMAP_W - worldW * scale) / 2,
    my: (y - minY) * scale + (MINIMAP_H - worldH * scale) / 2,
  });

  // Viewport rect in world coords
  const vpW = (canvasEl?.clientWidth  || 900) / viewport.scale;
  const vpH = (canvasEl?.clientHeight || 500) / viewport.scale;
  const vpX = -viewport.x / viewport.scale;
  const vpY = -viewport.y / viewport.scale;
  const vp = toMap(vpX, vpY);

  return (
    <div className="nc-minimap">
      <svg width={MINIMAP_W} height={MINIMAP_H}>
        {/* Connections */}
        {connections.map((c, i) => {
          const a = toMap(c.from.x + c.from.w/2, c.from.y + c.from.h/2);
          const b = toMap(c.to.x   + c.to.w/2,   c.to.y   + c.to.h/2);
          return <line key={i} x1={a.mx} y1={a.my} x2={b.mx} y2={b.my}
            stroke={c.colorA} strokeWidth="0.8" strokeOpacity="0.35" />;
        })}
        {/* Nodes */}
        {visibleEvents.map(ev => {
          const { mx, my } = toMap(positions[ev._id].x, positions[ev._id].y);
          const s = sizes[ev._id] || { w: NODE_W, h: NODE_H };
          const color = ev.color || MOOD_COLORS[ev.mood] || '#c4813a';
          return (
            <rect key={ev._id} x={mx} y={my}
              width={s.w * scale} height={s.h * scale}
              rx="2" fill={color} fillOpacity="0.7"
            />
          );
        })}
        {/* Viewport rect */}
        <rect
          x={vp.mx} y={vp.my}
          width={vpW * scale} height={vpH * scale}
          fill="none" stroke="rgba(255,255,255,0.5)"
          strokeWidth="1" strokeDasharray="3 2"
        />
      </svg>
      <div className="nc-minimap-label">Overview</div>
    </div>
  );
}

/* ── Event node ── */
function EventNode({ event, pos, size, onDragEnd, onEdit, editMode, isSelected, onSelect, rank }) {
  const dragging = useRef(false);
  const startMouse = useRef({ x:0, y:0 });
  const startPos   = useRef({ x:0, y:0 });
  const hasDragged = useRef(false);

  const color = event.color || MOOD_COLORS[event.mood] || '#c4813a';
  const emoji = MOOD_EMOJIS[event.mood] || '✦';
  const hasMedia = event.media?.length > 0;
  const hasDesc  = event.description?.length > 0;

  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    dragging.current  = true;
    hasDragged.current = false;
    startMouse.current = { x: e.clientX, y: e.clientY };
    startPos.current   = { x: pos.x, y: pos.y };

    const onMove = (mv) => {
      if (!dragging.current) return;
      const dx = mv.clientX - startMouse.current.x;
      const dy = mv.clientY - startMouse.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged.current = true;
      onDragEnd(event._id, { x: startPos.current.x + dx, y: startPos.current.y + dy });
    };
    const onUp = (up) => {
      dragging.current = false;
      const dx = up.clientX - startMouse.current.x;
      const dy = up.clientY - startMouse.current.y;
      if (!hasDragged.current) { onSelect(event._id); }
      else { onDragEnd(event._id, { x: startPos.current.x + dx, y: startPos.current.y + dy }); }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [event._id, pos, onDragEnd, onSelect]);

  return (
    <div
      className={`nc-node ${isSelected ? 'nc-node--selected' : ''} ${hasMedia ? 'nc-node--has-media' : ''}`}
      style={{ left: pos.x, top: pos.y, '--node-color': color, width: size.w, height: size.h }}
      onMouseDown={handleMouseDown}
    >
      {/* Rank badge */}
      <div className="nc-node-rank">#{rank}</div>

      {/* Color top bar */}
      <div className="nc-node-top-bar" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

      {/* Glow ring on selected */}
      <div className="nc-node-glow" />

      {/* Body */}
      <div className="nc-node-body">
        <div className="nc-node-emoji-row">
          <span className="nc-node-emoji">{emoji}</span>
          <div className="nc-node-chips">
            {hasMedia && <span className="nc-chip nc-chip--photo">📷 {event.media.length}</span>}
            {event.isPrivate && <span className="nc-chip nc-chip--private">🔒</span>}
          </div>
        </div>

        <div className="nc-node-title">{event.title}</div>

        <div className="nc-node-meta">
          {event.location && <span className="nc-node-loc">📍 {event.location}</span>}
          <span className="nc-node-date">{formatYear(event.date)}</span>
        </div>

        {event.tags?.length > 0 && (
          <div className="nc-node-tags">
            {event.tags.slice(0, 3).map(t => (
              <span key={t} className="nc-node-tag">#{t}</span>
            ))}
            {event.tags.length > 3 && <span className="nc-node-tag-more">+{event.tags.length - 3}</span>}
          </div>
        )}
      </div>

      {/* Selected popup */}
      {isSelected && (
        <div className="nc-node-popup" onClick={e => e.stopPropagation()}>
          <div className="nc-popup-header">
            <span className="nc-popup-emoji">{emoji}</span>
            <div>
              <div className="nc-popup-title">{event.title}</div>
              <div className="nc-popup-date">{formatFullDate(event.date)}</div>
            </div>
          </div>

          {event.location && (
            <div className="nc-popup-row">
              <span className="nc-popup-icon">📍</span>
              <span>{event.location}</span>
            </div>
          )}

          {hasDesc && (
            <p className="nc-popup-desc">
              {event.description.slice(0, 180)}{event.description.length > 180 ? '…' : ''}
            </p>
          )}

          {event.tags?.length > 0 && (
            <div className="nc-popup-tags">
              {event.tags.map(t => <span key={t} className="tag">#{t}</span>)}
            </div>
          )}

          {hasMedia && (
            <div className="nc-popup-media-row">
              <span className="nc-popup-icon">📷</span>
              <span>{event.media.length} photo{event.media.length > 1 ? 's' : ''}</span>
              {event.media[0]?.url && (
                <img src={event.media[0].url} alt="" className="nc-popup-thumb" />
              )}
            </div>
          )}

          <div className="nc-popup-mood-bar" style={{ background: `linear-gradient(90deg, ${color}30, ${color}80)`, borderLeft: `3px solid ${color}` }}>
            {emoji} {event.mood}
          </div>

          {editMode && (
            <button className="btn btn-ghost btn-sm nc-popup-edit" onClick={() => onEdit(event)}>
              ✎ Edit Memory
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════
   MAIN CANVAS
   ═══════════════════════════════ */
export default function NodeCanvasView({ events, editMode, onEdit }) {
  const canvasRef  = useRef(null);
  const isPanning  = useRef(false);
  const panStart   = useRef({ x:0, y:0 });

  const [viewport,  setViewport]  = useState({ x:0, y:0, scale:1 });
  const [positions, setPositions] = useState(() => computeInitialPositions(events));
  const [selectedId, setSelectedId] = useState(null);
  const [showMinimap, setShowMinimap] = useState(true);

  /* Node sizes (memoised per event id) */
  const sizes = useMemo(() => {
    const s = {};
    events.forEach(ev => { s[ev._id] = nodeSize(ev); });
    return s;
  }, [events]);

  /* Re-layout on events change */
  useEffect(() => {
    setPositions(prev => {
      const next = { ...prev };
      const initial = computeInitialPositions(events);
      events.forEach((ev) => {
        if (!next[ev._id]) next[ev._id] = initial[ev._id] || { x:200, y:200 };
      });
      Object.keys(next).forEach(id => {
        if (!events.find(e => e._id === id)) delete next[id];
      });
      return next;
    });
  }, [events]);

  /* Sorted chronologically for connections & ranking */
  const sorted = useMemo(() => [...events].sort((a,b) => new Date(a.date)-new Date(b.date)), [events]);

  /* Connections: chronological pairs with time diff & colors */
  const connections = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i+1];
      if (!positions[a._id] || !positions[b._id]) continue;
      const diff = Math.round((new Date(b.date) - new Date(a.date)) / 86400000);
      pairs.push({
        id: `${a._id}-${b._id}`,
        from: { ...positions[a._id], ...sizes[a._id] },
        to:   { ...positions[b._id], ...sizes[b._id] },
        colorA: a.color || MOOD_COLORS[a.mood] || '#c4813a',
        colorB: b.color || MOOD_COLORS[b.mood] || '#c4813a',
        timeDiffDays: diff,
      });
    }
    return pairs;
  }, [sorted, positions, sizes]);

  /* Year group centroids for floating labels */
  const yearLabels = useMemo(() => {
    const groups = {};
    sorted.forEach(ev => {
      const yr = getYear(ev.date);
      if (!groups[yr]) groups[yr] = [];
      if (positions[ev._id]) groups[yr].push(positions[ev._id]);
    });
    return Object.entries(groups).map(([year, pts]) => ({
      year,
      x: pts.reduce((s,p) => s + p.x, 0) / pts.length + NODE_W / 2,
      y: Math.min(...pts.map(p => p.y)) - 44,
    }));
  }, [sorted, positions]);

  /* Rank map (1-based, chronological) */
  const rankMap = useMemo(() => {
    const m = {};
    sorted.forEach((ev, i) => { m[ev._id] = i + 1; });
    return m;
  }, [sorted]);

  /* ── Pan ── */
  const onCanvasMouseDown = useCallback((e) => {
    const cls = e.target.classList;
    if (!cls.contains('nc-canvas') && !cls.contains('nc-canvas-svg') && !cls.contains('nc-world-bg')) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX - viewport.x, y: e.clientY - viewport.y };
    setSelectedId(null);
    const onMove = (mv) => {
      if (!isPanning.current) return;
      setViewport(v => ({ ...v, x: mv.clientX - panStart.current.x, y: mv.clientY - panStart.current.y }));
    };
    const onUp = () => {
      isPanning.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [viewport.x, viewport.y]);

  /* ── Zoom (cursor-anchored) ── */
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect   = canvasRef.current?.getBoundingClientRect();
    const mouseX = (e.clientX - (rect?.left || 0) - viewport.x) / viewport.scale;
    const mouseY = (e.clientY - (rect?.top  || 0) - viewport.y) / viewport.scale;
    const factor = e.deltaY > 0 ? 0.92 : 1.09;
    setViewport(v => {
      const newScale = Math.max(0.25, Math.min(3, v.scale * factor));
      return {
        scale: newScale,
        x: e.clientX - (rect?.left || 0) - mouseX * newScale,
        y: e.clientY - (rect?.top  || 0) - mouseY * newScale,
      };
    });
  }, [viewport]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const handleDragEnd = useCallback((id, newPos) => {
    setPositions(prev => ({ ...prev, [id]: newPos }));
  }, []);

  const resetView   = () => setViewport({ x: 0, y: 0, scale: 1 });
  const resetLayout = () => { setPositions(computeInitialPositions(events)); };
  const fitAll      = () => {
    const pts = events.map(ev => positions[ev._id]).filter(Boolean);
    if (!pts.length || !canvasRef.current) return;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const W = canvasRef.current.clientWidth, H = canvasRef.current.clientHeight;
    const worldW = Math.max(...xs) + NODE_W - Math.min(...xs);
    const worldH = Math.max(...ys) + NODE_H - Math.min(...ys);
    const s = Math.max(0.25, Math.min(2, Math.min(W / (worldW + 120), H / (worldH + 120))));
    const cx = W/2 - (Math.min(...xs) + worldW/2) * s;
    const cy = H/2 - (Math.min(...ys) + worldH/2) * s;
    setViewport({ x: cx, y: cy, scale: s });
  };

  if (!events.length) {
    return (
      <div className="nc-empty">
        <div className="empty-icon animate-float">✦</div>
        <h3>No memories to map</h3>
        <p>Add some memories to see them bloom on the canvas.</p>
      </div>
    );
  }

  return (
    <div className="nc-wrapper">
      {/* Control bar */}
      <div className="nc-controls">
        <button className="nc-ctrl-btn" onClick={resetView}   title="Reset view">⊙</button>
        <button className="nc-ctrl-btn" onClick={fitAll}      title="Fit all nodes">⊞</button>
        <button className="nc-ctrl-btn" onClick={resetLayout} title="Re-arrange">⟳</button>
        <div className="nc-ctrl-divider" />
        <button className="nc-ctrl-btn" onClick={() => setViewport(v => ({...v, scale: Math.min(3, v.scale*1.15)}))} title="Zoom in">+</button>
        <span className="nc-scale-label">{Math.round(viewport.scale*100)}%</span>
        <button className="nc-ctrl-btn" onClick={() => setViewport(v => ({...v, scale: Math.max(0.25, v.scale*0.87)}))} title="Zoom out">−</button>
        <div className="nc-ctrl-divider" />
        <button className={`nc-ctrl-btn ${showMinimap ? 'nc-ctrl-btn--active' : ''}`}
          onClick={() => setShowMinimap(m => !m)} title="Toggle minimap">◫</button>
        <span className="nc-ctrl-info">{events.length} nodes</span>
      </div>

      {/* Hint bar */}
      <div className="nc-hint">
        Scroll to zoom · Drag canvas to pan · Click node to inspect · Drag node to reposition
      </div>

      {/* Canvas */}
      <div ref={canvasRef} className="nc-canvas" onMouseDown={onCanvasMouseDown} onClick={() => setSelectedId(null)}>
        <div
          className="nc-world"
          style={{ transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`, transformOrigin:'0 0' }}
        >
          {/* Dot grid background plane (CSS) */}
          <div className="nc-world-bg" />

          {/* SVG connections */}
          <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', overflow:'visible', pointerEvents:'none' }} className="nc-canvas-svg">
            {connections.map(c => (
              <Connection key={c.id} {...c} />
            ))}
          </svg>

          {/* Year labels */}
          {yearLabels.map(({ year, x, y }) => (
            <YearLabel key={year} year={year} x={x} y={y} />
          ))}

          {/* Nodes */}
          {events.map(event => {
            const pos  = positions[event._id];
            const size = sizes[event._id] || { w: NODE_W, h: NODE_H };
            if (!pos) return null;
            return (
              <EventNode
                key={event._id}
                event={event}
                pos={pos}
                size={size}
                onDragEnd={handleDragEnd}
                onEdit={onEdit}
                editMode={editMode}
                isSelected={selectedId === event._id}
                onSelect={id => setSelectedId(prev => prev === id ? null : id)}
                rank={rankMap[event._id] || 0}
              />
            );
          })}
        </div>
      </div>

      {/* Mood legend */}
      <MoodLegend />

      {/* Mini-map */}
      {showMinimap && (
        <MiniMap
          events={events}
          positions={positions}
          sizes={sizes}
          viewport={viewport}
          canvasEl={canvasRef.current}
          connections={connections}
        />
      )}
    </div>
  );
}
