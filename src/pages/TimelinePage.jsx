import { useState, useEffect, useCallback, useMemo, lazy, Suspense, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';
import Sidebar from '../components/Sidebar';
import TimelineView from '../components/TimelineView';

// Lazy load heavy views
const NodeCanvasView = lazy(() => import('../components/NodeCanvasView'));
const HorizonView = lazy(() => import('../components/HorizonView'));
const ConstellationView = lazy(() => import('../components/ConstellationView'));
const GlobeView = lazy(() => import('../components/GlobeView'));
const EventModal = lazy(() => import('../components/EventModal'));
const StoryMode = lazy(() => import('../components/StoryMode'));
const StatsPanel = lazy(() => import('../components/StatsPanel'));
const OnThisDay = lazy(() => import('../components/OnThisDay'));
const ExportBook = lazy(() => import('../components/ExportBook'));
const VaultOverlay = lazy(() => import('../components/VaultOverlay'));
const TopBar = lazy(() => import('../components/TopBar'));
const BulkImportModal = lazy(() => import('../components/BulkImportModal'));
const AboutMaker = lazy(() => import('../components/AboutMaker'));
const PeopleView = lazy(() => import('../components/PeopleView'));
const Lightbox = lazy(() => import('../components/Lightbox'));
const HorizStreamView = lazy(() => import('../components/HorizStreamView'));
const MemoryDetail = lazy(() => import('../components/MemoryDetail'));
const HighlightsReel = lazy(() => import('../components/HighlightsReel'));
const Toast = lazy(() => import('../components/Toast'));
const ProfileModal = lazy(() => import('../components/ProfileModal'));
const InstantCameraModal = lazy(() => import('../components/InstantCameraModal'));
import MobileBottomBar from '../components/MobileBottomBar';
import StarsBackground from '../components/StarsBackground';
import './TimelinePage.css';

const MOOD_COLORS = {
  joyful: '#ffae00', nostalgic: '#a78bfa', proud: '#10b981', sad: '#6b7280',
  excited: '#ff3d3d', peaceful: '#22d3ee', grateful: '#fb7185', adventurous: '#ff6200',
};

export default function TimelinePage() {
  const { user, logout, setUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('timeline');
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [lightboxEvent, setLightboxEvent] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [storyMode, setStoryMode] = useState(false);
  const [otdMode, setOtdMode] = useState(false);
  const [exportMode, setExportMode] = useState(false);
  const [vaultMode, setVaultMode] = useState(false);
  const [toast, setToast] = useState(null);
  const [filters, setFilters] = useState({ mood: '', tag: '', person: '', sort: 'date', order: 'desc' });
  const [editMode, setEditMode] = useState(false);
  const [showReel, setShowReel] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 900);
  const [showMobileStats, setShowMobileStats] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const PAGE_SIZE = 15;

  const [showInstantModal, setShowInstantModal] = useState(false);

  // Debounced search
  const [searchRaw, setSearchRaw] = useState('');
  const [search, setSearch] = useState('');
  const searchDebounceRef = useRef(null);
  const handleSearchChange = (val) => {
    setSearchRaw(val);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearch(val), 300);
  };

  const fetchEvents = useCallback(async (isReset = false) => {
    if (isReset) {
      setLoading(true);
      setSkip(0);
      setHasMore(true);
    } else {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    }

    try {
      const currentSkip = isReset ? 0 : skip;
      const params = new URLSearchParams();
      if (filters.mood) params.set('mood', filters.mood);
      if (filters.tag) params.set('tag', filters.tag);
      if (search) params.set('search', search);
      params.set('sort', filters.sort);
      params.set('order', filters.order);
      params.set('limit', PAGE_SIZE);
      params.set('skip', currentSkip);
      
      const res = await api.get(`/events?${params}`);
      const newEvents = res.data;
      
      if (isReset) {
        setEvents(newEvents);
      } else {
        setEvents(prev => [...prev, ...newEvents]);
      }
      
      setSkip(currentSkip + PAGE_SIZE);
      if (newEvents.length < PAGE_SIZE) setHasMore(false);
    } catch {
      showToast('Failed to load events', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters, skip, hasMore, loadingMore, search]);

  useEffect(() => { 
    fetchEvents(true); 
  }, [filters, search]);

  // Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleCreateEvent = async (data) => {
    try {
      const res = await api.post('/events', data);
      setEvents(prev => [res.data, ...prev]);
      showToast('Memory added ✦');
      // Removed setShowModal(false) to allow the modal to show its success state
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create', 'error');
    }
  };

  const handleUpdateEvent = async (id, data) => {
    try {
      const res = await api.put(`/events/${id}`, data);
      setEvents(prev => prev.map(e => e._id === id ? res.data : e));

      // Update the active detail view if it's the same event
      if (selectedEvent && selectedEvent._id === id) {
        setSelectedEvent(res.data);
      }

      showToast('Memory updated');
      setEditingEvent(null);
    } catch {
      showToast('Failed to update', 'error');
    }
  };

  const handleUpdateTitle = async (id, newTitle) => {
    try {
      const res = await api.put(`/events/${id}`, { title: newTitle });
      setEvents(prev => prev.map(e => e._id === id ? res.data : e));
      if (lightboxEvent && lightboxEvent._id === id) {
        setLightboxEvent(res.data);
      }
      showToast('Title updated ✦');
    } catch {
      showToast('Failed to update title', 'error');
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm('Delete this memory forever?')) return;
    try {
      await api.delete(`/events/${id}`);
      setEvents(prev => prev.filter(e => e._id !== id));
      showToast('Memory removed');
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  const handleReorder = async (newOrder) => {
    setEvents(newOrder);
    try {
      await api.put('/events/reorder/bulk', { orderedIds: newOrder.map(e => e._id) });
    } catch {
      showToast('Failed to save order', 'error');
    }
  };

  const openEdit = (event) => { setEditingEvent(event); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingEvent(null); };

  /* Derived lists */
  const allTags = useMemo(() => [...new Set(events.flatMap(e => e.tags || []))], [events]);
  const allPeople = useMemo(() => [...new Set(events.flatMap(e => e.people || []))], [events]);

  const visibleEvents = events;
  const memCount = visibleEvents.length;

  // Derived list based on pagination (now server-side)
  const paginatedEvents = visibleEvents;

  // Observer callback for infinite scroll
  const observerRef = useRef(null);
  const loadMoreCallback = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (node) {
      observerRef.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchEvents(false);
        }
      }, { rootMargin: '800px' });
      observerRef.current.observe(node);
    }
  }, [hasMore, loadingMore, fetchEvents]);

  return (
    <div className={`timeline-page ${theme}`}>
      <Sidebar 
        user={user}
        view={view} setView={setView}
        filters={filters} setFilters={setFilters}
        allTags={allTags} allPeople={allPeople}
        editMode={editMode} setEditMode={setEditMode}
        onLogout={logout}
        theme={theme} toggleTheme={toggleTheme}
        onStoryMode={() => setStoryMode(true)}
        onOnThisDay={() => setOtdMode(true)}
        onExport={() => setExportMode(true)}
        onVault={() => setVaultMode(true)}
        eventCount={events.length}
        events={events}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onEditProfile={() => setShowProfileModal(true)}
      />

      {sidebarOpen && (
        <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Suspense fallback={<div className="timeline-loading">Loading component...</div>}>
        <main className="timeline-main">
          {/* Header */}
          <div className="timeline-header">
            {!sidebarOpen && (
              <button
                className="mobile-menu-toggle btn btn-ghost"
                onClick={() => setSidebarOpen(true)}
              >
                ☰
              </button>
            )}
            
            <div className="timeline-header-center">
              <h1 className="timeline-heading">
                {user?.name?.split(' ')[0]}'s Timeline
              </h1>
              <p className="timeline-subheading">
                {memCount === 0 ? 'Your story begins here.' : `${memCount} memor${memCount === 1 ? 'y' : 'ies'} captured`}
              </p>
            </div>

            <div className="timeline-header-actions centered">
              <div className="search-bar">
                <span className="search-icon">⌕</span>
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search memories (Cmd+K)…"
                  value={searchRaw}
                  onChange={e => handleSearchChange(e.target.value)}
                />
                {searchRaw && (
                  <button className="search-clear" onClick={() => { setSearchRaw(''); setSearch(''); }}>✕</button>
                )}
              </div>
              <div className="header-action-btns">
                <button className="btn btn-ghost" onClick={() => setShowReel(true)} title="Watch your highlight reel">
                  🎬 Highlights
                </button>
                <button className="btn btn-ghost" onClick={() => setShowInstantModal(true)} title="Snap an instant photo memory">
                  📷 Instant
                </button>
                <button className="btn btn-ghost" onClick={() => setShowBulkModal(true)} title="Bulk upload photos">
                  📸 Bulk Add
                </button>
                <button className="btn btn-primary" onClick={() => { setEditingEvent(null); setShowModal(true); }}>
                  + Add Memory
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="timeline-loading">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton-card skeleton"
                  style={{ height: '180px', borderRadius: '16px', marginBottom: '24px', animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          ) : (
            <>
              {view === 'node' ? (
                <NodeCanvasView events={visibleEvents} editMode={editMode} onEdit={openEdit} />
              ) : view === 'horizon' ? (
                <>
                  <HorizonView events={paginatedEvents} editMode={editMode} onEdit={openEdit} />
                  {visibleCount < visibleEvents.length && (
                    <div ref={loadMoreCallback} style={{ position: 'absolute', right: '10vw', width: '1px', height: '100%' }} />
                  )}
                </>
              ) : view === 'constellation' ? (
                <ConstellationView events={visibleEvents} />
              ) : view === 'globe' ? (
                <GlobeView
                  events={visibleEvents}
                  onFilterLocation={(loc) => { setSearch(loc); setView('timeline'); }}
                />
              ) : view === 'people' ? (
                <PeopleView
                  events={visibleEvents}
                  onEdit={openEdit}
                  onDelete={handleDeleteEvent}
                />
              ) : view === 'about' ? (
                <AboutMaker />
              ) : (
                memCount === 0 ? (
                  <div className="timeline-empty">
                    <div className="empty-icon animate-float">✦</div>
                    <h3>{search || filters.mood || filters.tag || filters.person ? 'No matches found' : 'No memories yet'}</h3>
                    <p>{search ? `Nothing matched "${search}". Try a different search.` : 'Start by adding your first memory.'}</p>
                    {!search && (
                      <button className="btn btn-primary btn-lg" onClick={() => setShowModal(true)}>
                        Add Your First Memory
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <TimelineView
                      events={paginatedEvents}
                      view={view}
                      editMode={editMode}
                      onEdit={openEdit}
                      onDelete={handleDeleteEvent}
                      onReorder={handleReorder}
                      onClickMedia={setLightboxEvent}
                      onSelectEvent={setSelectedEvent}
                    />
                    {hasMore && (
                      <div ref={loadMoreCallback} style={{ 
                        height: '100px', 
                        width: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'var(--accent-gold)',
                        opacity: 0.6,
                        fontSize: '12px',
                        letterSpacing: '0.2em'
                      }}>
                        {loadingMore ? 'SYNCING MEMORIES...' : '✦'}
                      </div>
                    )}
                  </>
                )
              )}
            </>
          )}
        </main>

        {/* Right-side Stats Panel (Or mobile full-screen modal) */}
        <StatsPanel 
          events={events} 
          externalOpen={window.innerWidth <= 900 ? showMobileStats : undefined}
          onCloseExternal={() => setShowMobileStats(false)}
        />

        {showModal && (
          <EventModal
            event={editingEvent}
            allPeople={allPeople}
            onSubmit={editingEvent
              ? (data) => handleUpdateEvent(editingEvent._id, data)
              : handleCreateEvent}
            onClose={closeModal}
          />
        )}

        {showBulkModal && (
          <BulkImportModal
            onClose={() => setShowBulkModal(false)}
            onComplete={() => {
              setShowBulkModal(false);
              fetchEvents(true);
              showToast('Bulk import complete ✦');
            }}
          />
        )}

        {lightboxEvent && (
          <Lightbox
            event={lightboxEvent}
            onClose={() => setLightboxEvent(null)}
            onUpdateTitle={handleUpdateTitle}
            onEdit={(ev) => {
              setLightboxEvent(null);
              openEdit(ev);
            }}
          />
        )}

        <AnimatePresence>
          {selectedEvent && (
            <MemoryDetail
              event={selectedEvent}
              allEvents={events}
              onClose={() => setSelectedEvent(null)}
              onEdit={openEdit}
              onUpdateEvent={handleUpdateEvent}
            />
          )}
        </AnimatePresence>

        {storyMode && <StoryMode events={events} onClose={() => setStoryMode(false)} />}
        {showReel && <HighlightsReel events={events} onClose={() => setShowReel(false)} />}
        {otdMode && <OnThisDay events={events} onClose={() => setOtdMode(false)} />}
        {exportMode && <ExportBook events={events} year={new Date().getFullYear()} onClose={() => setExportMode(false)} />}
        {vaultMode && (
          <VaultOverlay
            user={user}
            onClose={() => setVaultMode(false)}
            onUnlocked={() => {
              setVaultMode(false);
              setToast({ message: 'Vault Unlocked!', type: 'success' });
              fetchEvents();
            }}
          />
        )}
        {showProfileModal && (
          <ProfileModal
            user={user}
            onClose={() => setShowProfileModal(false)}
            onUpdate={(updated) => {
              setUser(updated);
              showToast('Profile updated ✦');
            }}
          />
        )}
        {showInstantModal && (
          <InstantCameraModal
            onClose={() => setShowInstantModal(false)}
            onComplete={() => {
              setShowInstantModal(false);
              fetchEvents();
              showToast('Instant memory saved ✦');
            }}
          />
        )}
        {toast && <Toast message={toast.message} type={toast.type} />}
        
        {/* Mobile Bottom Bar - Only visible on mobile via CSS */}
        <MobileBottomBar 
          user={user}
          view={view}
          setView={setView}
          theme={theme}
          toggleTheme={toggleTheme}
          onAddClick={() => { setEditingEvent(null); setShowModal(true); }}
          onBulkAddClick={() => setShowBulkModal(true)}
          onInstantClick={() => setShowInstantModal(true)}
          onStatsClick={() => setShowMobileStats(true)}
          onProfileClick={() => setShowProfileModal(true)}
        />
      </Suspense>
    </div>
  );
}
