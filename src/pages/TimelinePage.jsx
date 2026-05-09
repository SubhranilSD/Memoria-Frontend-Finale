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
import './TimelinePage.css';

const MOOD_COLORS = {
  joyful: '#f59e0b', nostalgic: '#8b5cf6', proud: '#10b981', sad: '#6b7280',
  excited: '#ef4444', peaceful: '#06b6d4', grateful: '#ec4899', adventurous: '#f97316',
};

export default function TimelinePage() {
  const { user, logout } = useAuth();
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
  
  // Pagination State
  const [visibleCount, setVisibleCount] = useState(10);

  const [showInstantModal, setShowInstantModal] = useState(false);
  const { setUser } = useAuth();

  // Debounced search — prevents visibleEvents from recomputing on every keystroke
  const [searchRaw, setSearchRaw] = useState('');
  const [search, setSearch] = useState('');
  const searchDebounceRef = useRef(null);
  const handleSearchChange = (val) => {
    setSearchRaw(val);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearch(val), 300);
  };

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.mood) params.set('mood', filters.mood);
      if (filters.tag) params.set('tag', filters.tag);
      params.set('sort', filters.sort);
      params.set('order', filters.order);
      const res = await api.get(`/events?${params}`);
      setEvents(res.data);
    } catch {
      showToast('Failed to load events', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

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

  /* Client-side search + person filter (layered on top of server filters) */
  const visibleEvents = useMemo(() => {
    let list = events;
    if (filters.person) list = list.filter(e => (e.people || []).includes(filters.person));
    if (search.trim()) {
      const q = search.toLowerCase();

      // Parse face clusters ONCE, not on every filter iteration
      let faceClusters = [];
      try {
        const clustersKey = `memoria_face_clusters_${user?._id || 'guest'}`;
        const saved = localStorage.getItem(clustersKey);
        if (saved) faceClusters = JSON.parse(saved);
      } catch (e) { }

      // Support multi-person search using comma separation
      if (q.includes(',')) {
        const queryNames = q.split(',').map(n => n.trim()).filter(Boolean);

        // Find matching clusters for EACH query name
        const matchingClusterGroups = queryNames.map(name => {
          return faceClusters.filter(c => c.name.toLowerCase().includes(name));
        });

        // If we found clusters for every query name, intersect them
        if (matchingClusterGroups.every(group => group.length > 0)) {
          // Flatten eventIds for each group (in case multiple clusters match "Alice")
          const eventIdsPerName = matchingClusterGroups.map(group => {
            const ids = new Set();
            group.forEach(c => c.eventIds.forEach(id => ids.add(id)));
            return ids;
          });

          // Intersect
          const intersectedIds = [...eventIdsPerName[0]].filter(id => {
            return eventIdsPerName.every(set => set.has(id));
          });

          return list.filter(e => intersectedIds.includes(e._id));
        }
      }

      // Normal single search
      list = list.filter(e => {
        // Match standard fields
        if (
          e.title?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q) ||
          (e.tags || []).some(t => t.toLowerCase().includes(q)) ||
          (e.people || []).some(p => p.toLowerCase().includes(q))
        ) return true;

        // Match face cluster name
        const personMatch = faceClusters.some(c =>
          c.name.toLowerCase().includes(q) && c.eventIds.includes(e._id)
        );
        return personMatch;
      });
    }
    return list;
  }, [events, filters.person, search]);

  const memCount = visibleEvents.length;

  /* Dynamic Background based on dominant mood */
  const dynamicBgColor = useMemo(() => {
    if (!visibleEvents.length) return 'transparent';
    const counts = {};
    visibleEvents.forEach(e => { if (e.mood) counts[e.mood] = (counts[e.mood] || 0) + 1; });
    const topMood = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!topMood) return 'transparent';
    const color = MOOD_COLORS[topMood[0]];
    // Create a subtle radial gradient string for the background
    return `radial-gradient(circle at 50% -20%, color-mix(in srgb, ${color} 8%, transparent), transparent 70%)`;
  }, [visibleEvents]);

  // Reset pagination when search/filters change
  useEffect(() => {
    setVisibleCount(10);
  }, [search, filters, view]);

  // Derived list based on pagination
  const paginatedEvents = useMemo(() => {
    if (view === 'timeline' || view === 'grid' || view === 'horizon') {
      return visibleEvents.slice(0, visibleCount);
    }
    return visibleEvents;
  }, [visibleEvents, visibleCount, view]);

  // Observer callback for infinite scroll
  const observerRef = useRef(null);
  const loadMoreCallback = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (node) {
      observerRef.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 10);
        }
      }, { rootMargin: '800px' });
      observerRef.current.observe(node);
    }
  }, []);

  return (
    <div className="timeline-page" style={{ background: dynamicBgColor }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {!sidebarOpen && (
                <button
                  className="mobile-menu-toggle btn btn-ghost"
                  onClick={() => setSidebarOpen(true)}
                >
                  ☰
                </button>
              )}
              <div>
                <h1 className="timeline-heading">
                  <span className="font-display">{user?.name?.split(' ')[0]}'s</span> Timeline
                </h1>
                <p className="timeline-subheading">
                  {memCount === 0 ? 'Your story begins here.' : `${memCount} memor${memCount === 1 ? 'y' : 'ies'} captured`}
                </p>
              </div>
            </div>
            <div className="timeline-header-actions">
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
                    {visibleCount < visibleEvents.length && (
                      <div ref={loadMoreCallback} style={{ height: '2px', width: '100%', margin: '40px 0' }} />
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
              fetchEvents();
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
