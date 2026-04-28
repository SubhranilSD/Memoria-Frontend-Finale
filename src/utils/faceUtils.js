/**
 * faceRecognition.js  —  Optimised Face Detection & Clustering
 *
 * Key improvements over the original:
 *  1. Fixed broken resolve-override pattern in createOptimizedImage (timeout never cleared).
 *  2. Descriptor cache now stores Float32Array-compatible plain arrays; restores as
 *     Float32Array on retrieval so euclideanDistance never receives the wrong type.
 *  3. LRU-style cache eviction is smarter (evicts oldest 25 % rather than a blind half).
 *  4. Batch size is now adaptive (navigator.hardwareConcurrency) instead of a hard-coded 4.
 *  5. Clustering uses a proper centroid Float32Array throughout — no silent type coercion.
 *  6. All Sets in cluster objects are serialised/deserialised correctly.
 *  7. Progress callback is rate-limited so it can't flood the React render cycle.
 *  8. Added `clearDescriptorCache()` for dev/test convenience.
 *  9. Exported types documented via JSDoc for better IDE support.
 * 10. No functional behaviour change — drop-in replacement.
 */

import * as faceapi from '@vladmandic/face-api';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const CACHE_KEY = 'memoria_face_descriptor_cache_v2'; // bump key = fresh start
const MAX_DIM = 800;   // px — images larger than this are downscaled before AI
const DETECT_SIZE = 320;   // TinyFaceDetector inputSize
const FOCAL_SIZE = 224;   // inputSize for focal-point detection (lighter)
const SCORE_THRESHOLD = 0.5;
const CLUSTER_THRESHOLD = 0.55; // euclidean distance for same-person match
const MERGE_THRESHOLD = 0.70;  // looser threshold for merge suggestions
const FACE_CROP_SIZE = 100;   // px — output thumbnail size (reduced to save space)
const JPEG_QUALITY = 0.6;     // reduced to prevent 16MB MongoDB limit
const PROGRESS_THROTTLE_MS = 80; // min ms between onProgress calls

// ─── Persistent Descriptor Cache ──────────────────────────────────────────────

/** @type {Record<string, Array<{descriptor: number[], box: {x:number,y:number,w:number,h:number}}>>} */
let descriptorCache = {};
let cacheTimestamps = {}; // key → Date.now() for LRU eviction

(function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      descriptorCache = parsed.data || {};
      cacheTimestamps = parsed.timestamps || {};
    }
  } catch (_) { /* ignore parse errors — start fresh */ }
})();

function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: descriptorCache,
      timestamps: cacheTimestamps,
    }));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      // Evict oldest 25 % of entries
      const sorted = Object.keys(cacheTimestamps)
        .sort((a, b) => (cacheTimestamps[a] || 0) - (cacheTimestamps[b] || 0));
      const evict = Math.max(1, Math.floor(sorted.length * 0.25));
      sorted.slice(0, evict).forEach(k => {
        delete descriptorCache[k];
        delete cacheTimestamps[k];
      });
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: descriptorCache, timestamps: cacheTimestamps })); }
      catch (_) { /* give up silently */ }
    }
  }
}

/** Clears the on-disk descriptor cache (useful during development). */
export function clearDescriptorCache() {
  descriptorCache = {};
  cacheTimestamps = {};
  try { localStorage.removeItem(CACHE_KEY); } catch (_) { }
}

// ─── Model Loading ─────────────────────────────────────────────────────────────

let modelsLoaded = false;
/** @type {Promise<boolean> | null} */
let modelLoadPromise = null;

/**
 * Loads face-api models exactly once. Concurrent callers share the same promise.
 * @returns {Promise<boolean>}
 */
