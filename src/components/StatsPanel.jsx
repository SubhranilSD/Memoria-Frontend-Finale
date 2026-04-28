import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { haversineKm } from '../utils/memoryUtils';
import StatsExportModal from './StatsExportModal';
import './StatsPanel.css';

const MOODS = [
  { value:'joyful',      emoji:'😄', label:'Joyful',      color:'#f59e0b' },
  { value:'nostalgic',   emoji:'🌙', label:'Nostalgic',   color:'#8b5cf6' },
  { value:'proud',       emoji:'🏆', label:'Proud',       color:'#10b981' },
  { value:'sad',         emoji:'💧', label:'Sad',         color:'#6b7280' },
  { value:'excited',     emoji:'⚡', label:'Excited',     color:'#ef4444' },
  { value:'peaceful',    emoji:'🕊', label:'Peaceful',    color:'#06b6d4' },
  { value:'grateful',    emoji:'🌸', label:'Grateful',    color:'#ec4899' },
  { value:'adventurous', emoji:'🗺', label:'Adventurous', color:'#f97316' },
];

const MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmt(d) { if(!d) return '—'; return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function dur(days) {
  if(days < 30)  return `${days}d`;
  if(days < 365) return `${Math.round(days/30)}mo`;
  const y=Math.floor(days/365), m=Math.round((days%365)/30);
  return m>0?`${y}y ${m}mo`:`${y}y`;
}

/* ─── stat computation ─── */
function computeStats(events) {
  if(!events.length) return null;
  const moodCounts = {};
  MOODS.forEach(m=>{moodCounts[m.value]=0;});
  events.forEach(e=>{ if(e.mood) moodCounts[e.mood]=(moodCounts[e.mood]||0)+1; });

  const tagC={};
  events.forEach(e=>(e.tags||[]).forEach(t=>{tagC[t]=(tagC[t]||0)+1;}));
  const topTags = Object.entries(tagC).sort((a,b)=>b[1]-a[1]).slice(0,8);

  const peopleC={};
  events.forEach(e=>(e.people||[]).forEach(p=>{peopleC[p]=(peopleC[p]||0)+1;}));
  const topPeople = Object.entries(peopleC).sort((a,b)=>b[1]-a[1]).slice(0,8);

  const dates = events.map(e=>new Date(e.date)).sort((a,b)=>a-b);
  const first=dates[0], last=dates[dates.length-1];
  const spanDays = first&&last?Math.round((last-first)/86400000):0;

  let avgGap=0;
  if(dates.length>1){
    const gaps=[]; for(let i=1;i<dates.length;i++) gaps.push((dates[i]-dates[i-1])/86400000);
    avgGap=Math.round(gaps.reduce((s,g)=>s+g,0)/gaps.length);
  }

  const topMood = Object.entries(moodCounts).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])[0];
  const withMedia = events.filter(e=>e.media?.length>0).length;
  const totalPhotos = events.reduce((s,e)=>s+(e.media?.length||0),0);
  const privateCount = events.filter(e=>e.isPrivate).length;
  const locs = new Set(events.map(e=>e.location).filter(Boolean));
  const descWords = events.filter(e=>e.description).map(e=>e.description.trim().split(/\s+/).length);
  const avgWords = descWords.length?Math.round(descWords.reduce((s,n)=>s+n,0)/descWords.length):0;
  const longestDesc = events.reduce((b,e)=>{const w=e.description?.trim().split(/\s+/).length||0;return w>(b?.w||0)?{title:e.title,w}:b;},null);

  // heatmap (12 months)
  const now=new Date();
  const heatmap=[];
  for(let i=11;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    heatmap.push({year:d.getFullYear(),month:d.getMonth(),label:MONTHS[d.getMonth()],count:0});
  }
  events.forEach(e=>{
    const d=new Date(e.date);
    const cell=heatmap.find(c=>c.year===d.getFullYear()&&c.month===d.getMonth());
    if(cell) cell.count++;
  });
  const hmMax=Math.max(...heatmap.map(c=>c.count),1);

  // year bars
  const yearC={};
  events.forEach(e=>{const y=new Date(e.date).getFullYear();yearC[y]=(yearC[y]||0)+1;});
  const yearBars=Object.entries(yearC).sort((a,b)=>+a[0]-+b[0]).map(([y,c])=>({year:y,count:c,pct:Math.round((c/Math.max(...Object.values(yearC)))*100)}));

  // dow
  const dow=[0,0,0,0,0,0,0];
  events.forEach(e=>dow[new Date(e.date).getDay()]++);
  const dowMax=Math.max(...dow,1);

  // best month
  const monthC={};
  events.forEach(e=>{const d=new Date(e.date);const k=`${d.getFullYear()} ${MONTHS[d.getMonth()]}`;monthC[k]=(monthC[k]||0)+1;});
  const bestMonth=Object.entries(monthC).sort((a,b)=>b[1]-a[1])[0];

  // ── Mood flow (for area chart): mood counts per month over last 12 months
  const moodFlow = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const inMonth = events.filter(e => { const ed = new Date(e.date); return ed >= d && ed <= mEnd; });
    const row = { label: MONTHS[d.getMonth()] };
    MOODS.forEach(m => { row[m.value] = inMonth.filter(e => e.mood === m.value).length; });
    row.total = inMonth.length;
    moodFlow.push(row);
  }

  // ── Memory gap insight
  let longestGap = { days: 0, from: null, to: null };
  let currentStreak = 0;
  const todayDate = new Date(); todayDate.setHours(23,59,59);
  if (dates.length > 1) {
    for (let i = 1; i < dates.length; i++) {
      const gap = Math.round((dates[i] - dates[i-1]) / 86400000);
      if (gap > longestGap.days) longestGap = { days: gap, from: dates[i-1], to: dates[i] };
    }
    // Current streak: consecutive days from today backwards
    const daySet = new Set(dates.map(d => d.toISOString().split('T')[0]));
    let check = new Date(todayDate);
    while (daySet.has(check.toISOString().split('T')[0])) {
      currentStreak++;
      check.setDate(check.getDate() - 1);
    }
  }

  // ── Distance traveled (needs geocoded locations — approximate using event order)
  // We'll parse coordinates from any location string that looks like "lat, lon" or use 0
  let distanceKm = 0;
  // Simple: calculate from sorted events that have location data
  const locEvents = events.filter(e => e.location).sort((a,b) => new Date(a.date) - new Date(b.date));
  // We can't get actual coords from text — but we track unique location changes as a proxy
  const uniqueLocationChanges = locEvents.reduce((count, e, i) => {
    if (i === 0) return 0;
    return e.location !== locEvents[i-1].location ? count + 1 : count;
  }, 0);

  return { moodCounts,topTags,topPeople,first,last,spanDays,avgGap,topMood,
    withMedia,totalPhotos,privateCount,uniqueLocs:locs.size,avgWords,longestDesc,
    heatmap,hmMax,yearBars,dow,dowMax,bestMonth,
    moodFlow, longestGap, currentStreak, uniqueLocationChanges };
}

