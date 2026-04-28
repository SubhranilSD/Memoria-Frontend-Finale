/* ══════════════════════════════════
   Time-of-day theming utility
   ══════════════════════════════════ */

/**
 * Returns CSS accent colors based on the hour of the event.
 * Cards can use these to tint themselves contextually.
 */
export function getTimeOfDayTheme(dateStr) {
  const hour = new Date(dateStr).getHours();

  if (hour >= 5 && hour < 8)   return { label:'Dawn',       bg:'#1e1b4b', accent:'#818cf8', glow:'rgba(129,140,248,0.15)' };
  if (hour >= 8 && hour < 12)  return { label:'Morning',    bg:'#fef3c7', accent:'#f59e0b', glow:'rgba(245,158,11,0.12)' };
  if (hour >= 12 && hour < 15) return { label:'Afternoon',  bg:'#fef9c3', accent:'#eab308', glow:'rgba(234,179,8,0.10)' };
  if (hour >= 15 && hour < 18) return { label:'Golden Hour', bg:'#fff7ed', accent:'#f97316', glow:'rgba(249,115,22,0.12)' };
  if (hour >= 18 && hour < 21) return { label:'Evening',    bg:'#1e1b4b', accent:'#a78bfa', glow:'rgba(167,139,250,0.15)' };
  return { label:'Night', bg:'#0f172a', accent:'#6366f1', glow:'rgba(99,102,241,0.18)' };
}

/**
 * Check if a memory is a "future letter" (unlock date is in the future).
 */
export function isFutureLetter(event) {
  if (event.unlockDate) return new Date(event.unlockDate) > new Date();
  return new Date(event.date) > new Date();
}

/**
 * Days until future letter unlocks.
 */
export function daysUntilUnlock(event) {
  const target = event.unlockDate ? new Date(event.unlockDate) : new Date(event.date);
  const now = new Date();
  return Math.max(0, Math.ceil((target - now) / 86400000));
}

/**
 * Haversine distance in km between two GPS coords.
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Client-side sentiment score from text (very lightweight).
 * Returns a value from -1 (very negative) to +1 (very positive).
 */
const POS = ['happy','love','amazing','beautiful','wonderful','great','best','awesome','fantastic','joy','grateful','proud','excited','peaceful','lovely','brilliant','blessed','kind','perfect','incredible','excellent','smile','laugh','fun','delight','treasure','cherish','celebrate','thrilled','warm','gentle','cozy','bright','glow','sparkle','bliss'];
const NEG = ['sad','lost','miss','pain','hurt','cry','alone','fear','angry','hate','terrible','awful','worst','broken','struggle','hard','difficult','empty','dark','cold','suffer','grief','lonely','worried','anxious','stressed','regret','sorry','fail','mistake','tears','heavy'];

export function sentimentScore(text) {
  if (!text) return 0;
  const words = text.toLowerCase().split(/\W+/);
  let score = 0;
  words.forEach(w => {
    if (POS.includes(w)) score += 1;
    if (NEG.includes(w)) score -= 1;
  });
  return Math.max(-1, Math.min(1, score / Math.max(words.length * 0.15, 1)));
}

/**
 * Map sentiment score to mood string.
 */
export function sentimentToMood(score) {
  if (score >= 0.5)  return 'joyful';
  if (score >= 0.2)  return 'grateful';
  if (score >= 0.05) return 'peaceful';
  if (score > -0.1)  return 'nostalgic';
  if (score > -0.3)  return 'sad';
  return 'sad';
}

/**
 * Smart Grouping (Clusters)
 * Group events that happen within maxDays of each other AND at the same location.
 */
export function clusterEvents(events, maxDays = 3) {
  if (!events || events.length === 0) return [];
  
  // Sort events chronologically
  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const clusters = [];
  let currentCluster = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = currentCluster[currentCluster.length - 1];
    const curr = sorted[i];
    
    const prevDate = new Date(prev.date);
    const currDate = new Date(curr.date);
    const diffDays = Math.abs((currDate - prevDate) / 86400000);
    
    // Check if same location and within maxDays
    const sameLoc = prev.location && curr.location && prev.location === curr.location;
    
    if (sameLoc && diffDays <= maxDays) {
      currentCluster.push(curr);
    } else {
      clusters.push(currentCluster);
      currentCluster = [curr];
    }
  }
  
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }
  
  // Format the output: if length > 1, it's a cluster. Otherwise, single event.
  return clusters.map(cluster => {
    if (cluster.length === 1) return { isCluster: false, event: cluster[0] };
    
    return {
      isCluster: true,
      events: cluster,
      location: cluster[0].location,
      startDate: cluster[0].date,
      endDate: cluster[cluster.length - 1].date,
      count: cluster.length,
      id: `cluster-${cluster[0]._id}`
    };
  });
}

/**
 * Infer Weather (Demo)
 * Deterministically generates a weather condition based on date and location string.
 */
export function inferWeather(dateStr, locationStr) {
  if (!dateStr) return null;
  const hashStr = String(dateStr) + (locationStr || '');
  let hash = 0;
  for (let i = 0; i < hashStr.length; i++) hash += hashStr.charCodeAt(i);
  
  const weathers = [
    { icon: '☀️', label: 'Sunny' },
    { icon: '⛅', label: 'Partly Cloudy' },
    { icon: '☁️', label: 'Cloudy' },
    { icon: '🌧️', label: 'Rainy' },
    { icon: '⛈️', label: 'Stormy' },
    { icon: '❄️', label: 'Snowy' },
    { icon: '🌫️', label: 'Foggy' },
    { icon: '🌬️', label: 'Windy' },
  ];
  
  return weathers[hash % weathers.length];
}

/**
 * Calculate Daily Streak
 * Returns the number of consecutive days the user has logged a memory up to today.
 */
export function calculateStreak(events) {
  if (!events || events.length === 0) return 0;
  
  // Get unique dates sorted descending
  const uniqueDates = [...new Set(events.map(e => new Date(e.date).toISOString().split('T')[0]))]
    .sort((a, b) => new Date(b) - new Date(a));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  let currentDate = new Date(today);

  // Check if they posted today or yesterday to start the streak
  const mostRecentPost = new Date(uniqueDates[0]);
  mostRecentPost.setHours(0, 0, 0, 0);

  const diffTime = Math.abs(today - mostRecentPost);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // If most recent post is older than yesterday, streak is broken (0)
  if (diffDays > 1) return 0;

  // Otherwise, trace back day by day
  for (let i = 0; i < uniqueDates.length; i++) {
    const postDate = new Date(uniqueDates[i]);
    postDate.setHours(0, 0, 0, 0);

    const expectedDate = new Date(currentDate);
    if (diffDays === 1 && i === 0) {
      // First post was yesterday, adjust expected
      expectedDate.setDate(expectedDate.getDate() - 1);
      currentDate.setDate(currentDate.getDate() - 1);
    }

    if (postDate.getTime() === expectedDate.getTime()) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
