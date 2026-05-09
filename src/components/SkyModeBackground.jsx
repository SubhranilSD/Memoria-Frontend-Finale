import { useState, useEffect, useRef } from 'react';
import './SkyModeBackground.css';

// Interpolate between two RGB colors based on a factor (0 to 1)
const interpolateColor = (color1, color2, factor) => {
  const result = color1.slice();
  for (let i = 0; i < 3; i++) {
    result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
  }
  return `rgb(${result[0]}, ${result[1]}, ${result[2]})`;
};

// Define the color stops for the sky transition
const SKY_COLORS = [
  { stop: 0.0, color: [5, 5, 15] },       // Deep Space (Black/Purple)
  { stop: 0.2, color: [15, 25, 60] },      // Stratosphere (Dark Blue)
  { stop: 0.5, color: [74, 144, 226] },    // Sky (Light Blue)
  { stop: 0.8, color: [255, 123, 84] },    // Sunset (Orange/Pink)
  { stop: 1.0, color: [255, 180, 100] }    // Earth Horizon (Golden)
];

function getSkyColor(progress) {
  for (let i = 0; i < SKY_COLORS.length - 1; i++) {
    const current = SKY_COLORS[i];
    const next = SKY_COLORS[i + 1];
    if (progress >= current.stop && progress <= next.stop) {
      const range = next.stop - current.stop;
      const factor = (progress - current.stop) / range;
      return interpolateColor(current.color, next.color, factor);
    }
  }
  return progress >= 1 ? `rgb(${SKY_COLORS[SKY_COLORS.length-1].color.join(',')})` : `rgb(${SKY_COLORS[0].color.join(',')})`;
}

export default function SkyModeBackground({ scrollContainerSelector = '.timeline-main' }) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const container = document.querySelector(scrollContainerSelector);
    if (!container) return;

    const handleScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        
        // Prevent division by zero if not scrollable yet
        if (scrollHeight <= clientHeight) {
          setProgress(0);
        } else {
          let p = scrollTop / (scrollHeight - clientHeight);
          setProgress(Math.max(0, Math.min(1, p))); // Clamp between 0 and 1
        }
        rafRef.current = null;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    // Run once on mount to set initial state
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollContainerSelector]);

  // Derived styling values based on progress
  const bgColor = getSkyColor(progress);
  
  // Stars fade out completely by 0.4 progress
  const starsOpacity = Math.max(0, 1 - (progress / 0.4));
  
  // Clouds fade in around 0.3 and stay
  const cloudsOpacity = progress < 0.2 ? 0 : Math.min(1, (progress - 0.2) / 0.2);

  // Earth fades in and moves up at the very bottom
  const earthOpacity = progress < 0.8 ? 0 : Math.min(1, (progress - 0.8) / 0.2);
  const earthY = Math.max(0, 100 * (1 - ((progress - 0.8) / 0.2))); // Slide up from 100px

  return (
    <div className="sky-mode-wrapper" style={{ backgroundColor: bgColor }}>
      
      {/* Parallax Stars */}
      <div 
        className="sky-layer stars-1" 
        style={{ 
          opacity: starsOpacity * 0.8,
          transform: `translate3d(0, ${progress * -200}px, 0)` 
        }} 
      />
      <div 
        className="sky-layer stars-2" 
        style={{ 
          opacity: starsOpacity * 0.6,
          transform: `translate3d(0, ${progress * -400}px, 0)` 
        }} 
      />

      {/* Parallax Clouds */}
      <div className="clouds-base" style={{ opacity: cloudsOpacity }}>
        <div className="cloud-bubble" style={{ width: 300, height: 100, top: '20%', left: '-5%', transform: `translate3d(${progress * 100}px, ${progress * -150}px, 0)` }} />
        <div className="cloud-bubble" style={{ width: 400, height: 150, top: '40%', right: '-10%', transform: `translate3d(${progress * -150}px, ${progress * -300}px, 0)` }} />
        <div className="cloud-bubble" style={{ width: 250, height: 80, top: '60%', left: '15%', transform: `translate3d(${progress * 200}px, ${progress * -250}px, 0)` }} />
        <div className="cloud-bubble" style={{ width: 500, height: 200, top: '80%', right: '5%', opacity: 0.2, transform: `translate3d(${progress * -50}px, ${progress * -400}px, 0)` }} />
      </div>

      {/* Earth Horizon */}
      <div 
        className="earth-base" 
        style={{ 
          opacity: earthOpacity,
          transform: `translate3d(0, ${earthY}px, 0)` 
        }} 
      />
      
    </div>
  );
}
