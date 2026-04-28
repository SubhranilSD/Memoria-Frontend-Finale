import { useState, useMemo } from 'react';
import { calculateStreak } from '../utils/memoryUtils';
import { getMoods, MOOD_COLORS } from '../utils/moodProvider';
import FaceMergeAssistant from './FaceMergeAssistant';
import './Sidebar.css';

export default function Sidebar({
  user, view, setView, filters, setFilters,
  allTags, allPeople = [],
  editMode, setEditMode, onLogout, theme, toggleTheme,
  onStoryMode, onOnThisDay, onExport, onVault, eventCount, events = [],
}) {
  const [activeTab, setActiveTab] = useState('navigate');
  const moods = useMemo(() => getMoods(), []);

  const clearFilters = () => setFilters({ mood: '', tag: '', person: '', sort: 'date', order: 'desc' });
  const hasFilters = filters.mood || filters.tag || filters.person;

  const currentStreak = useMemo(() => calculateStreak(events), [events]);

  /* quick counts for filter badges */
  const moodCounts = {};
  moods.forEach(m => { moodCounts[m.value] = 0; });
  events.forEach(e => { if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1; });

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand" style={{ flexDirection: 'column', alignItems: 'flex-start', paddingBottom: '0' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="logo-star">✦</span>
          <span className="sidebar-logo-text">Memoria</span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '32px', fontFamily: 'DM Mono, monospace' }}>-by SD</span>
      </div>

      {/* User card */}
      <div className="sidebar-user">
        <div className="sidebar-avatar">
          {user?.avatar
            ? <img src={user.avatar} alt={user.name} />
            : <span>{user?.name?.[0]?.toUpperCase()}</span>}
        </div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.name}</div>
          <div className="sidebar-user-count">{eventCount} {eventCount === 1 ? 'memory' : 'memories'}</div>
        </div>
      </div>

      {/* Quick stats strip */}
      {events.length > 0 && (
        <div className="nav-quick-strip">
          {[
            { n: events.length, l: 'Memories' },
            { n: events.reduce((s, e) => s + (e.media?.length || 0), 0), l: 'Photos' },
            { n: new Set(events.map(e => e.location).filter(Boolean)).size, l: 'Places' },
            { n: `${currentStreak}🔥`, l: 'Streak' },
          ].map(({ n, l }) => (
            <div key={l} className="nav-qs-cell">
              <span className="nav-qs-num">{n}</span>
              <span className="nav-qs-lbl">{l}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tab rail — 2 tabs only (Stats moved to right panel) */}
      <div className="sidebar-tabs">
        <button className={`sidebar-tab-btn ${activeTab === 'navigate' ? 'active' : ''}`} onClick={() => setActiveTab('navigate')} title="Navigate">
          <span>◈</span><span className="sidebar-tab-label">Nav</span>
        </button>
        <button className={`sidebar-tab-btn ${activeTab === 'filter' ? 'active' : ''}`} onClick={() => setActiveTab('filter')} title="Filter">
          <span>⧉</span><span className="sidebar-tab-label">Filter{hasFilters ? ' •' : ''}</span>
        </button>
      </div>

      <div className="sidebar-panel-wrap">

        {/* ── NAVIGATE ── */}
        {activeTab === 'navigate' && (
          <nav className="sidebar-panel sidebar-nav animate-fadeIn">
            <div className="sidebar-section-label">View</div>
            {[
              { id: 'timeline', icon: '◈', label: 'Timeline' },
              { id: 'horizon', icon: '〰', label: 'Horizon' },
              { id: 'grid', icon: '⬡', label: 'Grid' },
              { id: 'node', icon: '◉', label: 'Node Canvas' },
              { id: 'constellation', icon: '✧', label: 'Constellation' },
              { id: 'globe', icon: '🌍', label: '3D Globe' },
              { id: 'people', icon: '👥', label: 'Persons' },
              { id: 'about', icon: '✨', label: 'About the Maker' },

            ].map(v => (
              <button key={v.id} className={`sidebar-btn ${view === v.id ? 'active' : ''}`} onClick={() => setView(v.id)}>
                <span className="sidebar-btn-icon">{v.icon}</span>{v.label}
              </button>
            ))}

            <div className="sidebar-section-label">Actions</div>
            <button className={`sidebar-btn ${editMode ? 'active accent' : ''}`} onClick={() => setEditMode(m => !m)}>
              <span className="sidebar-btn-icon">⟐</span>{editMode ? 'Exit Edit Mode' : 'Edit Mode'}
            </button>
            <button className="sidebar-btn" onClick={onStoryMode}>
              <span className="sidebar-btn-icon">▷</span>Story Mode
            </button>
            <button className="sidebar-btn" onClick={onOnThisDay}>
              <span className="sidebar-btn-icon">📅</span>On This Day
            </button>
            <button className="sidebar-btn" onClick={onExport}>
              <span className="sidebar-btn-icon">🖨️</span>Export Year Book
            </button>
            <button className="sidebar-btn" onClick={onVault}>
              <span className="sidebar-btn-icon">🔒</span>Access Vault
            </button>

            {hasFilters && (
              <div className="sidebar-filter-notice">
                <span>Active filters</span>
                <button className="filter-clear-btn" onClick={clearFilters}>Clear ✕</button>
              </div>
            )}
          </nav>
        )}

        {/* ── FILTER ── */}
        {activeTab === 'filter' && (
          <div className="sidebar-panel animate-fadeIn">

            <div className="sidebar-section-label">Sort</div>
            <div className="sidebar-sort">
              <select className="input" value={filters.sort} onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}>
                <option value="date">By Date</option>
                <option value="sortIndex">Custom Order</option>
                <option value="createdAt">Recently Added</option>
              </select>
              <button className="btn btn-ghost btn-sm"
                onClick={() => setFilters(f => ({ ...f, order: f.order === 'asc' ? 'desc' : 'asc' }))}
                title="Toggle order">
                {filters.order === 'desc' ? '↓' : '↑'}
              </button>
            </div>

            <div className="sidebar-section-label">
              Mood
              {filters.mood && <button className="filter-clear-btn" onClick={() => setFilters(f => ({ ...f, mood: '' }))}>✕</button>}
            </div>
            <div className="mood-filter-grid">
              {moods.map(m => (
                <button
                  key={m.value}
                  className={`mood-filter-btn ${filters.mood === m.value ? 'active' : ''}`}
                  onClick={() => setFilters(f => ({ ...f, mood: f.mood === m.value ? '' : m.value }))}
                  title={`${m.label} (${moodCounts[m.value] || 0})`}
                >
                  {m.emoji}
                  {moodCounts[m.value] > 0 && (
                    <span className="mood-filter-count">{moodCounts[m.value]}</span>
                  )}
                </button>
              ))}
            </div>

            {allTags.length > 0 && (
              <>
                <div className="sidebar-section-label">
                  Tag
                  {filters.tag && <button className="filter-clear-btn" onClick={() => setFilters(f => ({ ...f, tag: '' }))}>✕</button>}
                </div>
                <div className="tag-filter-list">
                  {allTags.map(tag => (
                    <button key={tag} className={`tag ${filters.tag === tag ? 'tag-active' : ''}`}
                      onClick={() => setFilters(f => ({ ...f, tag: f.tag === tag ? '' : tag }))}>
                      #{tag}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* People filter */}
            {allPeople.length > 0 && (
              <>
                <div className="sidebar-section-label">
                  People
                  {filters.person && <button className="filter-clear-btn" onClick={() => setFilters(f => ({ ...f, person: '' }))}>✕</button>}
                </div>
                <div className="tag-filter-list">
                  {allPeople.map(name => (
                    <button key={name}
                      className={`tag ${filters.person === name ? 'tag-active' : ''}`}
                      onClick={() => setFilters(f => ({ ...f, person: f.person === name ? '' : name }))}>
                      👤 {name}
                    </button>
                  ))}
                </div>
              </>
            )}

            {hasFilters && (
              <button className="btn btn-ghost btn-sm sidebar-clear-btn" onClick={clearFilters}>
                Clear All Filters
              </button>
            )}

            <FaceMergeAssistant onMergeComplete={() => {
              // Refresh state if needed, but FaceMergeAssistant handles its own local storage
            }} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="sidebar-btn" onClick={toggleTheme}>
          <span className="sidebar-btn-icon">{theme === 'dark' ? '☀' : '☾'}</span>
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button className="sidebar-btn sidebar-logout" onClick={onLogout}>
          <span className="sidebar-btn-icon">⎋</span>Sign Out
        </button>
      </div>
    </aside>
  );
}
