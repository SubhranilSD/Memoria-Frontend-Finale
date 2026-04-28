import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import './MemoryGuide.css';

export default function MemoryGuide({ events = [] }) {
  const prompt = useMemo(() => {
    const now = new Date();
    const lastEvent = events.length > 0 ? new Date(events[events.length - 1].date) : null;
    const daysSince = lastEvent ? Math.round((now - lastEvent) / 86400000) : 999;

    // 1. Missing time prompts
    if (daysSince > 7) {
      return {
        title: "The silence is loud...",
        text: `It's been ${daysSince} days since your last memory. Did something small happen today that's worth keeping?`,
        icon: "✍️"
      };
    }

    // 2. People-based prompts
    const peopleCounts = {};
    events.forEach(e => (e.people || []).forEach(p => peopleCounts[p] = (peopleCounts[p] || 0) + 1));
    const topPerson = Object.entries(peopleCounts).sort((a,b) => b[1]-a[1])[0];
    
    if (topPerson && Math.random() > 0.7) {
      return {
        title: `Thoughts on ${topPerson[0]}?`,
        text: `You've shared ${topPerson[1]} memories with ${topPerson[0]}. What's one thing you appreciate about them today?`,
        icon: "👥"
      };
    }

    // 3. Vibe-based prompts
    const moods = events.map(e => e.mood);
    const mostCommonMood = moods.sort((a,b) => moods.filter(v => v===a).length - moods.filter(v => v===b).length).pop();
    
    if (mostCommonMood === 'sad') {
      return {
        title: "Finding the light",
        text: "Things have felt a bit heavy lately. Is there a tiny victory or a moment of peace you can record today?",
        icon: "✨"
      };
    }

    // 4. Random creative prompts
    const creativePrompts = [
      "What did the air smell like this morning?",
      "Write about a conversation that changed your mind today.",
      "If today was a song, what would the title be?",
      "Record a 10-second sound that defines your current space.",
      "What's a 'dream' you had recently that felt real?"
    ];

    return {
      title: "Memory Prompt",
      text: creativePrompts[Math.floor(Math.random() * creativePrompts.length)],
      icon: "💡"
    };
  }, [events]);

  return (
    <motion.div 
      className="memory-guide-card glass-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, boxShadow: '0 15px 30px rgba(0,0,0,0.2)' }}
    >
      <div className="mg-header">
        <span className="mg-icon">{prompt.icon}</span>
        <span className="mg-label">AI Life Coach</span>
      </div>
      <h3 className="mg-title">{prompt.title}</h3>
      <p className="mg-text">{prompt.text}</p>
      <button className="mg-action-btn">Write this moment</button>
    </motion.div>
  );
}
