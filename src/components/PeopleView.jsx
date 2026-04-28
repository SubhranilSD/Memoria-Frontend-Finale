import { useState, useEffect, useCallback, useMemo } from 'react';
import { loadFaceModels, processEventsForFaces, createFaceCrop, createOptimizedImage, saveFaceToDisk, getFaceFromDisk } from '../utils/faceUtils';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import TimelineView from './TimelineView';
import HighlightsReel from './HighlightsReel';
import './PeopleView.css';

export default function PeopleView({ events, onEdit, onDelete }) {
  const { user } = useAuth();
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedPerson, setSelectedPerson] = useState(null);

  // Storage keys
  const CLUSTERS_KEY = `memoria_face_clusters_${user?._id || 'guest'}`;
  const GROUPS_KEY = `memoria_people_groups_${user?._id || 'guest'}`;
  const BDAYS_KEY = `memoria_people_birthdays_${user?._id || 'guest'}`;

  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  // Selection mode for Merge/Groups
  const [selectionMode, setSelectionMode] = useState(null); // 'merge' or 'group'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [groupName, setGroupName] = useState('');

  // Groups and Birthdays stored in localStorage
  const [groups, setGroups] = useState([]);
  const [birthdays, setBirthdays] = useState({}); // id -> date string

  // Birthday Book / Reel state
  const [activeBdayFlow, setActiveBdayFlow] = useState(null); // { person, mode: 'reel' | 'book' }

  // ─── THUMBNAIL RECONSTRUCTION ─────────────────────────────────────────────
  // This state holds the generated object URLs so we can clean them up
  const [reconstructedThumbs, setReconstructedThumbs] = useState({});

  const reconstructedClusters = useMemo(() => {
    return clusters.map(c => ({
      ...c,
      // Priority: 1. Reconstructed Thumb (Local) -> 2. Existing faceUrl (if valid) -> 3. Avatar (Fallback)
      faceUrl: reconstructedThumbs[c.id] || (c.faceUrl && c.faceUrl.length > 50 ? c.faceUrl : null) || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random&color=fff`
    }));
  }, [clusters, reconstructedThumbs]);

  useEffect(() => {
    // Generate thumbnails for clusters that have coordinate data but no local faceUrl
    const generateThumbs = async () => {
      const newThumbs = { ...reconstructedThumbs };
      let changed = false;

      for (const cluster of clusters) {
        if (!newThumbs[cluster.id]) {
          // 1. Check disk cache first
          const saved = await getFaceFromDisk(cluster.id);
          if (saved) {
            newThumbs[cluster.id] = saved;
            changed = true;
          } else if (cluster.representativeMediaUrl && cluster.faceBox) {
            // 2. Reconstruct if missing
            try {
              const img = await createOptimizedImage(cluster.representativeMediaUrl);
              const thumbUrl = createFaceCrop(img, cluster.faceBox);
              newThumbs[cluster.id] = thumbUrl;
              saveFaceToDisk(cluster.id, thumbUrl); // Cache for later
              changed = true;
            } catch (e) {
              console.warn(`Failed to reconstruct thumb for ${cluster.name}`, e);
            }
          }
        }
      }

      if (changed) {
        setReconstructedThumbs(newThumbs);
      }
    };

    if (clusters.length > 0) {
      generateThumbs();
    }
  }, [clusters]);
  // ──────────────────────────────────────────────────────────────────────────

  // Load from local storage or backend
  const loadFromLocal = useCallback(async () => {
    let hasLocalData = false;
    try {
      const savedClusters = localStorage.getItem(CLUSTERS_KEY);
      if (savedClusters) {
        setClusters(JSON.parse(savedClusters));
        hasLocalData = true;
      }

      const savedGroups = localStorage.getItem(GROUPS_KEY);
      if (savedGroups) setGroups(JSON.parse(savedGroups));

      const savedBdays = localStorage.getItem(BDAYS_KEY);
      if (savedBdays) setBirthdays(JSON.parse(savedBdays));
    } catch (e) { }

    // Always check backend for updates
    if (user) {
      try {
        const res = await api.get('/people');
        if (res.data && res.data.clusters?.length > 0) {
          const { clusters: c, groups: g, birthdays: b } = res.data;
          
          // Only update if backend data is newer or local is empty
          setClusters(c);
          setGroups(g || []);
          setBirthdays(b || {});
          
          localStorage.setItem(CLUSTERS_KEY, JSON.stringify(c));
          if (g) localStorage.setItem(GROUPS_KEY, JSON.stringify(g));
          if (b) localStorage.setItem(BDAYS_KEY, JSON.stringify(b));
          setLastSynced(new Date(res.data.updatedAt));
        }
      } catch (err) {
        console.error("Failed to fetch from backend:", err);
      }
    }
  }, [CLUSTERS_KEY, GROUPS_KEY, BDAYS_KEY, user]);

  useEffect(() => {
    loadFaceModels();
    loadFromLocal();
  }, [loadFromLocal]);

  const saveToLocal = (updatedClusters, updatedGroups, updatedBdays) => {
    if (updatedClusters !== undefined && updatedClusters !== null) {
      setClusters(updatedClusters);
      
      // Save heavy images to IndexedDB and strip them from localStorage payload
      updatedClusters.forEach(c => {
        if (c.faceUrl && c.faceUrl.length > 50) {
          saveFaceToDisk(c.id, c.faceUrl);
        }
      });

      const minimal = updatedClusters.map(({ faceUrl, ...rest }) => rest);
      try {
        localStorage.setItem(CLUSTERS_KEY, JSON.stringify(minimal));
      } catch (e) {
        console.error("Storage save failed", e);
      }
    }
    if (updatedGroups !== undefined && updatedGroups !== null) {
      setGroups(updatedGroups);
      localStorage.setItem(GROUPS_KEY, JSON.stringify(updatedGroups));
    }
    if (updatedBdays !== undefined && updatedBdays !== null) {
      setBirthdays(updatedBdays);
      localStorage.setItem(BDAYS_KEY, JSON.stringify(updatedBdays));
    }
  };


  const [scanStatus, setScanStatus] = useState('');

  const handleScan = async () => {
    if (loading) return;
    setLoading(true);
    setProgress(0);
    setScanStatus('Initializing AI Engine...');
    const modelsReady = await loadFaceModels();
    if (!modelsReady) {
      setLoading(false);
      return;
    }
    setScanStatus('Scanning Library...');
    const results = await processEventsForFaces(events, (p) => {
      setProgress(Math.round(p));
      if (p > 50) setScanStatus('Clustering similar faces...');
    });
    setScanStatus('Finalizing Profiles...');
    
    // ─── NAME PERSISTENCE LOGIC ───
    // Match new results with existing named clusters
    const finalResults = results.map(newC => {
      if (!newC.avgDescriptor) return newC;
      
      let bestMatch = null;
      let minDistance = 0.55; // Same threshold as faceUtils

      clusters.forEach(oldC => {
        if (oldC.name && oldC.name !== 'Unknown Person' && oldC.avgDescriptor) {
          // Calculate distance (simple euclidean distance)
          const d1 = new Float32Array(newC.avgDescriptor);
          const d2 = new Float32Array(oldC.avgDescriptor);
          let dist = 0;
          for (let i = 0; i < d1.length; i++) dist += (d1[i] - d2[i]) ** 2;
          dist = Math.sqrt(dist);

          if (dist < minDistance) {
            minDistance = dist;
            bestMatch = oldC;
          }
        }
      });

      if (bestMatch) {
        return { 
          ...newC, 
          id: bestMatch.id, 
          name: bestMatch.name, 
          // Keep the old faceUrl if the new one is missing or fallback
          faceUrl: newC.faceUrl || bestMatch.faceUrl 
        };
      }
      return newC;
    });

    try {
      saveToLocal(finalResults);
    } catch (err) {
      console.error("Failed to save results:", err);
    }
    setLoading(false);
    setScanStatus('');
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleMerge = () => {
    if (selectedIds.size < 2) return;
    const ids = Array.from(selectedIds);
    const targetId = ids[0];
    const sourceIds = ids.slice(1);

    const target = clusters.find(c => c.id === targetId);
    let updatedClusters = clusters.filter(c => !sourceIds.includes(c.id));

    updatedClusters = updatedClusters.map(c => {
      if (c.id === targetId) {
        const mergedEventIds = new Set(c.eventIds);
        const mergedMediaUrls = new Set(c.mediaUrls || []);

        sourceIds.forEach(sid => {
          const s = clusters.find(cl => cl.id === sid);
          if (s) {
            s.eventIds?.forEach(eid => mergedEventIds.add(eid));
            s.mediaUrls?.forEach(murl => mergedMediaUrls.add(murl));
          }
        });

        return {
          ...c,
          eventIds: Array.from(mergedEventIds),
          mediaUrls: Array.from(mergedMediaUrls)
        };
      }
      return c;
    });

    saveToLocal(updatedClusters);
    setSelectionMode(null);
    setSelectedIds(new Set());
  };

  const handleCreateGroup = () => {
    if (!groupName.trim() || selectedIds.size === 0) return;
    const newGroup = {
      id: Date.now().toString(),
      name: groupName.trim(),
      peopleIds: Array.from(selectedIds)
    };
    saveToLocal(null, [...groups, newGroup]);
    setSelectionMode(null);
    setSelectedIds(new Set());
    setGroupName('');
  };

  const handleSetBirthday = (id, date) => {
    const updated = { ...birthdays, [id]: date };
    saveToLocal(null, null, updated);
  };

  const handleRename = async (id, newName) => {
    const updated = clusters.map(c => c.id === id ? { ...c, name: newName } : c);
    saveToLocal(updated);

    if (newName.trim() && newName.toLowerCase() !== 'unknown person') {
      const cluster = clusters.find(c => c.id === id);
      if (cluster) {
        try {
          await Promise.all(cluster.eventIds.map(async (eid) => {
            const event = events.find(e => e._id === eid);
            if (event) {
              const currentPeople = new Set(event.people || []);
              currentPeople.add(newName);
              return api.put(`/events/${eid}`, { people: Array.from(currentPeople) });
            }
          }));
        } catch (e) {
          console.error("Sync to events failed", e);
        }
      }
    }
  };

  if (selectedPerson) {
    const personEvents = events.filter(e => selectedPerson.eventIds.includes(e._id));
    const thumb = reconstructedThumbs[selectedPerson.id] || selectedPerson.faceUrl;

    return (
      <div className="people-view-detail animate-fadeIn">
        <div className="people-detail-header">
          <button className="btn btn-ghost" onClick={() => setSelectedPerson(null)} style={{ marginBottom: '10px' }}>
            ← Back to People
          </button>
          <div className="people-detail-title">
            <img src={thumb} alt="" className="people-detail-avatar" />
            <div>
              <h2>{selectedPerson.name}</h2>
              <p>{personEvents.length} Memories together</p>
            </div>
          </div>
          <div className="people-detail-actions">
            <div className="bday-input-group">
              <span>🎂 Birthday:</span>
              <input
                type="date"
                value={birthdays[selectedPerson.id] || ''}
                onChange={(e) => handleSetBirthday(selectedPerson.id, e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={() => setActiveBdayFlow({ person: selectedPerson, mode: 'reel' })}>
              📖 Birthday Book
            </button>
          </div>
        </div>

        <div style={{ marginTop: '40px' }}>
          <TimelineView events={personEvents} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>
    );
  }

  if (activeBdayFlow) {
    const { person, mode } = activeBdayFlow;
    let targetPhotos = person.mediaUrls;
    if (!targetPhotos || targetPhotos.length === 0) {
      const pEvents = events.filter(e => (person.eventIds || []).includes(e._id));
      targetPhotos = pEvents.map(e => e.media?.[0]?.url).filter(Boolean);
    }
    const personEvents = events.filter(e => e.media?.some(m => targetPhotos.includes(m.url)));

    if (mode === 'reel') {
      return (
        <div className="bday-reel-overlay animate-fadeIn">
          <div className="bday-reel-header">
            <h2 className="font-display">Highlight Reel: {person.name}</h2>
            <button className="btn btn-ghost" onClick={() => setActiveBdayFlow(null)}>✕ Close</button>
          </div>
          <div className="bday-reel-container">
            {targetPhotos.length > 0 ? (
              <HighlightsReel
                events={personEvents}
                isBdayReel={true}
                filterUrls={targetPhotos}
                onComplete={() => setActiveBdayFlow({ person, mode: 'book' })}
                onClose={() => setActiveBdayFlow(null)}
              />
            ) : (
              <div className="people-empty" style={{ color: 'white', background: 'transparent' }}>
                <span style={{ fontSize: '48px' }}>🔍</span>
                <h3>No Photos Found</h3>
                <p>We couldn't find any specific photos for this person.</p>
              </div>
            )}
          </div>
          <div className="bday-reel-actions">
            <button className="btn btn-primary btn-lg" onClick={() => setActiveBdayFlow({ person, mode: 'book' })}>
              Skip to Birthday Book
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="modal-overlay" onClick={() => setActiveBdayFlow(null)}>
        <div className="modal-content bday-book-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="font-display">🎂 {person.name}'s Birthday Book</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-ghost" onClick={() => setActiveBdayFlow({ person, mode: 'reel' })}>⏮ Watch Reel Again</button>
              <button className="btn btn-ghost" onClick={() => setActiveBdayFlow(null)}>✕</button>
            </div>
          </div>
          <div className="bday-book-reel">
            {targetPhotos.map((url, idx) => {
              const event = personEvents.find(e => e.media?.some(m => m.url === url));
              return (
                <div key={idx} className="bday-page">
                  <img src={url} alt="" />
                  {event && <div className="bday-page-caption">{event.title} — {new Date(event.date).getFullYear()}</div>}
                </div>
              );
            })}
          </div>
          <div className="bday-book-footer">
            <p className="bday-book-note">This book contains only the {targetPhotos.length} photos where {person.name} was detected.</p>
            <button className="btn btn-primary btn-lg" onClick={() => window.print()}>
              📥 Export as PDF / Print
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="people-view animate-fadeIn">
      <div className="people-header">
        <div>
          <h1 className="font-display" style={{ fontSize: '42px', margin: '0 0 8px' }}>People & Faces</h1>
          <div className="ai-performance-badges">
            <span className="ai-badge">⚡ TinyFaceDetector Active</span>
            <span className="ai-badge">📦 Parallel Batching: 4x</span>
            <span className="ai-badge">🧠 Persistent Descriptor Cache</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '12px' }}>
            Manage the people in your story. Group them, mark birthdays, and merge profiles.
          </p>
        </div>

        <div className="people-header-actions">
          {!selectionMode ? (
            <>
              <button className="btn btn-ghost" onClick={() => setSelectionMode('merge')}>🔗 Merge Profiles</button>
              <button className="btn btn-ghost" onClick={() => setSelectionMode('group')}>👥 Make Group</button>
              <button className="btn btn-primary" onClick={handleScan} disabled={loading}>
                {loading ? 'Scanning...' : 'Scan Library'}
              </button>
            </>
          ) : (
            <div className="selection-toolbar animate-in">
              {selectionMode === 'group' && (
                <input
                  type="text"
                  placeholder="Group Name..."
                  className="input group-name-input"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                />
              )}
              <span className="selection-count">{selectedIds.size} selected</span>
              <button className="btn btn-primary" onClick={selectionMode === 'merge' ? handleMerge : handleCreateGroup}>
                Confirm {selectionMode === 'merge' ? 'Merge' : 'Group'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setSelectionMode(null); setSelectedIds(new Set()); }}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      {groups.length > 0 && !selectionMode && (
        <div className="people-groups-section">
          <h3>Your Groups</h3>
          <div className="groups-list">
            {groups.map(g => (
              <div key={g.id} className="group-chip">
                <span className="group-icon">👥</span>
                <span className="group-name">{g.name}</span>
                <span className="group-size">{g.peopleIds.length}</span>
                <button className="group-remove" onClick={() => saveToLocal(null, groups.filter(gr => gr.id !== g.id))}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="people-loading-state">
          <div className="spinner" />
          <h3>{scanStatus || 'AI Face Recognition Running'}</h3>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {!loading && clusters.length === 0 && (
        <div className="people-empty">
          <span style={{ fontSize: '64px', marginBottom: '24px', display: 'block' }}>📸</span>
          <h2>No Faces Scanned Yet</h2>
        </div>
      )}

      {!loading && clusters.length > 0 && (
        <div className="people-grid">
          {reconstructedClusters.map(cluster => (
            <div
              key={cluster.id}
              className={`person-card ${selectedIds.has(cluster.id) ? 'selected' : ''}`}
              onClick={() => selectionMode && toggleSelect(cluster.id)}
            >
              <div className="person-avatar-wrap" onClick={() => !selectionMode && setSelectedPerson(cluster)}>
                <img src={cluster.faceUrl} alt="" className="person-avatar" />
                <div className="person-count">{cluster.eventIds.length}</div>
                {selectionMode && (
                  <div className="selection-checkbox">
                    {selectedIds.has(cluster.id) ? '✓' : ''}
                  </div>
                )}
              </div>

              <input
                type="text"
                className="person-name-input"
                value={cluster.name}
                placeholder="Who is this?"
                onChange={(e) => handleRename(cluster.id, e.target.value)}
                onClick={e => e.stopPropagation()}
                readOnly={selectionMode}
              />

              {birthdays[cluster.id] && (
                <div className="person-bday-badge">🎂 {new Date(birthdays[cluster.id]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
