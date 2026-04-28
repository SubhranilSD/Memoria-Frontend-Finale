import { useState, useMemo, useRef, useEffect } from 'react';
import Globe from 'react-globe.gl';
import { motion, AnimatePresence } from 'framer-motion';
import './GlobeView.css';

// Simple offline geocoder for demo purposes
const CITY_COORDS = {
  'new york': { lat: 40.7128, lng: -74.0060 },
  'london': { lat: 51.5074, lng: -0.1278 },
  'paris': { lat: 48.8566, lng: 2.3522 },
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  'sydney': { lat: -33.8688, lng: 151.2093 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  'berlin': { lat: 52.5200, lng: 13.4050 },
  'delhi': { lat: 28.7041, lng: 77.1025 },
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  'rome': { lat: 41.9028, lng: 12.4964 },
  'toronto': { lat: 43.6510, lng: -79.3470 },
  'cape town': { lat: -33.9249, lng: 18.4241 },
  'rio': { lat: -22.9068, lng: -43.1729 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
  'bali': { lat: -8.4095, lng: 115.1889 },
};

function geocode(locationStr) {
  if (!locationStr) return null;
  const lower = locationStr.toLowerCase();
  
  // Try direct match first
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(city)) return coords;
  }
  
  // Fallback: Check if it's "lat, lng" format
  const parts = locationStr.split(',').map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { lat: parts[0], lng: parts[1] };
  }
  
  // Deterministic pseudo-random based on string sum so it doesn't jump around
  let hash = 0;
  for (let i = 0; i < locationStr.length; i++) hash += locationStr.charCodeAt(i);
  return { 
    lat: (hash % 140) - 70, 
    lng: ((hash * 13) % 360) - 180 
  };
}

export default function GlobeView({ events, onFilterLocation }) {
  const globeRef = useRef();
  const wrapRef = useRef();
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Measure container
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setDims({ w: entries[0].contentRect.width, h: entries[0].contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Map events to globe data
  const gData = useMemo(() => {
    return events
      .filter(e => e.location || e.coordinates)
      .map(e => {
        let lat, lng;
        
        // Prioritize actual EXIF coordinates if available
        if (e.coordinates && e.coordinates.lat != null && e.coordinates.lng != null) {
          // EXIF sometimes returns coordinates differently, ensuring they are numbers
          lat = parseFloat(e.coordinates.lat) || e.coordinates.lat[0] || e.coordinates.lat;
          lng = parseFloat(e.coordinates.lng) || e.coordinates.lng[0] || e.coordinates.lng;
        } else {
          // Fallback to offline geocoder
          const coords = geocode(e.location);
          if (!coords) return null;
          lat = coords.lat;
          lng = coords.lng;
        }

        return {
          ...e,
          lat,
          lng,
          size: Math.random() * 0.5 + 0.2, // Random star size
          color: e.color || '#c4813a'
        };
      })
      .filter(Boolean);
  }, [events]);

  // Initial animation
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.5;
      globeRef.current.pointOfView({ altitude: 2 }, 4000);
    }
  }, []);

  return (
    <div className="globe-wrapper" ref={wrapRef}>
      <div className="globe-overlay-hud">
        <h2>Memory Globe</h2>
        <p>{gData.length} places explored</p>
      </div>

      {dims.w > 0 && (
        <Globe
          ref={globeRef}
          width={dims.w}
          height={dims.h}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          
          pointsData={gData}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointAltitude="size"
          pointRadius={0.5}
          pointsMerge={false}
          
          labelsData={gData}
          labelLat="lat"
          labelLng="lng"
          labelDotRadius={0.4}
          labelDotOrientation={() => 'bottom'}
          labelColor={() => 'rgba(255, 255, 255, 0.75)'}
          labelText="title"
          labelSize={1.5}
          labelResolution={2}
          
          onPointClick={(d) => {
            globeRef.current.pointOfView({ lat: d.lat, lng: d.lng, altitude: 0.8 }, 1500);
            setSelectedEvent(d);
          }}
          onLabelClick={(d) => {
            globeRef.current.pointOfView({ lat: d.lat, lng: d.lng, altitude: 0.8 }, 1500);
            setSelectedEvent(d);
          }}
        />
      )}

      {/* Selected detail card */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            className="globe-detail"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <button className="globe-detail-close" onClick={() => setSelectedEvent(null)}>✕</button>
            <div className="globe-detail-bar" style={{ background: selectedEvent.color }} />
            <div className="globe-detail-content">
              <h3>{selectedEvent.title}</h3>
              <div className="globe-detail-date">{new Date(selectedEvent.date).toLocaleDateString()}</div>
              <div className="globe-detail-loc">📍 {selectedEvent.location}</div>
              {selectedEvent.description && <p>{selectedEvent.description.slice(0, 100)}...</p>}
              
              {onFilterLocation && selectedEvent.location && (
                <button 
                  className="btn btn-primary btn-sm" 
                  style={{ marginTop: '16px', width: '100%' }}
                  onClick={() => onFilterLocation(selectedEvent.location)}
                >
                  View timeline for this location
                </button>
              )}
            </div>
            {selectedEvent.media?.length > 0 && (
              <img src={selectedEvent.media[0].url} alt="" className="globe-detail-img" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
