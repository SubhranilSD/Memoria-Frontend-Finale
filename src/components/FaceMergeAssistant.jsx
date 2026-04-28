import React, { useState, useEffect } from 'react';
import { findMergeSuggestions } from '../utils/faceUtils';
import './FaceMergeAssistant.css';

export default function FaceMergeAssistant({ onMergeComplete }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('memoria_face_clusters');
    if (saved) {
      const clusters = JSON.parse(saved);
      const suggs = findMergeSuggestions(clusters);
      setSuggestions(suggs);
    }
    setLoading(false);
  }, []);

  const handleMerge = (source, target) => {
    const saved = localStorage.getItem('memoria_face_clusters');
    if (!saved) return;

    let clusters = JSON.parse(saved);
    
    // Create new cluster
    const mergedCluster = {
      ...source,
      eventIds: Array.from(new Set([...source.eventIds, ...target.eventIds])),
      name: source.name !== 'Unknown Person' ? source.name : target.name
    };

    // Remove old clusters and add new one
    clusters = clusters.filter(c => c.id !== source.id && c.id !== target.id);
    clusters.push(mergedCluster);

    localStorage.setItem('memoria_face_clusters', JSON.stringify(clusters));
    setSuggestions(prev => prev.filter(s => s.source.id !== source.id && s.target.id !== target.id));
    
    if (onMergeComplete) onMergeComplete();
  };

  if (loading) return null;
  if (suggestions.length === 0) return null;

  return (
    <div className="face-merge-assistant animate-in">
      <div className="fma-header">
        <span className="fma-icon">👥</span>
        <div className="fma-title">Merging Suggestions</div>
        <div className="fma-badge">{suggestions.length}</div>
      </div>
      <div className="fma-list">
        {suggestions.map((s, i) => (
          <div key={i} className="fma-item">
            <div className="fma-pair">
              <div className="fma-face">
                <img src={s.source.faceUrl} alt="" />
                <span>{s.source.name}</span>
              </div>
              <div className="fma-arrow">↔</div>
              <div className="fma-face">
                <img src={s.target.faceUrl} alt="" />
                <span>{s.target.name}</span>
              </div>
            </div>
            <div className="fma-info">
              These faces look very similar ({Math.round((1 - s.distance) * 100)}% match).
            </div>
            <button className="btn btn-primary btn-sm fma-merge-btn" onClick={() => handleMerge(s.source, s.target)}>
              Merge Profiles
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
