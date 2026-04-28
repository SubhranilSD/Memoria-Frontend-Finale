import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './TheOracle.css';

export default function TheOracle({ events = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const prompt = useMemo(() => {
    const now = new Date();
    const lastEvent = events.length > 0 ? new Date(events[events.length - 1].date) : null;
    const daysSince = lastEvent ? Math.round((now - lastEvent) / 86400000) : 999;

    if (daysSince > 7) return "The silence is growing... write something today?";
    
    const creativePrompts = [
      "What did the air smell like this morning?",
      "Write about a conversation that changed your mind.",
      "If today was a color, what would it be?",
      "Record a 10-second sound that defines your space.",
      "Tell me about a dream that felt like reality."
    ];
    return creativePrompts[Math.floor(Math.random() * creativePrompts.length)];
  }, [events, isOpen]);

  return (
    <div className="oracle-wrapper">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="oracle-bubble"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
          >
            <div className="oracle-title">THE ORACLE</div>
            <div className="oracle-text">{prompt}</div>
            <div className="oracle-arrow" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button 
        className="oracle-orb"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={{
          boxShadow: [
            "0 0 20px rgba(99, 102, 241, 0.4)",
            "0 0 40px rgba(168, 85, 247, 0.6)",
            "0 0 20px rgba(99, 102, 241, 0.4)"
          ]
        }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <div className="orb-core" />
        <div className="orb-ring" />
      </motion.button>
    </div>
  );
}
