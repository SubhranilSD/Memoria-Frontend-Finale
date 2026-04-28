import React from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

const SOCIALS = [
  { 
    name: 'GitHub', 
    url: 'https://github.com/SubhranilSD', 
    color: '#ffffff', 
    iconPath: 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z'
  },
  { 
    name: 'YouTube', 
    url: 'https://youtube.com/@sdenvelope?si=QoMJbLTXR2YxyhyJ', 
    color: '#FF0000',
    iconPath: 'M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z'
  },
  { 
    name: 'Instagram', 
    url: 'https://www.instagram.com/subhranil_sd?utm_source=qr&igsh=NnpzemVpNmxmMGtz', 
    color: '#E4405F',
    iconPath: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z'
  }
];

export default function AboutMaker() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-100, 100], [12, -12]);
  const rotateY = useTransform(x, [-100, 100], [-12, 12]);
  const shineX = useTransform(x, [-100, 100], [0, 100]);
  const shineY = useTransform(y, [-100, 100], [0, 100]);

  function handleMouse(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set(event.clientX - centerX);
    y.set(event.clientY - centerY);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <div className="about-maker-container">
      <style>{`
        .about-maker-container {
          padding: 80px 40px;
          maxWidth: 900px;
          margin: 0 auto;
          color: var(--text-primary);
          font-family: "DM Sans", sans-serif;
          perspective: 1000px;
        }
        .about-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 32px;
          padding: 80px 40px;
          box-shadow: 0 30px 60px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .about-photo-wrap {
          width: 240px;
          height: 240px;
        }
        .about-name {
          font-size: 52px;
        }
        .about-socials {
          gap: 24px;
        }
        .social-btn {
          width: 64px;
          height: 64px;
        }

        @media (max-width: 768px) {
          .about-maker-container { padding: 40px 16px; }
          .about-card { padding: 40px 20px; border-radius: 24px; }
          .about-photo-wrap { width: 160px; height: 160px; }
          .about-name { font-size: 32px; }
          .about-socials { gap: 12px; }
          .social-btn { width: 50px; height: 50px; border-radius: 14px; }
          .social-btn svg { width: 24px; height: 24px; }
          .about-text { font-size: 15px !important; }
        }
      `}</style>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="about-card"
      >
        {/* Animated Background Orbs */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, var(--accent-indigo) 0%, transparent 70%)',
          opacity: 0.1,
          zIndex: 0,
          filter: 'blur(40px)'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-10%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, var(--accent-rose) 0%, transparent 70%)',
          opacity: 0.1,
          zIndex: 0,
          filter: 'blur(40px)'
        }} />

        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginBottom: '40px',
            perspective: '1000px'
          }}
        >
          <motion.div
            onMouseMove={handleMouse}
            onMouseLeave={handleMouseLeave}
            className="about-photo-wrap"
            style={{
              borderRadius: '50%',
              overflow: 'hidden',
              border: '4px solid rgba(255,255,255,0.15)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              rotateX,
              rotateY,
              transformStyle: 'preserve-3d',
              cursor: 'pointer',
              position: 'relative'
            }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {/* Gloss Shine Overlay */}
            <motion.div 
              style={{
                position: 'absolute',
                inset: '-50%',
                width: '200%',
                height: '200%',
                background: 'linear-gradient(135deg, transparent 35%, rgba(255,255,255,0.4) 48%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.4) 52%, transparent 65%)',
                zIndex: 2,
                pointerEvents: 'none',
                opacity: 0,
                rotate: '45deg',
                x: useTransform(shineX, [0, 100], [-100, 100]),
                y: useTransform(shineY, [0, 100], [-100, 100]),
              }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />

            <img 
              src="/maker-photo-new.jpg" 
              alt="Subhranil" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'translateZ(20px) scale(1.1)',
                zIndex: 1
              }} 
            />
          </motion.div>
        </div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="about-name"
          style={{ 
            fontFamily: '"Playfair Display", serif', 
            margin: '0 0 12px',
            background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.6) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em'
          }}
        >
          Subhranil Dutta
        </motion.h1>
        
        <motion.h2 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{ 
            fontFamily: '"DM Mono", monospace', 
            fontSize: '13px', 
            color: 'var(--accent-indigo)',
            textTransform: 'uppercase',
            letterSpacing: '0.3em',
            margin: '0 0 40px',
            opacity: 0.8
          }}
        >
          Developer & Creator
        </motion.h2>

        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="about-text"
          style={{
            fontSize: '19px',
            lineHeight: '1.7',
            color: 'var(--text-secondary)',
            maxWidth: '640px',
            margin: '0 auto 48px',
            fontWeight: 400
          }}
        >
          Hey there! I'm Subhranil. I built Memoria because I wanted a simple, beautiful place to keep 
          all my favorite moments. No clutter, no noise—just your stories, kept safe and easy to revisit. 
          I hope you enjoy using it as much as I enjoyed building it for you! ✨
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="about-socials"
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '60px'
          }}
        >
          {SOCIALS.map((social, i) => (
            <motion.a
              key={social.name}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.15, y: -8, boxShadow: `0 15px 30px ${social.color}44` }}
              whileTap={{ scale: 0.95 }}
              className="social-btn"
              style={{
                borderRadius: '20px',
                background: `linear-gradient(135deg, ${social.color}22, ${social.color}11)`,
                border: `1px solid ${social.color}33`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: social.color,
                transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                textDecoration: 'none',
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                const isLight = social.color.toLowerCase() === '#ffffff' || social.color.toLowerCase() === '#fff';
                e.currentTarget.style.background = `linear-gradient(135deg, ${social.color}, ${social.color}dd)`;
                e.currentTarget.style.color = isLight ? '#000' : 'white';
                e.currentTarget.style.borderColor = social.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `linear-gradient(135deg, ${social.color}22, ${social.color}11)`;
                e.currentTarget.style.color = social.color;
                e.currentTarget.style.borderColor = `${social.color}33`;
              }}
            >
              <svg 
                width="32" 
                height="32" 
                viewBox={social.name === 'GitHub' ? "0 0 16 16" : "0 0 24 24"} 
                fill="currentColor"
              >
                <path d={social.iconPath} />
              </svg>
            </motion.a>
          ))}
        </motion.div>

        {/* Logo at the bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.9 }}
          style={{ marginTop: '20px' }}
        >
          <img 
            src="/maker-logo.png" 
            alt="SD Logo" 
            style={{
              width: '80px',
              height: '80px',
              objectFit: 'contain',
              filter: 'grayscale(1) brightness(2)',
              opacity: 0.4
            }} 
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
