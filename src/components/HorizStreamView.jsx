import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './HorizStreamView.css';

const MOOD_COLORS = {
  joyful: '#f59e0b', nostalgic: '#8b5cf6', proud: '#10b981', sad: '#6b7280',
  excited: '#ef4444', peaceful: '#06b6d4', grateful: '#ec4899', adventurous: '#f97316',
};
const MOOD_EMOJIS = {
  joyful: '😄', nostalgic: '🌙', proud: '🏆', sad: '💧',
  excited: '⚡', peaceful: '🕊', grateful: '🌸', adventurous: '🗺',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function buildStreamPath(nodes, svgW, svgH) {
  if (nodes.length === 0) return '';
  const cy = svgH / 2;
  const pts = [{ x: 0, y: cy }, ...nodes, { x: svgW, y: cy }];
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const mx = (p0.x + p1.x) / 2;
    d += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export default function HorizStreamView({ events, onSelectEvent }) {
  const trackRef = useRef(null);
  const [svgSize, setSvgSize] = useState({ w: 4000, h: 420 });
  const [nodePositions, setNodePositions] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const [streamPath, setStreamPath] = useState('');
  const [dashOffset, setDashOffset] = useState(0);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY * 1.4;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (!events.length) return;
    const SPACING = 320;
    const WAVE_AMP = 110;
    const SVG_H = 420;
    const totalW = Math.max(events.length * SPACING + 280, window.innerWidth + 200);

    const positions = events.map((e, i) => {
      const x = 140 + i * SPACING;
      const phase = (i / Math.max(events.length - 1, 1)) * Math.PI * 2.5;
      const y = SVG_H / 2 + Math.sin(phase + Math.PI / 5) * WAVE_AMP;
      return { x, y, event: e };
    });

    setSvgSize({ w: totalW, h: SVG_H });
    setNodePositions(positions);
    setStreamPath(buildStreamPath(positions, totalW, SVG_H));
  }, [events]);

  useEffect(() => {
    let t = 0;
    const animate = () => {
      t -= 1.4;
      setDashOffset(t);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  if (!events.length) return null;

  const TENDRIL_OFFSETS = [-32, -60, -82, 32, 60, 82];

  return (
    <div className="hstream-root">
      <div className="hstream-hint">
        <span>←</span>
        <span>Scroll or drag to traverse your timeline</span>
        <span>→</span>
      </div>

      <div className="hstream-track" ref={trackRef}>
        <div style={{ position: 'relative', width: svgSize.w, height: svgSize.h, flexShrink: 0 }}>

          {/* ── SVG Stream ── */}
          <svg
            className="hstream-svg"
            width={svgSize.w}
            height={svgSize.h}
            style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="hsGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#8b5cf6" stopOpacity="0.5" />
                <stop offset="20%"  stopColor="#f59e0b" stopOpacity="0.9" />
                <stop offset="50%"  stopColor="#ffffff" stopOpacity="1"   />
                <stop offset="80%"  stopColor="#ef4444" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="hsGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#8b5cf6" stopOpacity="0.12" />
                <stop offset="30%"  stopColor="#f59e0b" stopOpacity="0.22" />
                <stop offset="50%"  stopColor="#ffffff" stopOpacity="0.28" />
                <stop offset="70%"  stopColor="#ef4444" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.12" />
              </linearGradient>
              <linearGradient id="hsTendril" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#8b5cf6" stopOpacity="0.0" />
                <stop offset="35%"  stopColor="#f59e0b" stopOpacity="0.28" />
                <stop offset="55%"  stopColor="#ffffff" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
              </linearGradient>

              <filter id="hsGlowF" x="-40%" y="-150%" width="180%" height="400%">
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="hsSuperGlow" x="-60%" y="-250%" width="220%" height="600%">
                <feGaussianBlur stdDeviation="22" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="hsNodeGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>

            {streamPath && (
              <>
                {/* Outermost mega halo */}
                <path d={streamPath} fill="none" stroke="url(#hsGlow)"
                  strokeWidth="100" filter="url(#hsSuperGlow)" opacity="0.55" />

                {/* Tendrils diverging above & below */}
                {TENDRIL_OFFSETS.map((dy, idx) => {
                  const sign = dy < 0 ? -1 : 1;
                  const absDy = Math.abs(dy);
                  const tPath = streamPath.replace(
                    /(-?\d+\.?\d*) (-?\d+\.?\d*)/g,
                    (_, px, py) => `${px} ${parseFloat(py) + dy * (0.4 + 0.3 * Math.sin(idx * 1.3))}`
                  );
                  return (
                    <path
                      key={idx}
                      d={tPath}
                      fill="none"
                      stroke="url(#hsTendril)"
                      strokeWidth={idx < 3 ? 1.4 : 0.9}
                      strokeDasharray={`${6 + idx * 4} ${12 + idx * 3}`}
                      strokeDashoffset={dashOffset * (0.5 + idx * 0.12)}
                      opacity={0.38 - idx * 0.04}
                      filter="url(#hsGlowF)"
                    />
                  );
                })}

                {/* Mid glow layer */}
                <path d={streamPath} fill="none" stroke="url(#hsGrad)"
                  strokeWidth="24" filter="url(#hsGlowF)" opacity="0.45" />

                {/* Inner glow */}
                <path d={streamPath} fill="none" stroke="url(#hsGrad)"
                  strokeWidth="8" filter="url(#hsGlowF)" opacity="0.7" />

                {/* Animated dash core */}
                <path d={streamPath} fill="none" stroke="url(#hsGrad)"
                  strokeWidth="2.5"
                  strokeDasharray="22 12"
                  strokeDashoffset={dashOffset}
                  opacity="0.95" />

                {/* Solid bright center line */}
                <path d={streamPath} fill="none" stroke="rgba(255,255,255,0.75)"
                  strokeWidth="1.2" opacity="0.9" />
              </>
            )}

            {/* Node stems (dashed vertical lines connecting node to path) */}
            {nodePositions.map(({ x, y }, i) => {
              const cy = svgSize.h / 2;
              const isAbove = y < cy;
              return (
                <line key={i}
                  x1={x} y1={y}
                  x2={x} y2={y + (isAbove ? 40 : -40)}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="1"
                  strokeDasharray="3 5"
                />
              );
            })}
          </svg>

          {/* ── Memory Nodes ── */}
          {nodePositions.map(({ x, y, event }, i) => {
            const color = event.color || MOOD_COLORS[event.mood] || '#c4813a';
            const isHovered = hoveredId === event._id;
            const aboveCenter = y < svgSize.h / 2;

            return (
              <div
                key={event._id}
                className="hstream-node-wrap"
                style={{ left: x, top: y, zIndex: isHovered ? 50 : 10 }}
                onMouseEnter={() => setHoveredId(event._id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onSelectEvent && onSelectEvent(event)}
              >
                {/* Pulsing glow ring */}
                <div className="hstream-node-pulse" style={{ '--nc': color }} />
                <div className="hstream-node-pulse hstream-node-pulse-2" style={{ '--nc': color }} />

                {/* The node */}
                <motion.div
                  className="hstream-node"
                  style={{ '--nc': color }}
                  whileHover={{ scale: 1.45, boxShadow: `0 0 28px ${color}, 0 0 60px ${color}80` }}
                  transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                >
                  <span className="hstream-node-emoji">{MOOD_EMOJIS[event.mood] || '✦'}</span>
                </motion.div>

                {/* Year label */}
                <div
                  className="hstream-year-label"
                  style={{ color, top: aboveCenter ? 36 : 'auto', bottom: aboveCenter ? 'auto' : 36 }}
                >
                  {event.date ? new Date(event.date).getFullYear() : ''}
                </div>

                {/* Hover preview card */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      className="hstream-card"
                      style={{
                        '--nc': color,
                        position: 'absolute',
                        top: aboveCenter ? 'auto' : undefined,
                        bottom: aboveCenter ? undefined : 'auto',
                        [aboveCenter ? 'bottom' : 'top']: 58,
                        left: '50%',
                        x: '-50%',
                      }}
                      initial={{ opacity: 0, y: aboveCenter ? 12 : -12, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: aboveCenter ? 12 : -12, scale: 0.9 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                    >
                      <div className="hstream-card-top-bar" style={{ background: color }} />

                      {event.media && event.media[0] && (
                        <div className="hstream-card-img-wrap">
                          <img src={event.media[0].url} alt={event.title} />
                          <div className="hstream-card-img-fade" style={{ background: `linear-gradient(to bottom, transparent 40%, #0e0c0a)` }} />
                        </div>
                      )}

                      <div className="hstream-card-body">
                        <div className="hstream-card-date">{formatDate(event.date)}</div>
                        <div className="hstream-card-title">{event.title}</div>
                        {event.location && <div className="hstream-card-loc">📍 {event.location}</div>}
                        <div className="hstream-card-mood" style={{ color }}>
                          {MOOD_EMOJIS[event.mood]} {event.mood}
                        </div>
                        {event.tags && event.tags.length > 0 && (
                          <div className="hstream-card-tags">
                            {event.tags.slice(0, 3).map(t => (
                              <span key={t} className="hstream-tag">#{t}</span>
                            ))}
                          </div>
                        )}
                        <div className="hstream-card-cta">Click to explore →</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