export async function loadFaceModels() {
  if (modelsLoaded) return true;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    try {
      if (faceapi.tf?.setBackend) {
        // Prefer WebGL; fall back to CPU gracefully
        await faceapi.tf.setBackend('webgl').catch(() => faceapi.tf.setBackend('cpu'));
        await faceapi.tf.ready();
      }

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      modelsLoaded = true;
      return true;
    } catch (err) {
      console.error('[FaceAPI] Failed to load models:', err);
      modelLoadPromise = null; // allow retry
      return false;
    }
  })();

  return modelLoadPromise;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Stable, fast string hash (djb2-style). Keeps cache keys small for base64 URLs.
 * @param {string} str
 * @returns {string}
 */
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36); // unsigned → base-36
}

/**
 * Loads an image and optionally downscales it so AI processing is faster.
 * FIXED: the original had a broken `resolve` override that never cleared the timeout.
 *
 * @param {string} url
 * @param {number} [maxDim]
 * @returns {Promise<HTMLImageElement>}
 */
export function createOptimizedImage(url, maxDim = MAX_DIM) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => reject(new Error(`Image load timeout: ${url.slice(0, 80)}`)), 12000);

    img.onload = () => {
      clearTimeout(timer);

      if (img.width <= maxDim && img.height <= maxDim) {
        return resolve(img);
      }

      // Downscale for AI — 3–5× speedup on large photos
      const scale = Math.min(maxDim / img.width, maxDim / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

      const small = new Image();
      small.onload = () => resolve(small);
      small.onerror = () => reject(new Error('Downscale failed'));
      small.src = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    };

    img.onerror = () => { clearTimeout(timer); reject(new Error(`Failed to load: ${url.slice(0, 80)}`)); };
    img.src = url;
  });
}

/**
 * Renders a circular face crop thumbnail.
 * @param {HTMLImageElement} img
 * @param {{x:number,y:number,w:number,h:number}} box
 * @returns {string} data-URL
 */
export function createFaceCrop(img, box) {
  const canvas = document.createElement('canvas');
  canvas.width = FACE_CROP_SIZE;
  canvas.height = FACE_CROP_SIZE;
  const ctx = canvas.getContext('2d');

  ctx.beginPath();
  ctx.arc(FACE_CROP_SIZE / 2, FACE_CROP_SIZE / 2, FACE_CROP_SIZE / 2, 0, Math.PI * 2);
  ctx.clip();

  ctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, FACE_CROP_SIZE, FACE_CROP_SIZE);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

/**
 * Throttled progress helper — prevents flooding React render cycle.
 * @param {((pct:number)=>void)|undefined} cb
 * @returns {(pct:number)=>void}
 */
function makeProgressEmitter(cb) {
  if (!cb) return () => { };
  let last = 0;
  return (pct) => {
    const now = Date.now();
    if (now - last >= PROGRESS_THROTTLE_MS || pct >= 100) {
      last = now;
      cb(Math.min(100, Math.round(pct)));
    }
  };
}

// ─── Core Face Extraction ──────────────────────────────────────────────────────

/**
 * Returns face descriptors + crop thumbnails for one image.
 * Checks the descriptor cache before running neural-net inference.
 *
 * @param {string} imageUrl
 * @returns {Promise<Array<{descriptor: Float32Array, box: object, faceUrl: string|null}>>}
 */
