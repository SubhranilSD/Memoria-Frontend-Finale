import React, { useRef, useState, useEffect, useMemo } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import EventCard from './EventCard';
import './FlowView.css';

export default function FlowView({ events, onEdit, onDelete, onClickMedia, onSelectEvent }) {
  const containerRef = useRef(null);
  const { scrollXProgress } = useScroll({ container: containerRef });
  const smoothProgress = useSpring(scrollXProgress, { stiffness: 100, damping: 30 });

  // Generate a smooth curved path based on event count
  const pathPoints = useMemo(() => {
    const points = [];
    for (let i = 0; i <= events.length * 10; i++) {
      const x = i * 100;
      const y = Math.sin(i * 0.3) * 150 + 400; // Flowing wave
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  }, [events.length]);

  return (
    <div className="flow-container" ref={containerRef}>
      {/* Dynamic Background */}
      <div className="flow-background">
        <div className="flow-nebula" />
        <div className="flow-particles" />
      </div>

      <div className="flow-track">
        {/* The Glowing Flow Path */}
        <svg className="flow-svg" width={events.length * 1000} height="800">
          <defs>
            <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff0080" />
              <stop offset="25%" stopColor="#7928ca" />
              <stop offset="50%" stopColor="#ff0080" />
              <stop offset="75%" stopColor="#0070f3" />
              <stop offset="100%" stopColor="#00dfd8" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="10" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <motion.polyline
            points={pathPoints}
            fill="none"
            stroke="url(#flow-gradient)"
            strokeWidth="4"
            strokeLinecap="round"
            filter="url(#glow)"
            style={{ pathLength: 1, opacity: 0.6 }}
          />
          {/* Animated "Energy Strands" */}
          <motion.polyline
            points={pathPoints}
            fill="none"
            stroke="white"
            strokeWidth="1"
            style={{ pathLength: 0.2, opacity: 0.3 }}
            animate={{ strokeDashoffset: [0, -1000] }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          />
        </svg>

        {/* The Memories */}
        {events.map((event, index) => {
          const x = index * 800 + 400;
          const y = Math.sin(index * 8 * 0.3) * 150 + 400; // Align with wave
          
          return (
            <FlowItem 
              key={event._id} 
              event={event} 
              index={index} 
              x={x}
              y={y}
              onEdit={onEdit} 
              onDelete={onDelete} 
              onClickMedia={onClickMedia}
              onSelect={() => onSelectEvent(event)}
            />
          );
        })}
      </div>

      {/* Cinematic HUD */}
      <div className="flow-hud">
        <div className="hud-label">Cosmic Chronology</div>
        <div className="hud-progress">
          <motion.div className="hud-bar" style={{ scaleX: smoothProgress }} />
        </div>
      </div>
    </div>
  );
}

function FlowItem({ event, index, x, y, onEdit, onDelete, onClickMedia, onSelect }) {
  return (
    <motion.div 
      className="flow-item"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.2, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      viewport={{ margin: "0px 200px" }}
    >
      <div className="flow-card-wrapper" onClick={onSelect}>
        <div className="flow-card-glow" style={{ color: event.color || '#7928ca' }} />
        <EventCard 
          event={event} 
          view="timeline" 
          onEdit={onEdit} 
          onDelete={onDelete} 
          onClickMedia={onClickMedia}
        />
        <div className="flow-click-hint">Click to expand details</div>
      </div>
      
      <div className="flow-connector-node">
        <div className="node-outer" style={{ borderColor: event.color }} />
        <div className="node-inner" style={{ background: event.color }} />
        <div className="node-label">{new Date(event.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</div>
      </div>
    </motion.div>
  );
}
