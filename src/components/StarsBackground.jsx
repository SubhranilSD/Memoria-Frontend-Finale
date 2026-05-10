import { useEffect, useRef } from 'react';

const STAR_COUNT = 200;
const LAYERS = [
  { speed: 0.005, parallax: 0.04, size: [0.1, 0.4] },  // distant
  { speed: 0.015, parallax: 0.12, size: [0.3, 0.7] },  // mid
  { speed: 0.035, parallax: 0.25, size: [0.6, 1.0] },  // close
];

function rand(min, max, seed) {
  const x = Math.sin(seed) * 10000;
  return min + (x - Math.floor(x)) * (max - min);
}

function initStars(canvas) {
  const stars = [];
  let seed = 42;
  for (let l = 0; l < LAYERS.length; l++) {
    const count = Math.floor(STAR_COUNT / LAYERS.length);
    const layer = LAYERS[l];
    for (let i = 0; i < count; i++) {
      seed += 7.3;
      const maxOp = rand(0.1, 0.85, seed + 1.1);
      
      // Color variation
      let r = 255, g = 255, b = 255;
      let sizeBoost = 0;
      const colorRoll = rand(0, 1, seed + 8);
      if (colorRoll < 0.07) { // Red
        r = 255; g = rand(50, 80, seed + 9); b = rand(50, 80, seed + 10);
        sizeBoost = 0.2;
      } else if (colorRoll < 0.14) { // Orange
        r = 255; g = rand(160, 200, seed + 9); b = rand(20, 50, seed + 10);
        sizeBoost = 0.2;
      } else if (colorRoll < 0.21) { // Cyan
        r = rand(50, 100, seed + 9); g = 255; b = 255;
        sizeBoost = 0.2;
      } else if (colorRoll < 0.4) { // Common: Bluish
        r = rand(180, 220, seed + 9); g = rand(220, 255, seed + 10); b = 255;
      }

      stars.push({
        x:          rand(0, canvas.width,  seed),
        y:          rand(0, canvas.height, seed + 1),
        size:       rand(layer.size[0], layer.size[1], seed + 2) + sizeBoost,
        speed:      layer.speed,
        parallax:   layer.parallax,
        layer:      l,
        twinkleFreq: rand(0.3, 1.1, seed + 3),
        twinklePhase: rand(0, Math.PI * 2, seed + 4),
        maxOpacity: sizeBoost > 0 ? rand(0.7, 1.0, seed + 1.1) : maxOp,
        minOpacity: sizeBoost > 0 ? 0.3 : maxOp * 0.05,
        r: Math.round(r),
        g: Math.round(g),
        b: Math.round(b),
        shape: Math.floor(rand(0, 3, seed + 5))
      });
    }
  }
  return stars;
}

export default function StarsBackground() {
  const canvasRef = useRef(null);
  const starsRef  = useRef([]);
  const rafRef    = useRef(null);
  const scrollRef = useRef(0);
  const timeRef   = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      starsRef.current = initStars(canvas);
    };
    resize();
    window.addEventListener('resize', resize);

    const container = document.querySelector('.timeline-main');
    const onScroll = () => { scrollRef.current = container?.scrollTop || 0; };
    container?.addEventListener('scroll', onScroll, { passive: true });

    const draw = (timestamp) => {
      timeRef.current = timestamp * 0.001;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ── DRAW NEBULAE (Slow-moving faint gas) ──
      const isRetro = document.documentElement.classList.contains('retro-mode');
      if (!isRetro) {
        const t = timeRef.current * 0.04;
        const nebulae = [
          { x: 0.1, y: 0.2, r: 0.8, color: 'rgba(15, 23, 42, 0.2)' },    // Deep midnight blue
          { x: 0.8, y: 0.3, r: 0.9, color: 'rgba(30, 27, 75, 0.15)' },   // Dark indigo
          { x: 0.3, y: 0.8, r: 0.7, color: 'rgba(194, 65, 12, 0.03)' },  // Subtle cosmic orange
          { x: 0.7, y: 0.7, r: 0.8, color: 'rgba(190, 24, 93, 0.025)' }, // Subtle nebula pink
          { x: 0.5, y: 0.5, r: 1.2, color: 'rgba(10, 10, 30, 0.3)' },    // Base dark blue void
        ];
        
        nebulae.forEach(n => {
          const shiftX = Math.sin(t * 0.5 + n.x) * 50;
          const shiftY = Math.cos(t * 0.3 + n.y) * 50;
          const grad = ctx.createRadialGradient(
            n.x * canvas.width + shiftX, n.y * canvas.height + shiftY, 0,
            n.x * canvas.width + shiftX, n.y * canvas.height + shiftY, n.r * canvas.width
          );
          grad.addColorStop(0, n.color);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        });
      }

      const stars = starsRef.current;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.y -= s.speed;
        if (s.y < -2) s.y = canvas.height + 2;

        const py = -(scrollRef.current * s.parallax);
        const t = timeRef.current;
        const opacity = s.minOpacity + (s.maxOpacity - s.minOpacity) *
          (0.5 + 0.5 * Math.sin(t * s.twinkleFreq + s.twinklePhase));

        const drawY = ((s.y + py) % (canvas.height + 4) + canvas.height + 4) % (canvas.height + 4);

        if (isRetro) {
          const isLight = document.documentElement.getAttribute('data-theme') === 'light';
          const retroR = isLight ? 0 : 0;
          const retroG = isLight ? 102 : 255;
          const retroB = isLight ? 0 : 255;
          ctx.shadowBlur = 0;
          const px = s.size > 0.8 ? 2 : 1;
          if (s.maxOpacity > 0.6) {
            ctx.shadowBlur = 4;
            ctx.shadowColor = `rgba(${retroR},${retroG},${retroB},${opacity * 0.8})`;
          }
          ctx.fillStyle = `rgba(${retroR},${retroG},${retroB},${opacity})`;
          ctx.fillRect(Math.round(s.x), Math.round(drawY), px, px);
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = `rgba(${s.r},${s.g},${s.b},${opacity})`;
          if (s.maxOpacity > 0.6) {
            ctx.shadowBlur = s.size * 3;
            ctx.shadowColor = `rgba(${s.r},${s.g},${s.b},${opacity * 0.6})`;
          } else {
            ctx.shadowBlur = 0;
          }

          const shape = s.shape || 0;
          if (shape === 1) { // Cross/Plus
            ctx.beginPath();
            ctx.moveTo(s.x - s.size * 1.5, drawY);
            ctx.lineTo(s.x + s.size * 1.5, drawY);
            ctx.moveTo(s.x, drawY - s.size * 1.5);
            ctx.lineTo(s.x, drawY + s.size * 1.5);
            ctx.strokeStyle = `rgba(${s.r},${s.g},${s.b},${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          } else if (shape === 2) { // Diamond
            ctx.beginPath();
            ctx.moveTo(s.x, drawY - s.size);
            ctx.lineTo(s.x + s.size, drawY);
            ctx.lineTo(s.x, drawY + s.size);
            ctx.lineTo(s.x - s.size, drawY);
            ctx.closePath();
            ctx.fill();
          } else { // Default: Circle
            ctx.beginPath();
            ctx.arc(s.x, drawY, s.size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.shadowBlur = 0;
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      container?.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}
