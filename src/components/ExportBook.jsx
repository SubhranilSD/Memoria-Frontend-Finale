import { useMemo, useState, useEffect } from 'react';
import { inferWeather, isFutureLetter } from '../utils/memoryUtils';
import './ExportBook.css';

const MOOD_EMOJIS = {
  joyful:'😄', nostalgic:'🌙', proud:'🏆', sad:'💧',
  excited:'⚡', peaceful:'🕊', grateful:'🌸', adventurous:'🗺',
};

export default function ExportBook({ events, year: initialYear, onClose }) {
  const [step, setStep] = useState('config'); // 'config' | 'preview'
  
  // Available years from events
  const availableYears = useMemo(() => {
    const years = new Set(events.map(e => new Date(e.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [events]);

  const [config, setConfig] = useState({
    title: 'A Year in Memories',
    subtitle: 'My Personal Journey',
    year: initialYear || (availableYears[0] || new Date().getFullYear()),
    format: 'detailed', // 'detailed' | 'compact'
    showTags: true,
    showPeople: true,
    showWeather: true,
    includePrivate: false,
    includeFuture: false,
  });

  const filteredEvents = useMemo(() => {
    return events
      .filter(e => {
        if (config.year !== 'all' && new Date(e.date).getFullYear() !== config.year) return false;
        if (!config.includePrivate && e.isPrivate) return false;
        if (!config.includeFuture && isFutureLetter(e)) return false;
        return true;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [events, config]);

  const stats = useMemo(() => {
    const s = { photos: 0, words: 0, locations: {}, moods: {} };
    filteredEvents.forEach(e => {
      s.photos += e.media?.length || 0;
      s.words += e.description?.trim().split(/\s+/).length || 0;
      if (e.location) s.locations[e.location] = (s.locations[e.location] || 0) + 1;
      if (e.mood) s.moods[e.mood] = (s.moods[e.mood] || 0) + 1;
    });

    const topLocation = Object.entries(s.locations).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
    const topMood = Object.entries(s.moods).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

    return { ...s, topLocation, topMood };
  }, [filteredEvents]);

  // Handle print trigger when preview is ready
  useEffect(() => {
    if (step === 'preview') {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  if (step === 'config') {
    return (
      <div className="eb-wrapper eb-config-wrapper">
        <div className="eb-config-modal">
          <button className="eb-config-close" onClick={onClose}>✕</button>
          <h2>Export Settings</h2>
          <p>Customize your printable Memory Book layout.</p>

          <div className="eb-config-form">
            <div className="form-group">
              <label className="input-label">Year to Export</label>
              <select 
                className="input" 
                value={config.year} 
                onChange={e => setConfig({ ...config, year: e.target.value === 'all' ? 'all' : parseInt(e.target.value) })}
              >
                <option value="all">All Time</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="input-label">Layout Format</label>
              <select 
                className="input" 
                value={config.format} 
                onChange={e => setConfig({ ...config, format: e.target.value })}
              >
                <option value="detailed">Detailed (One per page)</option>
                <option value="compact">Compact (Saves paper, lists only)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="input-label">Book Title</label>
              <input 
                className="input" 
                value={config.title} 
                onChange={e => setConfig({ ...config, title: e.target.value })} 
              />
            </div>

            <div className="form-group">
              <label className="input-label">Subtitle</label>
              <input 
                className="input" 
                value={config.subtitle} 
                onChange={e => setConfig({ ...config, subtitle: e.target.value })} 
              />
            </div>

            <div className="eb-config-toggles">
              <label className="toggle-label">
                <input type="checkbox" checked={config.showTags} onChange={e => setConfig({ ...config, showTags: e.target.checked })} />
                <span>Show Tags</span>
              </label>
              <label className="toggle-label">
                <input type="checkbox" checked={config.showPeople} onChange={e => setConfig({ ...config, showPeople: e.target.checked })} />
                <span>Show People</span>
              </label>
              <label className="toggle-label">
                <input type="checkbox" checked={config.showWeather} onChange={e => setConfig({ ...config, showWeather: e.target.checked })} />
                <span>Show Weather</span>
              </label>
              <label className="toggle-label">
                <input type="checkbox" checked={config.includePrivate} onChange={e => setConfig({ ...config, includePrivate: e.target.checked })} />
                <span>Include Private Memories (Vault)</span>
              </label>
              <label className="toggle-label">
                <input type="checkbox" checked={config.includeFuture} onChange={e => setConfig({ ...config, includeFuture: e.target.checked })} />
                <span>Include Future Letters</span>
              </label>
            </div>

            <div className="eb-config-preview-stats">
              Memories found: <strong>{filteredEvents.length}</strong>
            </div>

            <div className="modal-footer" style={{ marginTop: '32px' }}>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={() => setStep('preview')} disabled={filteredEvents.length === 0}>
                Generate Print Layout
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Preview / Print Layout
  return (
    <div className="eb-wrapper">
      <div className="eb-controls no-print">
        <p>Printing layout generated. Press Cmd/Ctrl+P if the dialog doesn't appear.</p>
        <div className="eb-controls-actions">
          <button className="btn btn-primary" onClick={() => window.print()}>Print / Save PDF</button>
          <button className="btn btn-ghost" onClick={() => setStep('config')}>Back to Settings</button>
        </div>
      </div>

      <div className="eb-book">
        {/* Cover Page */}
        <div className="eb-page eb-cover">
          <div className="eb-cover-content">
            <h1>{config.year === 'all' ? 'Memoria' : config.year}</h1>
            <h2>{config.title}</h2>
            <p className="eb-cover-subtitle">{config.subtitle}</p>
            <div className="eb-cover-stats">
              <span>{filteredEvents.length} Memories</span>
              <span>{stats.photos} Photos</span>
              <span>{Object.keys(stats.locations).length} Places</span>
            </div>
            <div className="eb-cover-stats-extra">
              {stats.topMood !== 'Unknown' && <span>Top Vibe: {stats.topMood}</span>}
              {stats.topLocation !== 'Unknown' && <span>Most Visited: {stats.topLocation}</span>}
            </div>
          </div>
        </div>

        {/* Content Pages */}
        <div className={`eb-content-container format-${config.format}`}>
          {filteredEvents.map((ev, index) => {
            const hasPhotos = ev.media?.length > 0;
            const weather = config.showWeather ? inferWeather(ev.date, ev.location) : null;
            const isFuture = isFutureLetter(ev);

            return (
              <div key={ev._id} className="eb-page eb-memory">
              <div className="eb-memory-header">
                <div className="eb-memory-meta">
                  <span className="eb-memory-date">
                    {new Date(ev.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {ev.location && <span className="eb-memory-loc">📍 {ev.location}</span>}
                    {weather && <span className="eb-memory-loc">{weather.icon} {weather.label}</span>}
                  </div>
                </div>
                <div className="eb-memory-emoji">{MOOD_EMOJIS[ev.mood] || '✦'}</div>
              </div>

              <h3 className="eb-memory-title">
                {ev.title} {isFuture && '🔒'} {ev.audioUrl && '🎙️'}
              </h3>

              {isFuture ? (
                 <div className="eb-memory-desc" style={{ fontStyle: 'italic', color: '#9ca3af' }}>
                   This memory is a Future Letter and is locked until {new Date(ev.unlockDate).toLocaleDateString()}.
                 </div>
              ) : (
                <>
                  {hasPhotos && (
                    <div className="eb-memory-gallery">
                      {ev.media.slice(0, 4).map((m, i) => (
                        <img key={i} src={m.url} alt="" className="eb-memory-img" />
                      ))}
                    </div>
                  )}

                  {ev.description && (
                    <div className="eb-memory-desc">
                      <p>{ev.description}</p>
                    </div>
                  )}
                </>
              )}

              <div className="eb-memory-footer">
                {config.showPeople && ev.people?.length > 0 && (
                  <div className="eb-memory-people">
                    <strong>With:</strong> {ev.people.join(', ')}
                  </div>
                )}
                {config.showTags && ev.tags?.length > 0 && (
                  <div className="eb-memory-tags">
                    {ev.tags.map(t => `#${t}`).join(' ')}
                  </div>
                )}
              </div>

              <div className="eb-page-number">{index + 1}</div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