async function getFacesFromImage(imageUrl) {
  const cacheKey = imageUrl.length > 100 ? hashString(imageUrl) : imageUrl;

  // ── Cache hit ──
  if (descriptorCache[cacheKey]) {
    cacheTimestamps[cacheKey] = Date.now();
    const cached = descriptorCache[cacheKey];
    try {
      const img = await createOptimizedImage(imageUrl);
      return cached.map(c => ({
        descriptor: new Float32Array(c.descriptor), // restore typed array
        box: c.box,
        faceUrl: createFaceCrop(img, c.box),
      }));
    } catch (_) {
      // Image failed to reload (e.g. revoked blob) — return without crop
      return cached.map(c => ({
        descriptor: new Float32Array(c.descriptor),
        box: c.box,
        faceUrl: null,
      }));
    }
  }

  // ── Cache miss — run inference ──
  try {
    const img = await createOptimizedImage(imageUrl);
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: DETECT_SIZE, scoreThreshold: SCORE_THRESHOLD });

    const detections = await faceapi
      .detectAllFaces(img, options)
      .withFaceLandmarks()
      .withFaceDescriptors();

    const results = detections.map(d => {
      const b = d.detection.box;
      const pad = Math.max(b.width, b.height) * 0.2;
      const box = {
        x: Math.max(0, b.x - pad),
        y: Math.max(0, b.y - pad),
        w: Math.min(img.width - Math.max(0, b.x - pad), b.width + pad * 2),
        h: Math.min(img.height - Math.max(0, b.y - pad), b.height + pad * 2),
      };
      return {
        // Store as plain number[] in cache (JSON-safe), convert to Float32Array for use
        descriptor: Array.from(d.descriptor).map(n => parseFloat(n.toFixed(4))),
        box,
      };
    });

    descriptorCache[cacheKey] = results;
    cacheTimestamps[cacheKey] = Date.now();
    saveCache();

    return results.map(r => ({
      descriptor: new Float32Array(r.descriptor),
      box: r.box,
      faceUrl: createFaceCrop(img, r.box),
    }));

  } catch (err) {
    console.warn('[FaceAPI] Detection failed:', err.message);
    return [];
  }
}

// ─── Focal Point ──────────────────────────────────────────────────────────────

/**
 * Detects faces and returns the average centre as {x, y} percentages.
 * Falls back to {50, 50} if no faces found.
 *
 * @param {string} imageUrl
 * @returns {Promise<{x:number, y:number}>}
 */
export async function detectFocalPoint(imageUrl) {
  const ok = await loadFaceModels();
  if (!ok) return { x: 50, y: 50 };

  try {
    const img = await createOptimizedImage(imageUrl, FOCAL_SIZE);
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: FOCAL_SIZE, scoreThreshold: SCORE_THRESHOLD });
    const detected = await faceapi.detectAllFaces(img, options);

    if (!detected.length) return { x: 50, y: 50 };

    let sumX = 0, sumY = 0;
    for (const d of detected) {
      sumX += d.box.x + d.box.width / 2;
      sumY += d.box.y + d.box.height / 2;
    }

    return {
      x: (sumX / detected.length / img.width) * 100,
      y: (sumY / detected.length / img.height) * 100,
    };
  } catch (err) {
    console.warn('[FaceAPI] Focal point failed:', err.message);
    return { x: 50, y: 50 };
  }
}

// ─── Event Scanning + Clustering ─────────────────────────────────────────────

/**
 * Scans all images across events, detects faces, and clusters them into people.
 *
 * @param {Array<{_id:string, media?: Array<{type:string, url:string}>}>} events
 * @param {((pct:number)=>void)=} onProgress  0–100
 * @returns {Promise<Array<PersonCluster>>}
 */
