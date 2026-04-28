const DEFAULT_MOODS = [
  { value: 'joyful',      emoji: '😄', label: 'Joyful',      color: '#f59e0b' },
  { value: 'nostalgic',   emoji: '🌙', label: 'Nostalgic',   color: '#8b5cf6' },
  { value: 'proud',       emoji: '🏆', label: 'Proud',       color: '#10b981' },
  { value: 'sad',         emoji: '💧', label: 'Sad',         color: '#6b7280' },
  { value: 'excited',     emoji: '⚡', label: 'Excited',     color: '#ef4444' },
  { value: 'peaceful',    emoji: '🕊', label: 'Peaceful',    color: '#06b6d4' },
  { value: 'grateful',    emoji: '🌸', label: 'Grateful',    color: '#ec4899' },
  { value: 'adventurous', emoji: '🗺', label: 'Adventurous', color: '#f97316' },
  { value: 'inspired',    emoji: '💡', label: 'Inspired',    color: '#fbbf24' },
  { value: 'calm',        emoji: '🌊', label: 'Calm',        color: '#2dd4bf' },
  { value: 'melancholy',  emoji: '☁️', label: 'Melancholy',  color: '#94a3b8' },
  { value: 'energetic',   emoji: '🔥', label: 'Energetic',   color: '#f43f5e' },
  { value: 'romantic',    emoji: '💖', label: 'Romantic',    color: '#f472b6' },
];

export function getMoods() {
  const custom = localStorage.getItem('memoria_custom_moods');
  const customList = custom ? JSON.parse(custom) : [];
  return [...DEFAULT_MOODS, ...customList];
}

export function addCustomMood(mood) {
  const moods = getMoods();
  const exists = moods.find(m => m.value === mood.value);
  if (exists) return false;

  const custom = localStorage.getItem('memoria_custom_moods');
  const customList = custom ? JSON.parse(custom) : [];
  customList.push(mood);
  localStorage.setItem('memoria_custom_moods', JSON.stringify(customList));
  return true;
}

export const MOOD_COLORS = DEFAULT_MOODS.reduce((acc, m) => {
  acc[m.value] = m.color;
  return acc;
}, {});

export const MOOD_EMOJIS = DEFAULT_MOODS.reduce((acc, m) => {
  acc[m.value] = m.emoji;
  return acc;
}, {});
