import { useEffect, useRef } from 'react';

const STAR_COUNT = 80;
const LAYERS = [
  { speed: 0.006, parallax: 0.05, size: [0.3, 0.7] },  // distant, slow
  { speed: 0.015, parallax: 0.13, size: [0.5, 1.0] },  // mid
  { speed: 0.03,  parallax: 0.28, size: [0.8, 1.4] },  // close, fast
];

function rand(min, max, seed) {
  // Deterministic pseudo-random using a seed
  const x = Math.sin(seed) * 10000;
  return min + (x - Math.floor(x)) * (max - min);
}

function initStars(canvas) {
  const stars = [];
  let seed = 1;
  for (let l = 0; l < LAYERS.length; l++) {
    const count = Math.floor(STAR_COUNT / LAYERS.length);
    const layer = LAYERS[l];
    for (let i = 0; i < count; i++) {
      seed += 7.3;
      const maxOp = rand(0.15, 0.9, seed + 1.1);
      stars.push({
        x:          rand(0, canvas.width,  seed),
        y:          rand(0, canvas.height, seed + 1),
        size:       rand(layer.size[0], layer.size[1], seed + 2),
        speed:      layer.speed,
        parallax:   layer.parallax,
        layer:      l,
        // Twinkle: each star has its own phase & frequency
        twinkleFreq: rand(0.3, 1.2, seed + 3),
        twinklePhase: rand(0, Math.PI * 2, seed + 4),
        maxOpacity: maxOp,
        minOpacity: maxOp * 0.1,
        // Very slight warm/cool color variation
        r: Math.round(rand(210, 255, seed + 5)),
        g: Math.round(rand(210, 255, seed + 6)),
        b: Math.round(rand(210, 255, seed + 7)),
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

    // Size canvas to full window
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      starsRef.current = initStars(canvas);
    };
    resize();
    window.addEventListener('resize', resize);

    // Track scroll from timeline-main
    const container = document.querySelector('.timeline-main');
    const onScroll = () => { scrollRef.current = container?.scrollTop || 0; };
    container?.addEventListener('scroll', onScroll, { passive: true });

    // Animation loop
    const draw = (timestamp) => {
      timeRef.current = timestamp * 0.001; // seconds
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Check retro mode live so it responds instantly when toggled
      const isRetro = document.documentElement.classList.contains('retro-mode');

      const stars = starsRef.current;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Drift stars upward (wrap around)
        s.y -= s.speed;
        if (s.y < -2) s.y = canvas.height + 2;

        // Parallax offset based on scroll
        const py = -(scrollRef.current * s.parallax);

        // Twinkle: sine wave opacity
        const t = timeRef.current;
        const opacity = s.minOpacity + (s.maxOpacity - s.minOpacity) *
          (0.5 + 0.5 * Math.sin(t * s.twinkleFreq + s.twinklePhase));

        const drawY = ((s.y + py) % (canvas.height + 4) + canvas.height + 4) % (canvas.height + 4);

        if (isRetro) {
          // ── RETRO MODE: crisp square pixels ──
          const isLight = document.documentElement.getAttribute('data-theme') === 'light';
          const retroR = isLight ? 0   : 0;
          const retroG = isLight ? 102 : 255;
          const retroB = isLight ? 0   : 255;

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
          // ── NORMAL MODE: anti-aliased circles with warm glow ──
          if (s.maxOpacity > 0.6) {
            ctx.shadowBlur = s.size * 3;
            ctx.shadowColor = `rgba(${s.r},${s.g},${s.b},${opacity * 0.5})`;
          } else {
            ctx.shadowBlur = 0;
          }
          ctx.beginPath();
          ctx.arc(s.x, drawY, s.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${s.r},${s.g},${s.b},${opacity})`;
          ctx.fill();
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
