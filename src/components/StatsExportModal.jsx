import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './StatsExportModal.css';

const THEMES = [
  { id: 'designed', name: 'Designed', desc: 'Premium dark mode with glows', icon: '✨' },
  { id: 'simple', name: 'Simple', desc: 'Clean, printer-friendly light mode', icon: '📄' },
  { id: 'classic', name: 'Classic', desc: 'Balanced grayscale aesthetic', icon: '🏛️' }
];

export default function StatsExportModal({ stats, events, onClose }) {
  const [theme, setTheme] = useState('designed');
  const [title, setTitle] = useState('My Life in Memories');
  const [subtitle, setSubtitle] = useState(`A statistical journey through ${events.length} moments`);
  const [sections, setSections] = useState({
    overview: true,
    heatmap: true,
    moods: true,
    people: true,
    tags: true,
    insights: true
  });
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: theme === 'simple' ? '#ffffff' : '#0c0a08'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Memoria_Stats_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("PDF Export failed", err);
      alert("Failed to export PDF. Please try again.");
    }
    setIsExporting(false);
  };

  const toggleSection = (id) => {
    setSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="sem-overlay">
      <motion.div 
        className="sem-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      
      <motion.div 
        className="sem-card"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
      >
        <div className="sem-header">
          <div className="sem-header-left">
            <h2>Export Memory Report</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>Professional PDF generation for your journaling journey</p>
          </div>
          <button className="sem-close" onClick={onClose}>✕</button>
        </div>

        <div className="sem-body">
          {/* Left: Configuration */}
          <div className="sem-config">
            <div className="sem-config-section">
              <label className="sem-label">1. Visual Theme</label>
              <div className="sem-themes">
                {THEMES.map(t => (
                  <div 
                    key={t.id} 
                    className={`sem-theme-item ${theme === t.id ? 'active' : ''}`}
                    onClick={() => setTheme(t.id)}
                  >
                    <span className="sem-theme-icon">{t.icon}</span>
                    <div className="sem-theme-info">
                      <strong>{t.name}</strong>
                      <span>{t.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sem-config-section">
              <label className="sem-label">2. Report Branding</label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Report Title"
                className="sem-input"
              />
              <textarea 
                value={subtitle} 
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Report Subtitle"
                className="sem-textarea"
              />
            </div>

            <div className="sem-config-section">
              <label className="sem-label">3. Content Modules</label>
              <div className="sem-toggles">
                {Object.keys(sections).map(s => (
                  <label key={s} className="sem-toggle">
                    <input 
                      type="checkbox" 
                      checked={sections[s]} 
                      onChange={() => toggleSection(s)} 
                    />
                    <span className="capitalize">{s}</span>
                  </label>
                ))}
              </div>
            </div>

            <button 
              className={`sem-export-btn ${isExporting ? 'loading' : ''}`}
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? 'Generating PDF...' : 'Download PDF Report'}
            </button>
          </div>

          {/* Right: Preview */}
          <div className="sem-preview">
            <label className="sem-label">Document Preview</label>
            <div className="sem-preview-container">
              <div 
                ref={printRef} 
                className={`sem-print-area theme-${theme}`}
              >
                <div className="spa-header">
                  <div className="spa-logo">Memoria ◎ Digital Legacy</div>
                  <h1>{title || 'My Life in Memories'}</h1>
                  <p>{subtitle}</p>
                </div>

                {sections.overview && (
                  <div className="spa-section">
                    <h3>Summary Overview</h3>
                    <div className="spa-overview-grid">
                      <div className="spa-stat"><strong>{events.length}</strong><span>Memories</span></div>
                      <div className="spa-stat"><strong>{stats.totalPhotos}</strong><span>Photos</span></div>
                      <div className="spa-stat"><strong>{stats.uniqueLocs}</strong><span>Places</span></div>
                      <div className="spa-stat"><strong>{stats.currentStreak}</strong><span>Day Streak</span></div>
                    </div>
                  </div>
                )}

                {sections.heatmap && (
                  <div className="spa-section">
                    <h3>Activity Patterns (Heatmap)</h3>
                    <div className="spa-heatmap">
                      {stats.heatmap.map((c, i) => (
                        <div key={i} className="spa-hm-cell">
                          <div className="spa-hm-box" style={{ 
                            background: theme === 'simple' ? '#000' : 'var(--accent-gold, #c4813a)',
                            opacity: c.count > 0 ? 0.2 + (c.count / stats.hmMax) * 0.8 : 0.05
                          }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                  {sections.moods && (
                    <div className="spa-section">
                      <h3>Emotional Landscape</h3>
                      <div className="spa-mood-list">
                        {Object.entries(stats.moodCounts).filter(([,v]) => v > 0).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([m, c]) => (
                          <div key={m} className="spa-mood-row">
                            <span className="capitalize">{m}</span>
                            <div className="spa-bar-wrap">
                              <div className="spa-bar" style={{ width: `${(c/events.length)*100}%` }} />
                            </div>
                            <span style={{ textAlign: 'right' }}>{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sections.people && (
                    <div className="spa-section">
                      <h3>Top Connections</h3>
                      <div className="spa-pill-cloud">
                        {stats.topPeople.slice(0, 10).map(([name, count]) => (
                          <span key={name} className="spa-pill">{name} ×{count}</span>
                        ))}
                        {stats.topPeople.length === 0 && <p style={{ fontSize: '11px', opacity: 0.5 }}>No tagged people found</p>}
                      </div>
                    </div>
                  )}
                </div>

                {sections.insights && (
                  <div className="spa-section">
                    <h3>Narrative Insights</h3>
                    <ul className="spa-insights">
                      <li>
                        <strong>Consistency</strong>
                        <p>Average gap between memories is {stats.avgGap} days.</p>
                      </li>
                      <li>
                        <strong>Peak Activity</strong>
                        <p>Most active month: {stats.bestMonth ? stats.bestMonth[0] : 'None'}.</p>
                      </li>
                      <li>
                        <strong>Exploration</strong>
                        <p>Total location changes recorded: {stats.uniqueLocationChanges}.</p>
                      </li>
                      <li>
                        <strong>Journaling Depth</strong>
                        <p>Average of {stats.avgWords} words per memory.</p>
                      </li>
                    </ul>
                  </div>
                )}

                <div className="spa-footer">
                  This report was automatically generated by Memoria · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