/* ─── animation variants ─── */
const overlayV = {
  hidden:  { opacity:0 },
  visible: { opacity:1, transition:{ duration:0.3 } },
  exit:    { opacity:0, transition:{ duration:0.25 } },
};
const panelV = {
  hidden:  { x:'100%', opacity:0 },
  visible: { x:0, opacity:1, transition:{ type:'spring', damping:28, stiffness:280, mass:0.8 } },
  exit:    { x:'100%', opacity:0, transition:{ type:'spring', damping:32, stiffness:320 } },
};
const containerV = { hidden:{}, visible:{ transition:{ staggerChildren:0.05 } } };
const itemV = {
  hidden:  { opacity:0, y:18 },
  visible: { opacity:1, y:0, transition:{ type:'spring', damping:22, stiffness:250 } },
};

/* ─── sub-components ─── */
function Card({ children, className='' }) {
  return <motion.div variants={itemV} className={`sp-card ${className}`}>{children}</motion.div>;
}

function SectionTitle({ children }) {
  return <div className="sp-section-title">{children}</div>;
}

export default function StatsPanel({ events=[] }) {
  const [open, setOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const stats = useMemo(()=>computeStats(events),[events]);

  return (
    <>
      {/* ── Vertical trigger tab ── */}
      <motion.button
        className="sp-trigger"
        onClick={()=>setOpen(true)}
        whileHover={{ scale:1.04, x:-2 }}
        whileTap={{ scale:0.96 }}
        title="Open Stats"
      >
        <span className="sp-trigger-icon">◎</span>
        <span className="sp-trigger-label">Stats</span>
        {events.length>0 && <span className="sp-trigger-badge">{events.length}</span>}
      </motion.button>

      {/* ── Full-screen panel ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              className="sp-backdrop"
              variants={overlayV}
              initial="hidden" animate="visible" exit="exit"
              onClick={()=>setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              className="sp-panel"
              variants={panelV}
              initial="hidden" animate="visible" exit="exit"
            >
              {/* Header */}
              <div className="sp-header">
                <div className="sp-header-left">
                  <span className="sp-header-icon">◎</span>
                  <div>
                    <h2 className="sp-header-title">Your Memory Stats</h2>
                    <p className="sp-header-sub">{events.length} memories · {stats?.spanDays ? dur(stats.spanDays)+' of journaling' : 'start adding memories'}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {stats && (
                    <motion.button
                      className="sp-export-trigger"
                      onClick={() => setShowExport(true)}
                      whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.1)' }}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        padding: '8px 16px',
                        color: 'white',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span>📥</span> Export PDF
                    </motion.button>
                  )}
                  <motion.button
                    className="sp-close"
                    onClick={()=>setOpen(false)}
                    whileHover={{ scale:1.12, rotate:90 }}
                    whileTap={{ scale:0.9 }}
                  >✕</motion.button>
                </div>
              </div>

              {!stats ? (
                <div className="sp-empty">
                  <span style={{fontSize:'3rem',opacity:0.3}}>◎</span>
                  <p>Add your first memory to see beautiful stats here.</p>
                </div>
              ) : (
                <motion.div className="sp-grid" variants={containerV} initial="hidden" animate="visible">

                  {/* ── Col 1 ── */}
                  <div className="sp-col">

                    {/* Overview */}
                    <Card>
                      <SectionTitle>Overview</SectionTitle>
                      <div className="sp-overview-pills">
                        {[
                          { n:events.length,   l:'Memories',   accent:'var(--accent-gold)' },
                          { n:stats.totalPhotos,l:'Photos',    accent:'var(--accent-rose)' },
                          { n:stats.uniqueLocs, l:'Places',    accent:'var(--accent-sage)' },
                          { n:stats.privateCount,l:'Private',  accent:'var(--accent-indigo)' },
                        ].map(({n,l,accent})=>(
                          <div key={l} className="sp-pill" style={{'--pill-accent':accent}}>
                            <span className="sp-pill-n">{n}</span>
                            <span className="sp-pill-l">{l}</span>
                          </div>
                        ))}
                      </div>
                      <div className="sp-detail-rows">
                        {[
                          ['🗓 Span',           dur(stats.spanDays)],
                          ['⏱ Avg gap',        stats.avgGap>0?dur(stats.avgGap):'—'],
                          ['✍️ Avg words',      stats.avgWords||'—'],
                          ['📷 With photos',    stats.withMedia],
                          ['🏅 Best month',     stats.bestMonth?`${stats.bestMonth[0]} (${stats.bestMonth[1]})`:'—'],
                        ].map(([k,v])=>(
                          <div key={k} className="sp-detail-row">
                            <span>{k}</span><strong>{v}</strong>
                          </div>
                        ))}
                      </div>
                    </Card>

                    {/* Date range */}
                    <Card>
                      <SectionTitle>Date Range</SectionTitle>
                      <div className="sp-date-range">
                        <div className="sp-dr-item"><span className="sp-dr-lbl">First</span><span className="sp-dr-val">{fmt(stats.first)}</span></div>
                        <div className="sp-dr-arrow">→</div>
                        <div className="sp-dr-item"><span className="sp-dr-lbl">Latest</span><span className="sp-dr-val">{fmt(stats.last)}</span></div>
                      </div>
                    </Card>

                    {/* Monthly heatmap */}
                    <Card>
                      <SectionTitle>Monthly Activity (last 12 months)</SectionTitle>
                      <div className="sp-heatmap">
                        {stats.heatmap.map((c,i)=>(
                          <div key={i} className="sp-hm-cell" title={`${c.label} ${c.year}: ${c.count}`}>
                            <div className="sp-hm-fill" style={{opacity:c.count>0?0.15+(c.count/stats.hmMax)*0.85:0}} />
                            <span className="sp-hm-lbl">{c.label.slice(0,1)}</span>
                            {c.count>0 && <span className="sp-hm-cnt">{c.count}</span>}
                          </div>
                        ))}
                      </div>
                      <div className="sp-hm-legend">
                        <span>Less</span>
                        {[0.15,0.4,0.6,0.8,1].map(o=>(
                          <div key={o} style={{width:10,height:10,borderRadius:3,background:'var(--accent-gold)',opacity:o,display:'inline-block'}} />
                        ))}
                        <span>More</span>
                      </div>
                    </Card>

                    {/* Day of week */}
                    <Card>
                      <SectionTitle>Day of Week</SectionTitle>
                      <div className="sp-dow">
                        {stats.dow.map((c,i)=>(
                          <div key={i} className="sp-dow-col">
                            <div className="sp-dow-wrap">
                              <motion.div
                                className="sp-dow-fill"
                                initial={{height:0}}
                                animate={{height:`${Math.max((c/stats.dowMax)*100,c>0?8:2)}%`}}
                                transition={{delay:i*0.06,type:'spring',damping:20}}
                                title={`${c} memories`}
                              />
                            </div>
                            <span className="sp-dow-lbl">{DAYS[i].slice(0,2)}</span>
                            <span className="sp-dow-cnt">{c||''}</span>
                          </div>
                        ))}
                      </div>
                    </Card>

                    {/* Mood Flow chart */}
                    <Card>
                      <SectionTitle>Mood Flow (12 months)</SectionTitle>
                      <div className="sp-mood-flow">
                        <svg viewBox="0 0 360 80" className="sp-mood-flow-svg">
                          {/* Area fills per mood */}
                          {MOODS.map((m, mi) => {
                            const pts = stats.moodFlow.map((row, i) => {
                              const x = (i / 11) * 340 + 10;
                              const maxInMonth = Math.max(row.total, 1);
                              const h = (row[m.value] / maxInMonth) * 50;
                              const baseY = 70 - mi * 4;
                              return `${x},${baseY - h}`;
                            });
                            const basePts = stats.moodFlow.map((_, i) => {
                              const x = (i / 11) * 340 + 10;
                              return `${x},${70 - mi * 4}`;
                            });
                            return (
                              <polygon
                                key={m.value}
                                points={`${pts.join(' ')} ${basePts.reverse().join(' ')}`}
                                fill={m.color}
                                fillOpacity={0.25}
                                stroke={m.color}
                                strokeWidth="1"
                                strokeOpacity={0.5}
                              />
                            );
                          })}
                          {/* Month labels */}
                          {stats.moodFlow.map((row, i) => (
                            <text key={i} x={(i / 11) * 340 + 10} y={78}
                              fontSize="6" fill="var(--text-muted)" textAnchor="middle">
                              {row.label.slice(0, 1)}
                            </text>
                          ))}
                        </svg>
                      </div>
                    </Card>

                    {/* Memory Gap + Streak */}
                    <Card>
                      <SectionTitle>Insights</SectionTitle>
                      <div className="sp-detail-rows">
                        {stats.currentStreak > 0 && (
                          <div className="sp-detail-row">
                            <span>🔥 Current streak</span>
                            <strong>{stats.currentStreak} day{stats.currentStreak > 1 ? 's' : ''}</strong>
                          </div>
                        )}
                        {stats.longestGap.days > 0 && (
                          <div className="sp-detail-row">
                            <span>⏸ Longest gap</span>
                            <strong>{dur(stats.longestGap.days)}</strong>
                          </div>
                        )}
                        {stats.longestGap.from && (
                          <div className="sp-detail-row">
                            <span style={{fontSize:'10px',color:'var(--text-muted)'}}>↳ {fmt(stats.longestGap.from)} → {fmt(stats.longestGap.to)}</span>
                            <strong></strong>
                          </div>
                        )}
                        {stats.uniqueLocationChanges > 0 && (
                          <div className="sp-detail-row">
                            <span>✈️ Location changes</span>
                            <strong>{stats.uniqueLocationChanges}</strong>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>

                  {/* ── Col 2 ── */}
                  <div className="sp-col">

                    {/* Dominant vibe */}
                    {stats.topMood && (
                      <Card>
                        <SectionTitle>Dominant Vibe</SectionTitle>
                        <div className="sp-top-mood">
                          <span className="sp-tm-emoji">{MOODS.find(m=>m.value===stats.topMood[0])?.emoji}</span>
                          <div>
                            <div className="sp-tm-name" style={{color:MOODS.find(m=>m.value===stats.topMood[0])?.color}}>
                              {stats.topMood[0].charAt(0).toUpperCase()+stats.topMood[0].slice(1)}
                            </div>
                            <div className="sp-tm-count">
                              {stats.topMood[1]} memories · {Math.round((stats.topMood[1]/events.length)*100)}% of all
                            </div>
                          </div>
                        </div>
                      </Card>
                    )}

                    {/* Mood breakdown */}
                    <Card>
                      <SectionTitle>Mood Breakdown</SectionTitle>
                      <div className="sp-mood-bars">
                        {MOODS.filter(m=>stats.moodCounts[m.value]>0).map((m,i)=>(
                          <div key={m.value} className="sp-mb-row">
                            <span className="sp-mb-emoji">{m.emoji}</span>
                            <span className="sp-mb-label">{m.label}</span>
                            <div className="sp-mb-track">
                              <motion.div
                                className="sp-mb-fill"
                                style={{background:m.color}}
                                initial={{width:0}}
                                animate={{width:`${(stats.moodCounts[m.value]/events.length)*100}%`}}
                                transition={{delay:i*0.05,type:'spring',damping:22}}
                              />
                            </div>
                            <span className="sp-mb-cnt">{stats.moodCounts[m.value]}</span>
                          </div>
                        ))}
                      </div>
                    </Card>

                    {/* Year bars */}
                    {stats.yearBars.length>0 && (
                      <Card>
                        <SectionTitle>By Year</SectionTitle>
                        <div className="sp-year-bars">
                          {stats.yearBars.map(({year,count,pct},i)=>(
                            <div key={year} className="sp-yb-row">
                              <span className="sp-yb-lbl">{year}</span>
                              <div className="sp-yb-track">
                                <motion.div
                                  className="sp-yb-fill"
                                  initial={{width:0}}
                                  animate={{width:`${pct}%`}}
                                  transition={{delay:i*0.06,type:'spring',damping:22}}
                                />
                              </div>
                              <span className="sp-yb-cnt">{count}</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}

                    {/* People */}
                    {stats.topPeople.length>0 && (
                      <Card>
                        <SectionTitle>👤 People</SectionTitle>
                        <div className="sp-people-list">
                          {stats.topPeople.map(([name,count])=>(
                            <div key={name} className="sp-person-row">
                              <div className="sp-person-avatar">{name.charAt(0).toUpperCase()}</div>
                              <span className="sp-person-name">{name}</span>
                              <div className="sp-person-bar">
                                <div className="sp-person-bar-fill" style={{width:`${(count/stats.topPeople[0][1])*100}%`}} />
                              </div>
                              <span className="sp-person-cnt">{count}×</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}

                    {/* Top tags */}
                    {stats.topTags.length>0 && (
                      <Card>
                        <SectionTitle>Top Tags</SectionTitle>
                        <div className="sp-tag-rows">
                          {stats.topTags.map(([tag,count],i)=>(
                            <div key={tag} className="sp-tag-row">
                              <span className="tag">#{tag}</span>
                              <div className="sp-tag-bar">
                                <motion.div
                                  className="sp-tag-fill"
                                  initial={{width:0}}
                                  animate={{width:`${(count/stats.topTags[0][1])*100}%`}}
                                  transition={{delay:i*0.04,type:'spring',damping:22}}
                                />
                              </div>
                              <span className="sp-tag-cnt">{count}×</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}

                    {/* Longest memory */}
                    {stats.longestDesc?.w>0 && (
                      <Card>
                        <SectionTitle>Most Written</SectionTitle>
                        <div className="sp-longest">
                          <p className="sp-longest-title">"{stats.longestDesc.title}"</p>
                          <span className="sp-longest-wc">{stats.longestDesc.w} words</span>
                        </div>
                      </Card>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExport && stats && (
          <StatsExportModal 
            stats={stats} 
            events={events} 
            onClose={() => setShowExport(false)} 
          />
        )}
      </AnimatePresence>
    </>
  );
}
