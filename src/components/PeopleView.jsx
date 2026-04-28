import { useState, useEffect } from 'react';
import { loadFaceModels, processEventsForFaces } from '../utils/faceUtils';
import TimelineView from './TimelineView';
import HighlightsReel from './HighlightsReel';
import './PeopleView.css';

export default function PeopleView({ events, onEdit, onDelete }) {
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedPerson, setSelectedPerson] = useState(null);
  
  // Selection mode for Merge/Groups
  const [selectionMode, setSelectionMode] = useState(null); // 'merge' or 'group'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [groupName, setGroupName] = useState('');

  // Groups and Birthdays stored in localStorage
  const [groups, setGroups] = useState([]);
  const [birthdays, setBirthdays] = useState({}); // id -> date string

  // Birthday Book / Reel state
  const [activeBdayFlow, setActiveBdayFlow] = useState(null); // { person, mode: 'reel' | 'book' }

  // Load from local storage
  useEffect(() => {
    try {
      const savedClusters = localStorage.getItem('memoria_face_clusters');
      if (savedClusters) setClusters(JSON.parse(savedClusters));
      
      const savedGroups = localStorage.getItem('memoria_people_groups');
      if (savedGroups) setGroups(JSON.parse(savedGroups));

      const savedBdays = localStorage.getItem('memoria_people_birthdays');
      if (savedBdays) setBirthdays(JSON.parse(savedBdays));
    } catch (e) { }
  }, []);


  const saveToLocal = (updatedClusters, updatedGroups, updatedBdays) => {
    if (updatedClusters) {
      setClusters(updatedClusters);
      localStorage.setItem('memoria_face_clusters', JSON.stringify(updatedClusters));
    }
    if (updatedGroups) {
      setGroups(updatedGroups);
      localStorage.setItem('memoria_people_groups', JSON.stringify(updatedGroups));
    }
    if (updatedBdays) {
      setBirthdays(updatedBdays);
      localStorage.setItem('memoria_people_birthdays', JSON.stringify(updatedBdays));
    }
  };

  const handleScan = async () => {
    setLoading(true);
    setProgress(0);
    const modelsReady = await loadFaceModels();
    if (!modelsReady) {
      alert("Failed to load AI Face Models.");
      setLoading(false);
      return;
    }
    const results = await processEventsForFaces(events, (p) => setProgress(Math.round(p)));
    saveToLocal(results);
    setLoading(false);
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
    
    // Merge eventIds and descriptors
    updatedClusters = updatedClusters.map(c => {
      if (c.id === targetId) {
        const mergedEventIds = new Set(c.eventIds);
        sourceIds.forEach(sid => {
          const s = clusters.find(cl => cl.id === sid);
          if (s) s.eventIds.forEach(eid => mergedEventIds.add(eid));
        });
        return { ...c, eventIds: Array.from(mergedEventIds) };
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

  const handleRename = (id, newName) => {
    const updated = clusters.map(c => c.id === id ? { ...c, name: newName } : c);
    saveToLocal(updated);
  };

  // If a person is selected, show their specific memories
  if (selectedPerson) {
    const personEvents = events.filter(e => selectedPerson.eventIds.includes(e._id));
    return (
      <div className="people-view-detail animate-fadeIn">
        <div className="people-detail-header">
          <button 
            className="btn btn-ghost" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedPerson(null);
            }}
            style={{ marginBottom: '10px' }}
          >
            ← Back to People
          </button>
          <div className="people-detail-title">
            <img src={selectedPerson.faceUrl} alt="" className="people-detail-avatar" />
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
    
    // Get specific photos person is in. 
    // Fallback for older clusters that only have eventIds:
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
                <p>We couldn't find any specific photos for this person. Try re-scanning your library.</p>
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
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
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
          <h3>AI Face Recognition Running</h3>
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
          {clusters.map(cluster => (
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