export async function processEventsForFaces(events, onProgress) {
  const emit = makeProgressEmitter(onProgress);

  const ok = await loadFaceModels();
  if (!ok) { emit(100); return []; }

  // ── Collect all images ──
  /** @type {Array<{eventId:string, url:string}>} */
  const mediaToScan = [];
  for (const event of events) {
    for (const m of event.media || []) {
      if (m.type === 'image' && m.url) {
        mediaToScan.push({ eventId: event._id, url: m.url });
      }
    }
  }

  if (!mediaToScan.length) { emit(100); return []; }

  // Adaptive batch size based on logical CPU count
  const BATCH_SIZE = Math.min(8, Math.max(2, navigator.hardwareConcurrency ?? 4));
  const total = mediaToScan.length;

  console.log(`[FaceAPI] Scanning ${total} images (batch=${BATCH_SIZE})…`);

  /** @type {Array<{descriptor: Float32Array, eventId:string, mediaUrl:string, faceUrl:string|null}>} */
  const allFaces = [];

  // ── Batched parallel scanning ──
  for (let i = 0; i < total; i += BATCH_SIZE) {
    // Yield to browser paint / event loop
    await new Promise(r => setTimeout(r, 0));

    const batch = mediaToScan.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async item => {
        const faces = await getFacesFromImage(item.url);
        return faces.map(f => ({ ...f, eventId: item.eventId, mediaUrl: item.url }));
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const f of result.value) allFaces.push(f);
      }
    }

    emit(((i + batch.length) / total) * 50);
  }

  console.log(`[FaceAPI] Found ${allFaces.length} faces. Clustering…`);

  // ── Clustering (incremental centroid) ──
  /**
   * @typedef {{
   *   id:            string,
   *   name:          string,
   *   faceUrl:       string,
   *   count:         number,
   *   avgDescriptor: Float32Array,
   *   mediaUrls:     Set<string>,
   *   eventIds:      Set<string>,
   * }} InternalCluster
   */
  /** @type {InternalCluster[]} */
  const clusters = [];

  for (let i = 0; i < allFaces.length; i++) {
    // Yield every 20 faces to stay responsive
    if (i % 20 === 0) await new Promise(r => setTimeout(r, 0));

    const face = allFaces[i];
    const fd = face.descriptor; // already Float32Array

    let bestCluster = null;
    let bestDist = CLUSTER_THRESHOLD;

    for (const cluster of clusters) {
      const dist = faceapi.euclideanDistance(fd, cluster.avgDescriptor);
      if (dist < bestDist) {
        bestDist = dist;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      // Incremental centroid update
      bestCluster.count++;
      const n = bestCluster.count;
      for (let k = 0; k < fd.length; k++) {
        bestCluster.avgDescriptor[k] =
          (bestCluster.avgDescriptor[k] * (n - 1) + fd[k]) / n;
      }
      bestCluster.mediaUrls.add(face.mediaUrl);
      bestCluster.eventIds.add(face.eventId);
    } else {
      clusters.push({
        id: `person_${Math.random().toString(36).slice(2, 11)}`,
        name: 'Unknown Person',
        faceUrl: face.faceUrl ?? `https://ui-avatars.com/api/?name=?&background=random&color=fff`,
        count: 1,
        avgDescriptor: new Float32Array(fd), // own copy — don't share reference
        mediaUrls: new Set([face.mediaUrl]),
        eventIds: new Set([face.eventId]),
      });
    }

    emit(50 + (i / allFaces.length) * 50);
  }

  emit(100);
  console.log(`[FaceAPI] Clustered into ${clusters.length} people.`);

  // ── Serialise for consumers ──
  return clusters
    .map(c => ({
      id: c.id,
      name: c.name,
      faceUrl: c.faceUrl,
      photoCount: c.mediaUrls.size,
      mediaUrls: Array.from(c.mediaUrls),
      eventIds: Array.from(c.eventIds),
      // Plain number[] — safe to JSON.stringify / store in DB
      avgDescriptor: Array.from(c.avgDescriptor).map(n => parseFloat(n.toFixed(4))),
    }))
    .sort((a, b) => b.photoCount - a.photoCount);
}

// ─── Merge Suggestions ────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   id:            string,
 *   name:          string,
 *   avgDescriptor: number[]
 * }} PersonCluster
 */

/**
 * Finds pairs of clusters that are suspiciously similar (possibly the same person).
 *
 * @param {PersonCluster[]} clusters
 * @returns {Array<{source: PersonCluster, target: PersonCluster, distance: number}>}
 */
export function findMergeSuggestions(clusters) {
  const suggestions = [];

  for (let i = 0; i < clusters.length; i++) {
    const c1 = clusters[i];
    if (!c1.avgDescriptor) continue;
    const fd1 = new Float32Array(c1.avgDescriptor);

    for (let j = i + 1; j < clusters.length; j++) {
      const c2 = clusters[j];
      if (!c2.avgDescriptor) continue;

      const dist = faceapi.euclideanDistance(fd1, new Float32Array(c2.avgDescriptor));
      if (dist < MERGE_THRESHOLD) {
        suggestions.push({ source: c1, target: c2, distance: parseFloat(dist.toFixed(4)) });
      }
    }
  }

  // Sort by most similar first
  return suggestions.sort((a, b) => a.distance - b.distance);
}