import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './HighlightsReel.css';

export default function HighlightsReel({ events = [], onClose, isBdayReel, filterUrls = [], onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const reelItems = useMemo(() => {
    if (isBdayReel && filterUrls.length > 0) {
      // Flatten all matching media items from the events
      const items = [];
      events.forEach(e => {
        (e.media || []).forEach(m => {
          if (filterUrls.includes(m.url)) {
            items.push({ event: e, mediaUrl: m.url });
          }
        });
      });
      return items.sort((a,b) => new Date(a.event.date) - new Date(b.event.date));
    }
    
    return events
      .filter(e => e.media?.length > 0)
      .sort((a,b) => new Date(a.date) - new Date(b.date))
      .slice(-10)
      .map(e => ({ event: e, mediaUrl: e.media[0].url }));
  }, [events, isBdayReel, filterUrls]);

  useEffect(() => {
    if (reelItems.length === 0) return;
    const timer = setInterval(() => {
      handleNext();
    }, 5000);
    return () => clearInterval(timer);
  }, [reelItems, currentIndex, onComplete]); // Re-run effect when index changes to reset timer

  const handleNext = () => {
    setCurrentIndex(prev => {
      const next = prev + 1;
      if (next >= reelItems.length) {
        if (onComplete) onComplete();
        return 0;
      }
      return next;
    });
  };

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + reelItems.length) % reelItems.length);
  };

  if (reelItems.length === 0) return null;

  const current = reelItems[currentIndex];

  return (
    <div className="hr-overlay">
      <div className="hr-backdrop" onClick={onClose} />
      
      <div className="hr-container">
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentIndex}
            className="hr-slide"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            <div className="hr-image-wrap">
              <img src={current.mediaUrl} alt="" className="hr-image" />
              <div className="hr-vignette" />
            </div>
            
            <div className="hr-content">
              <motion.div 
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                <span className="hr-date">{new Date(current.event.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                <h1 className="hr-title">{current.event.title}</h1>
                <p className="hr-location">📍 {current.event.location || 'A special place'}</p>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        <button className="hr-nav-btn hr-prev" onClick={(e) => { e.stopPropagation(); handlePrev(); }}>
          <span className="nav-arrow">‹</span>
        </button>
        <button className="hr-nav-btn hr-next" onClick={(e) => { e.stopPropagation(); handleNext(); }}>
          <span className="nav-arrow">›</span>
        </button>

        {/* Progress bar */}
        <div className="hr-progress-container">
          {reelItems.map((_, i) => (
            <div 
              key={`${i}-${currentIndex}`} // Force re-render of progress bar to reset animation
              className={`hr-progress-bar ${i === currentIndex ? 'active' : i < currentIndex ? 'done' : ''}`}
            />
          ))}
        </div>

        <button className="hr-close" onClick={onClose}>✕ Close</button>
      </div>
    </div>
  );
}
