import React, { useState, useEffect, useRef } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3002/api';

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg: '#07070d', surface: '#0d0d18', border: '#1a1a2e',
  accent: '#6366f1', accent2: '#8b5cf6', green: '#10b981',
  yellow: '#f59e0b', red: '#ef4444', blue: '#3b82f6',
  text: '#e2e8f0', muted: '#4b5563', mono: 'ui-monospace,SFMono-Regular,monospace',
};

// ─── Shared styles ────────────────────────────────────────────────────────────
const S = {
  root:    { minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'system-ui,-apple-system,sans-serif' },
  nav:     { background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'0 24px', display:'flex', alignItems:'center', gap:'4px', height:'52px', position:'sticky', top:0, zIndex:100 },
  logo:    { fontSize:'1rem', fontWeight:700, background:`linear-gradient(135deg,${C.accent},${C.accent2})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', cursor:'pointer', marginRight:'16px', whiteSpace:'nowrap' },
  navLink: a => ({ color:a?C.accent:C.muted, cursor:'pointer', fontSize:'0.82rem', fontWeight:a?600:400, padding:'6px 10px', borderRadius:'6px', background:a?`${C.accent}15`:'transparent', userSelect:'none' }),
  main:    { maxWidth:'1280px', margin:'0 auto', padding:'28px 20px' },
  card:    { background:C.surface, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'18px', marginBottom:'14px' },
  grid4:   { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'12px', marginBottom:'20px' },
  statCard:{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'18px' },
  statVal: { fontSize:'1.9rem', fontWeight:700, background:`linear-gradient(135deg,${C.accent},${C.accent2})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' },
  statLbl: { fontSize:'0.7rem', color:C.muted, marginTop:'4px', textTransform:'uppercase', letterSpacing:'1px' },
  table:   { width:'100%', borderCollapse:'collapse', fontSize:'0.83rem' },
  th:      { textAlign:'left', padding:'9px 10px', color:C.muted, fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:`1px solid ${C.border}`, background:C.bg },
  td:      { padding:'9px 10px', borderBottom:`1px solid ${C.border}18` },
  hash:    { fontFamily:C.mono, fontSize:'0.76rem', color:C.accent, cursor:'pointer', maxWidth:'130px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'inline-block' },
  badge:   c => ({ background:`${c}18`, color:c, borderRadius:'5px', padding:'2px 7px', fontSize:'0.68rem', fontWeight:600, display:'inline-block', whiteSpace:'nowrap' }),
  input:   { background:'#090912', border:`1px solid ${C.border}`, borderRadius:'7px', padding:'9px 13px', color:C.text, fontSize:'0.88rem', outline:'none', boxSizing:'border-box' },
  btn:     { background:`linear-gradient(135deg,${C.accent},${C.accent2})`, color:'#fff', border:'none', padding:'9px 18px', borderRadius:'7px', fontSize:'0.85rem', cursor:'pointer', fontWeight:500 },
  btnSm:   { background:'transparent', color:C.muted, border:`1px solid ${C.border}`, padding:'5px 12px', borderRadius:'6px', fontSize:'0.76rem', cursor:'pointer' },
  btnTab:  a => ({ background:a?`${C.accent}20`:'transparent', color:a?C.accent:C.muted, border:`1px solid ${a?C.accent:C.border}`, padding:'5px 14px', borderRadius:'6px', fontSize:'0.78rem', cursor:'pointer', fontWeight:a?600:400 }),
  h2:      { fontSize:'1.3rem', fontWeight:600, marginBottom:'18px', display:'flex', alignItems:'center', gap:'10px' },
  sec:     { fontSize:'0.67rem', textTransform:'uppercase', letterSpacing:'2px', color:C.accent, marginBottom:'10px', fontWeight:600 },
  pill:    c => ({ background:`${c}18`, color:c, borderRadius:'20px', padding:'3px 10px', fontSize:'0.72rem', fontWeight:600 }),
  pager:   { display:'flex', gap:'8px', alignItems:'center', marginTop:'14px', justifyContent:'flex-end', fontSize:'0.8rem', color:C.muted },
};

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmt = {
  hash: h => h ? `${h.slice(0,8)}…${h.slice(-6)}` : '—',
  addr: a => a ? `${a.slice(0,10)}…${a.slice(-6)}` : '—',
  num:  n => Number(n||0).toLocaleString(),
  time: t => t ? new Date(t*1000).toLocaleString() : '—',
  date: t => t ? new Date(t*1000).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' }) : '—',
};

async function api(path) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function useApi(path) {
  const [data, setData] = useState(null);
  const [err,  setErr]  = useState(null);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setData(null); setErr(null);
    api(path)
      .then(d  => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, [path]);
  return { data, err };
}

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Hash routing ─────────────────────────────────────────────────────────────
function hashToPage() {
  const hash = window.location.hash.replace(/^#\/?/, '') || '';
  if (!hash) return { name: 'dashboard' };
  const slash = hash.indexOf('/');
  if (slash === -1) return { name: hash };
  return { name: hash.slice(0, slash), id: decodeURIComponent(hash.slice(slash + 1)) };
}

function pageToHash({ name, id }) {
  if (!name || name === 'dashboard') return '#/';
  return id ? `#/${name}/${encodeURIComponent(id)}` : `#/${name}`;
}

// ─── Shared components ────────────────────────────────────────────────────────

function BackButton({ onClick }) {
  return (
    <button style={{ ...S.btnSm, display:'flex', alignItems:'center', gap:'5px', marginBottom:'18px' }}
      onClick={onClick}>
      ← Back
    </button>
  );
}

function LimitSelector({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(Number(e.target.value))}
      style={{ ...S.input, padding:'6px 10px', cursor:'pointer', width:'auto' }}>
      {[50, 100, 500, 1000].map(n => (
        <option key={n} value={n}>{n} rows</option>
      ))}
    </select>
  );
}

function Pagination({ page, total, limit, onPage }) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <div style={S.pager}>
      <span>{fmt.num(total)} total</span>
      <button style={S.btnSm} disabled={page <= 1}     onClick={() => onPage(page - 1)}>← Prev</button>
      <span style={{ color:C.text }}>{page} / {pages}</span>
      <button style={S.btnSm} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button>
    </div>
  );
}

function MimeBadge({ mime }) {
  if (!mime) return <span style={{ color:C.muted, fontSize:'0.72rem' }}>—</span>;
  const cat = mime.split('/')[0];
  const colors = { image:C.green, audio:'#ec4899', video:'#f97316', text:C.blue, application:C.accent2 };
  return <span style={S.badge(colors[cat] || C.muted)}>{mime}</span>;
}

function InscriptionBadge({ v }) {
  return v
    ? <span style={S.badge(C.green)}>inscription</span>
    : <span style={S.badge(C.muted)}>token</span>;
}

function Thumb({ tx, mime }) {
  const imgRef = useRef(null);
  if (!tx || !mime) return null;
  const cat = mime.split('/')[0];
  const url = `${API}/content/${tx}`;
  if (cat === 'image') return (
    <div style={{ width:36, height:36, borderRadius:6, overflow:'hidden', background:C.border, flexShrink:0 }}
      onMouseEnter={() => { if (imgRef.current) imgRef.current.style.transform = 'scale(1.3)'; }}
      onMouseLeave={() => { if (imgRef.current) imgRef.current.style.transform = 'scale(1)'; }}>
      <img ref={imgRef} src={url} alt="" loading="lazy"
        style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', transition:'transform 0.35s ease' }} />
    </div>
  );
  const icons = { audio:'♪', video:'▶', text:'⟨/⟩', application:'⬡' };
  return <span style={{ fontSize:'1.2rem', lineHeight:1 }}>{icons[cat] || '⬡'}</span>;
}

// ─── Gallery card ─────────────────────────────────────────────────────────────
function GalleryCard({ iso, navigate }) {
  const ref    = useRef(null);
  const imgRef = useRef(null);
  const cat = (iso.mime_type || '').split('/')[0];
  const contentUrl = `${API}/content/${iso.tx_hash}`;
  const iconMap = { audio:'♪', video:'▶', text:'⟨/⟩', application:'⬡' };

  const onEnter = () => {
    if (ref.current) {
      ref.current.style.transform   = 'translateY(-3px)';
      ref.current.style.borderColor = C.accent;
      ref.current.style.boxShadow   = `0 8px 24px ${C.accent}20`;
    }
    if (imgRef.current) imgRef.current.style.transform = 'scale(1.1)';
  };
  const onLeave = () => {
    if (ref.current) {
      ref.current.style.transform   = '';
      ref.current.style.borderColor = C.border;
      ref.current.style.boxShadow   = 'none';
    }
    if (imgRef.current) imgRef.current.style.transform = 'scale(1)';
  };

  return (
    <div ref={ref}
      style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
        overflow:'hidden', cursor:'pointer', transition:'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease' }}
      onClick={() => navigate('issuance', iso.tx_hash)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* Square content area */}
      <div style={{ aspectRatio:'1/1', background:'#000', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
        {cat === 'image' ? (
          <img ref={imgRef} src={contentUrl} alt="" loading="lazy"
            style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', transition:'transform 0.35s ease' }} />
        ) : (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:'2.8rem', opacity:0.4 }}>{iconMap[cat] || '⬡'}</span>
            <span style={{ fontSize:'0.68rem', color:C.muted, fontFamily:C.mono }}>{iso.mime_type || 'unknown'}</span>
          </div>
        )}
        <div style={{ position:'absolute', top:8, right:8 }}>
          <MimeBadge mime={iso.mime_type} />
        </div>
      </div>
      {/* Footer */}
      <div style={{ padding:'10px 12px' }}>
        <div style={{ fontFamily:C.mono, fontSize:'0.78rem', color:C.accent2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4 }}>
          {iso.asset}
        </div>
        <div style={{ fontSize:'0.7rem', color:C.text, marginBottom:2 }}
          title={fmt.time(iso.block_time)}>
          {fmt.date(iso.block_time)}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:'0.64rem', color:C.muted }}>Block {fmt.num(iso.block_index)}</span>
          <span style={{ fontFamily:C.mono, fontSize:'0.62rem', color:C.muted }}>{fmt.hash(iso.tx_hash)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Sync banner ──────────────────────────────────────────────────────────────
function SyncBanner({ status, onSync }) {
  if (!status) return null;
  const { running, phase, indexed, totalIssuances, progress, error, tip } = status;
  const pct = progress || (totalIssuances > 0 ? Math.round((indexed / totalIssuances) * 100) : 0);
  const color = error ? C.red : running ? C.yellow : C.green;
  return (
    <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'8px 24px', fontSize:'0.78rem' }}>
      <div style={{ maxWidth:'1280px', margin:'0 auto', display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap' }}>
        <span style={{ display:'flex', alignItems:'center', gap:'6px', whiteSpace:'nowrap' }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:color, display:'inline-block',
                         animation: running ? 'pulse 1.5s infinite' : 'none' }} />
          {running ? `Syncing ${phase}…` : error ? 'Sync error' : 'Synced'}
        </span>
        <span style={{ color:C.muted }}>Tip: <b style={{color:C.text}}>{fmt.num(tip)}</b></span>
        <span style={{ color:C.muted }}>Indexed: <b style={{color:C.text}}>{fmt.num(indexed)}</b>
          {totalIssuances > 0 && <> / {fmt.num(totalIssuances)}</>}
        </span>
        {running && totalIssuances > 0 && (
          <div style={{ flex:1, minWidth:120, maxWidth:300, background:C.border, borderRadius:4, height:4 }}>
            <div style={{ width:`${pct}%`, background:C.accent, borderRadius:4, height:4, transition:'width 0.5s' }} />
          </div>
        )}
        {running && <span style={{ color:C.accent }}>{pct}%</span>}
        {error && <span style={{ color:C.red }}>{error}</span>}
        {!running && <button style={{ ...S.btnSm, marginLeft:'auto' }} onClick={onSync}>↻ Sync now</button>}
      </div>
    </div>
  );
}

// ─── Content viewer ───────────────────────────────────────────────────────────
function TextContent({ url }) {
  const [text, setText] = useState(null);
  useEffect(() => {
    fetch(url).then(r => r.text()).then(setText).catch(() => setText('Failed to load'));
  }, [url]);
  return (
    <pre style={{ fontFamily:C.mono, fontSize:'0.78rem', color:C.text, background:'#000',
      borderRadius:10, padding:16, overflow:'auto', maxHeight:400, whiteSpace:'pre-wrap', wordBreak:'break-all' }}>
      {text || 'Loading…'}
    </pre>
  );
}

function ContentViewer({ tx, mime }) {
  const contentUrl = `${API}/content/${tx}`;
  const cat = (mime || '').split('/')[0];
  const box = { background:'#000', borderRadius:10, overflow:'hidden',
    display:'flex', alignItems:'center', justifyContent:'center', minHeight:200, marginBottom:8 };

  if (!mime) return (
    <div style={{ ...box, color:C.muted, fontSize:'0.82rem' }}>No content / not an inscription</div>
  );
  if (cat === 'image') return (
    <div style={box}>
      <img src={contentUrl} alt={tx}
        style={{ maxWidth:'100%', maxHeight:500, objectFit:'contain', display:'block' }}
        onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
      />
      <div style={{ display:'none', color:C.red, fontSize:'0.8rem' }}>Failed to load image</div>
    </div>
  );
  if (cat === 'audio') return (
    <div style={{ ...box, flexDirection:'column', gap:12, padding:24, background:C.surface }}>
      <div style={{ fontSize:'2rem' }}>♪</div>
      <audio controls style={{ width:'100%', maxWidth:480 }}>
        <source src={contentUrl} type={mime} />
      </audio>
    </div>
  );
  if (cat === 'video') return (
    <div style={box}>
      <video controls style={{ maxWidth:'100%', maxHeight:500 }}>
        <source src={contentUrl} type={mime} />
      </video>
    </div>
  );
  if (mime === 'application/pdf') return (
    <div style={{ ...box, minHeight:500 }}>
      <iframe src={contentUrl} style={{ width:'100%', height:500, border:'none' }} title="PDF" />
    </div>
  );
  if (cat === 'text') return <TextContent url={contentUrl} />;
  return (
    <div style={{ ...box, flexDirection:'column', gap:12, padding:24, background:C.surface }}>
      <div style={{ fontSize:'2rem' }}>⬡</div>
      <div style={{ color:C.muted, fontSize:'0.82rem' }}>{mime}</div>
      <a href={contentUrl} download style={{ ...S.btn, textDecoration:'none', display:'inline-block' }}>
        ⬇ Download
      </a>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ status, navigate }) {
  const stats = status?.stats || {};
  const { data: recentInsc } = useApi('/issuances?inscription=true&limit=10');
  const { data: mimeStats }  = useApi('/stats/mime-types');

  return (
    <div>
      <div style={S.grid4}>
        <div style={S.statCard}>
          <div style={S.statVal}>{fmt.num(stats.issuanceCount)}</div>
          <div style={S.statLbl}>Total Issuances</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statVal}>{fmt.num(stats.assetCount)}</div>
          <div style={S.statLbl}>Assets</div>
        </div>
        <div style={{ ...S.statCard, borderColor:`${C.green}40` }}>
          <div style={{ ...S.statVal, background:`linear-gradient(135deg,${C.green},${C.blue})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            {fmt.num(stats.inscCount)}
          </div>
          <div style={S.statLbl}>Inscriptions</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statVal}>{fmt.num(stats.inscAssetCount)}</div>
          <div style={S.statLbl}>Inscribed Assets</div>
        </div>
      </div>

      {mimeStats?.result?.length > 0 && (
        <div style={S.card}>
          <div style={S.sec}>Inscriptions by MIME type</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
            {mimeStats.result.map(m => (
              <div key={m.mime_type}
                style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer' }}
                onClick={() => navigate('inscriptions', m.mime_type)}>
                <MimeBadge mime={m.mime_type} />
                <span style={{ fontSize:'0.75rem', color:C.muted }}>{fmt.num(m.count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
          <div style={S.sec}>Recent Inscriptions</div>
          <button style={S.btnSm} onClick={() => navigate('inscriptions')}>View all →</button>
        </div>
        {!recentInsc ? <div style={{ color:C.muted }}>Loading…</div> : (
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Asset</th>
              <th style={S.th}>From</th>
              <th style={S.th}>Block</th>
              <th style={S.th}>MIME</th>
            </tr></thead>
            <tbody>
              {recentInsc.result?.map(iso => (
                <tr key={iso.tx_hash} style={{ cursor:'pointer' }}
                  onClick={() => navigate('issuance', iso.tx_hash)}>
                  <td style={S.td}><span style={{ ...S.hash, color:C.accent2, maxWidth:180 }}>{iso.asset}</span></td>
                  <td style={S.td}><span style={S.hash} onClick={e => { e.stopPropagation(); navigate('address', iso.source); }}>{fmt.addr(iso.source)}</span></td>
                  <td style={S.td}><span style={{ color:C.muted }}>{fmt.num(iso.block_index)}</span></td>
                  <td style={S.td}><MimeBadge mime={iso.mime_type} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Inscriptions gallery ─────────────────────────────────────────────────────
function InscriptionsPage({ initialMime, navigate }) {
  const [page,  setPage]  = useState(1);
  const [mime,  setMime]  = useState(initialMime || '');
  const [view,  setView]  = useState('gallery');
  const [limit, setLimit] = useState(50);
  const dMime = useDebounce(mime, 300);

  const mimeParam = dMime ? `&mime_type=${encodeURIComponent(dMime)}` : '';
  const url = `/issuances?inscription=true&limit=${limit}&offset=${(page-1)*limit}${mimeParam}`;
  const { data } = useApi(url);

  const setLimitReset = v => { setLimit(v); setPage(1); };
  const setMimeReset  = v => { setMime(v);  setPage(1); };

  return (
    <div>
      <div style={S.h2}>
        Inscriptions
        {data && <span style={S.pill(C.green)}>{fmt.num(data.total)}</span>}
      </div>

      <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
        <input style={{ ...S.input, maxWidth:220 }} placeholder="Filter MIME type…"
          value={mime} onChange={e => setMimeReset(e.target.value)} />
        <LimitSelector value={limit} onChange={setLimitReset} />
        <div style={{ marginLeft:'auto', display:'flex', gap:'6px' }}>
          <button style={S.btnTab(view === 'gallery')} onClick={() => setView('gallery')}>⊞ Gallery</button>
          <button style={S.btnTab(view === 'table')}   onClick={() => setView('table')}>☰ Table</button>
        </div>
      </div>

      {!data ? (
        <div style={{ color:C.muted, textAlign:'center', padding:'60px 0' }}>Loading…</div>
      ) : view === 'gallery' ? (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'14px', marginBottom:'16px' }}>
            {data.result?.map(iso => (
              <GalleryCard key={iso.tx_hash} iso={iso} navigate={navigate} />
            ))}
          </div>
          <Pagination page={page} total={data.total} limit={limit} onPage={setPage} />
        </div>
      ) : (
        <div style={S.card}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}></th>
              <th style={S.th}>Asset</th>
              <th style={S.th}>From</th>
              <th style={S.th}>Date</th>
              <th style={S.th}>Block</th>
              <th style={S.th}>MIME</th>
            </tr></thead>
            <tbody>
              {data.result?.map(iso => (
                <tr key={iso.tx_hash} style={{ cursor:'pointer' }}
                  onClick={() => navigate('issuance', iso.tx_hash)}>
                  <td style={{ ...S.td, width:44 }}>
                    <Thumb tx={iso.tx_hash} mime={iso.mime_type} />
                  </td>
                  <td style={S.td}>
                    <span style={{ ...S.hash, color:C.accent2, maxWidth:180 }}
                      onClick={e => { e.stopPropagation(); navigate('asset', iso.asset); }}>
                      {iso.asset}
                    </span>
                  </td>
                  <td style={S.td}>
                    <span style={S.hash}
                      onClick={e => { e.stopPropagation(); navigate('address', iso.source); }}>
                      {fmt.addr(iso.source)}
                    </span>
                  </td>
                  <td style={S.td} title={fmt.time(iso.block_time)}>
                    <span style={{ color:C.text, fontSize:'0.78rem' }}>{fmt.date(iso.block_time)}</span>
                  </td>
                  <td style={S.td}><span style={{ color:C.muted }}>{fmt.num(iso.block_index)}</span></td>
                  <td style={S.td}><MimeBadge mime={iso.mime_type} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={data.total} limit={limit} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

// ─── Issuances page ───────────────────────────────────────────────────────────
function IssuancesPage({ navigate }) {
  const [page,   setPage]   = useState(1);
  const [tab,    setTab]    = useState('all');
  const [mime,   setMime]   = useState('');
  const [search, setSearch] = useState('');
  const [limit,  setLimit]  = useState(50);
  const dMime   = useDebounce(mime,   300);
  const dSearch = useDebounce(search, 300);

  const inscParam = tab === 'inscriptions' ? '&inscription=true' : tab === 'tokens' ? '&inscription=false' : '';
  const mimeParam = dMime   ? `&mime_type=${encodeURIComponent(dMime)}`   : '';
  const srcParam  = dSearch ? `&source=${encodeURIComponent(dSearch)}`    : '';
  const url = `/issuances?limit=${limit}&offset=${(page-1)*limit}${inscParam}${mimeParam}${srcParam}`;
  const { data } = useApi(url);

  const switchTab = t => { setTab(t); setPage(1); };

  return (
    <div>
      <div style={S.h2}>
        Issuances
        {data && <span style={S.pill(C.muted)}>{fmt.num(data.total)}</span>}
      </div>
      <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap', alignItems:'center' }}>
        {['all', 'inscriptions', 'tokens'].map(t => (
          <button key={t} style={S.btnTab(tab === t)} onClick={() => switchTab(t)}>{t}</button>
        ))}
        <input style={{ ...S.input, maxWidth:200 }} placeholder="Filter MIME type…"
          value={mime} onChange={e => { setMime(e.target.value); setPage(1); }} />
        <input style={{ ...S.input, maxWidth:260 }} placeholder="Filter by address…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <LimitSelector value={limit} onChange={v => { setLimit(v); setPage(1); }} />
      </div>
      <div style={S.card}>
        {!data ? <div style={{ color:C.muted }}>Loading…</div> : (
          <>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}></th>
                <th style={S.th}>Asset</th>
                <th style={S.th}>From</th>
                <th style={S.th}>Date</th>
                <th style={S.th}>Block</th>
                <th style={S.th}>MIME</th>
                <th style={S.th}>Type</th>
              </tr></thead>
              <tbody>
                {data.result?.map(iso => (
                  <tr key={iso.tx_hash} style={{ cursor:'pointer' }}
                    onClick={() => navigate('issuance', iso.tx_hash)}>
                    <td style={{ ...S.td, width:44 }}>
                      {iso.inscription ? <Thumb tx={iso.tx_hash} mime={iso.mime_type} /> : null}
                    </td>
                    <td style={S.td}>
                      <span style={{ ...S.hash, color:C.accent2, maxWidth:180 }}
                        onClick={e => { e.stopPropagation(); navigate('asset', iso.asset); }}>
                        {iso.asset}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={S.hash}
                        onClick={e => { e.stopPropagation(); navigate('address', iso.source); }}>
                        {fmt.addr(iso.source)}
                      </span>
                    </td>
                    <td style={S.td} title={fmt.time(iso.block_time)}>
                      <span style={{ color:C.text, fontSize:'0.78rem' }}>{fmt.date(iso.block_time)}</span>
                    </td>
                    <td style={S.td}><span style={{ color:C.muted }}>{fmt.num(iso.block_index)}</span></td>
                    <td style={S.td}><MimeBadge mime={iso.mime_type} /></td>
                    <td style={S.td}><InscriptionBadge v={iso.inscription} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={data.total} limit={limit} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Assets page ──────────────────────────────────────────────────────────────
function AssetsPage({ navigate }) {
  const [page,   setPage]   = useState(1);
  const [tab,    setTab]    = useState('all');
  const [search, setSearch] = useState('');
  const [limit,  setLimit]  = useState(50);
  const dSearch = useDebounce(search, 300);

  const inscParam = tab === 'inscriptions' ? '&inscription=true' : tab === 'tokens' ? '&inscription=false' : '';
  const srchParam = dSearch ? `&search=${encodeURIComponent(dSearch)}` : '';
  const url = `/assets?limit=${limit}&offset=${(page-1)*limit}${inscParam}${srchParam}`;
  const { data } = useApi(url);

  return (
    <div>
      <div style={S.h2}>
        Assets {data && <span style={S.pill(C.muted)}>{fmt.num(data.total)}</span>}
      </div>
      <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap', alignItems:'center' }}>
        {['all', 'inscriptions', 'tokens'].map(t => (
          <button key={t} style={S.btnTab(tab === t)} onClick={() => { setTab(t); setPage(1); }}>{t}</button>
        ))}
        <input style={{ ...S.input, maxWidth:300 }} placeholder="Search asset name or address…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <LimitSelector value={limit} onChange={v => { setLimit(v); setPage(1); }} />
      </div>
      <div style={S.card}>
        {!data ? <div style={{ color:C.muted }}>Loading…</div> : (
          <>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Asset</th>
                <th style={S.th}>Owner</th>
                <th style={S.th}>Supply</th>
                <th style={S.th}>MIME</th>
                <th style={S.th}>Last Block</th>
                <th style={S.th}>Type</th>
              </tr></thead>
              <tbody>
                {data.result?.map(a => (
                  <tr key={a.asset} style={{ cursor:'pointer' }}
                    onClick={() => navigate('asset', a.asset)}>
                    <td style={S.td}>
                      <span style={{ ...S.hash, color:C.accent2, maxWidth:200 }}>
                        {a.asset}
                        {a.asset_longname && <span style={{ color:C.muted, fontSize:'0.7rem' }}> ({a.asset_longname})</span>}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={S.hash}
                        onClick={e => { e.stopPropagation(); navigate('address', a.owner); }}>
                        {fmt.addr(a.owner)}
                      </span>
                    </td>
                    <td style={S.td}>{fmt.num(a.supply)}</td>
                    <td style={S.td}><MimeBadge mime={a.mime_type} /></td>
                    <td style={S.td}><span style={{ color:C.muted }}>{fmt.num(a.last_block)}</span></td>
                    <td style={S.td}><InscriptionBadge v={a.inscription} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={data.total} limit={limit} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Issuance detail ──────────────────────────────────────────────────────────
function IssuanceDetail({ tx, navigate, goBack }) {
  const { data } = useApi(`/issuances/${tx}`);
  if (!data) return <div style={{ color:C.muted }}>Loading…</div>;
  const iso = data.result;
  return (
    <div>
      <BackButton onClick={goBack} />
      <div style={S.h2}>
        {iso.inscription ? '⬡ Inscription' : '◈ Issuance'}
        <span style={{ fontFamily:C.mono, fontSize:'0.85rem', color:C.muted, fontWeight:400 }}>{fmt.hash(iso.tx_hash)}</span>
      </div>

      {iso.inscription === 1 && (
        <div style={S.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={S.sec}>Content</div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <MimeBadge mime={iso.mime_type} />
              <a href={`${API}/content/${iso.tx_hash}`} download
                style={{ ...S.btnSm, textDecoration:'none', display:'inline-block' }}>⬇ Download</a>
            </div>
          </div>
          <ContentViewer tx={iso.tx_hash} mime={iso.mime_type} />
        </div>
      )}

      <div style={S.card}>
        <div style={S.sec}>Details</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', fontSize:'0.83rem' }}>
          {[
            ['Asset',    <span style={{ ...S.hash, color:C.accent2, maxWidth:240, cursor:'pointer' }} onClick={() => navigate('asset', iso.asset)}>{iso.asset}</span>],
            ['Type',     <InscriptionBadge v={iso.inscription} />],
            ['Source',   <span style={{ ...S.hash, maxWidth:240, cursor:'pointer' }} onClick={() => navigate('address', iso.source)}>{iso.source}</span>],
            ['Status',   <span style={S.badge(iso.status==='valid'?C.green:C.red)}>{iso.status}</span>],
            ['Block',    fmt.num(iso.block_index)],
            ['Quantity', fmt.num(iso.quantity)],
            ['MIME',     <MimeBadge mime={iso.mime_type} />],
          ].map(([k, v]) => (
            <div key={k}><span style={{ color:C.muted, marginRight:6 }}>{k}:</span>{v}</div>
          ))}
          <div style={{ gridColumn:'1/-1' }}>
            <span style={{ color:C.muted }}>Tx: </span>
            <span style={{ fontFamily:C.mono, fontSize:'0.72rem', wordBreak:'break-all' }}>{iso.tx_hash}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Asset detail ─────────────────────────────────────────────────────────────
function AssetDetail({ asset, navigate, goBack }) {
  const { data } = useApi(`/assets/${encodeURIComponent(asset)}`);
  if (!data) return <div style={{ color:C.muted }}>Loading…</div>;
  const { asset: a, history } = data.result;
  return (
    <div>
      <BackButton onClick={goBack} />
      <div style={S.h2}>
        {a.asset}
        {a.inscription
          ? <span style={S.badge(C.green)}>inscription</span>
          : <span style={S.badge(C.muted)}>token</span>}
      </div>
      {a.asset_longname && (
        <div style={{ color:C.muted, marginBottom:16, fontSize:'0.85rem' }}>{a.asset_longname}</div>
      )}
      <div style={S.card}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', fontSize:'0.83rem' }}>
          {[
            ['Owner',       <span style={{ ...S.hash, cursor:'pointer' }} onClick={() => navigate('address', a.owner)}>{a.owner}</span>],
            ['Supply',      fmt.num(a.supply)],
            ['MIME Type',   <MimeBadge mime={a.mime_type} />],
            ['First Block', fmt.num(a.first_block)],
            ['Last Block',  fmt.num(a.last_block)],
            ['Issuances',   fmt.num(a.issuance_count)],
          ].map(([k, v]) => (
            <div key={k}><span style={{ color:C.muted }}>{k}: </span>{v}</div>
          ))}
          {a.description && (
            <div style={{ gridColumn:'1/-1' }}>
              <span style={{ color:C.muted }}>Description: </span>
              <span style={{ fontFamily:C.mono, fontSize:'0.72rem', wordBreak:'break-all' }}>
                {a.description.slice(0, 200)}{a.description.length > 200 ? '…' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
      <div style={S.card}>
        <div style={S.sec}>Issuance History</div>
        <table style={S.table}>
          <thead><tr>
            <th style={S.th}>Tx</th>
            <th style={S.th}>Block</th>
            <th style={S.th}>Qty</th>
            <th style={S.th}>Status</th>
          </tr></thead>
          <tbody>
            {history.map(h => (
              <tr key={h.tx_hash} style={{ cursor:'pointer' }}
                onClick={() => navigate('issuance', h.tx_hash)}>
                <td style={S.td}><span style={S.hash}>{fmt.hash(h.tx_hash)}</span></td>
                <td style={S.td}>{fmt.num(h.block_index)}</td>
                <td style={S.td}>{fmt.num(h.quantity)}</td>
                <td style={S.td}><span style={S.badge(h.status==='valid'?C.green:C.red)}>{h.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Address page ─────────────────────────────────────────────────────────────
function AddressPage({ addr, navigate, goBack }) {
  const { data } = useApi(`/address/${addr}`);
  if (!data) return <div style={{ color:C.muted }}>Loading…</div>;
  const { address, issuances, assets, stats } = data.result;
  return (
    <div>
      <BackButton onClick={goBack} />
      <div style={S.h2}>Address</div>
      <div style={S.card}>
        <div style={{ fontFamily:C.mono, fontSize:'0.83rem', wordBreak:'break-all', marginBottom:8 }}>{address}</div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <span style={S.pill(C.muted)}>Issuances: {fmt.num(stats?.total)}</span>
          <span style={S.pill(C.green)}>Inscriptions: {fmt.num(stats?.inscriptions)}</span>
          <span style={S.pill(C.accent)}>Assets: {fmt.num(stats?.assetCount)}</span>
        </div>
      </div>
      {assets.length > 0 && (
        <div style={S.card}>
          <div style={S.sec}>Assets Owned ({assets.length})</div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Asset</th>
              <th style={S.th}>Supply</th>
              <th style={S.th}>MIME</th>
              <th style={S.th}>Type</th>
            </tr></thead>
            <tbody>
              {assets.map(a => (
                <tr key={a.asset} style={{ cursor:'pointer' }} onClick={() => navigate('asset', a.asset)}>
                  <td style={S.td}><span style={{ ...S.hash, color:C.accent2, maxWidth:200 }}>{a.asset}</span></td>
                  <td style={S.td}>{fmt.num(a.supply)}</td>
                  <td style={S.td}><MimeBadge mime={a.mime_type} /></td>
                  <td style={S.td}><InscriptionBadge v={a.inscription} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {issuances.length > 0 && (
        <div style={S.card}>
          <div style={S.sec}>Issuance History</div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Asset</th>
              <th style={S.th}>Block</th>
              <th style={S.th}>MIME</th>
              <th style={S.th}>Type</th>
            </tr></thead>
            <tbody>
              {issuances.map(iso => (
                <tr key={iso.tx_hash} style={{ cursor:'pointer' }}
                  onClick={() => navigate('issuance', iso.tx_hash)}>
                  <td style={S.td}><span style={{ ...S.hash, color:C.accent2, maxWidth:200 }}>{iso.asset}</span></td>
                  <td style={S.td}><span style={{ color:C.muted }}>{fmt.num(iso.block_index)}</span></td>
                  <td style={S.td}><MimeBadge mime={iso.mime_type} /></td>
                  <td style={S.td}><InscriptionBadge v={iso.inscription} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Search bar ───────────────────────────────────────────────────────────────
function SearchBar({ navigate }) {
  const [q,    setQ]    = useState('');
  const [busy, setBusy] = useState(false);
  const [miss, setMiss] = useState(false);

  const go = async () => {
    if (!q.trim()) return;
    setBusy(true); setMiss(false);
    try {
      const d = await api(`/search?q=${encodeURIComponent(q.trim())}`);
      const r = d.result;
      if (!r.type) { setMiss(true); return; }
      if      (r.type === 'block')    navigate('issuances');
      else if (r.type === 'asset')    navigate('asset',    r.data.asset);
      else if (r.type === 'address')  navigate('address',  r.address);
      else if (r.type === 'issuance') navigate('issuance', r.data.tx_hash);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ flex:1, maxWidth:460, display:'flex', gap:'6px', alignItems:'center' }}>
      <input style={{ ...S.input, flex:1 }}
        placeholder="Block, tx hash, asset, address…"
        value={q}
        onChange={e => { setQ(e.target.value); setMiss(false); }}
        onKeyDown={e => e.key === 'Enter' && go()}
      />
      <button style={S.btn} onClick={go} disabled={busy}>{busy ? '…' : '⌕'}</button>
      {miss && <span style={{ color:C.red, fontSize:'0.75rem', whiteSpace:'nowrap' }}>Not found</span>}
    </div>
  );
}

// ─── Root app ─────────────────────────────────────────────────────────────────
const NAV = [
  { key:'dashboard',    label:'Dashboard'    },
  { key:'inscriptions', label:'Inscriptions' },
  { key:'issuances',    label:'Issuances'    },
  { key:'assets',       label:'Assets'       },
];

export default function App() {
  const [page,   setPage]   = useState(hashToPage);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const onPop = () => setPage(hashToPage());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const load = () => api('/status').then(setStatus).catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  const navigate = (name, id) => {
    const next = { name, id };
    setPage(next);
    window.history.pushState(null, '', pageToHash(next));
  };

  const goBack = () => window.history.back();

  const triggerSync = () =>
    fetch(`${API}/sync`, { method:'POST' }).then(() => api('/status').then(setStatus));

  const render = () => {
    switch (page.name) {
      case 'dashboard':    return <Dashboard status={status} navigate={navigate} />;
      case 'inscriptions': return <InscriptionsPage initialMime={page.id} navigate={navigate} />;
      case 'issuances':    return <IssuancesPage navigate={navigate} />;
      case 'assets':       return <AssetsPage navigate={navigate} />;
      case 'issuance':     return <IssuanceDetail tx={page.id}    navigate={navigate} goBack={goBack} />;
      case 'asset':        return <AssetDetail    asset={page.id} navigate={navigate} goBack={goBack} />;
      case 'address':      return <AddressPage    addr={page.id}  navigate={navigate} goBack={goBack} />;
      default:             return <Dashboard status={status} navigate={navigate} />;
    }
  };

  return (
    <div style={S.root}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:${C.bg}; }
        ::-webkit-scrollbar-thumb { background:${C.border}; border-radius:3px; }
        select option { background:${C.surface}; color:${C.text}; }
      `}</style>
      <nav style={S.nav}>
        <span style={S.logo} onClick={() => navigate('dashboard')}>⬡ XCP</span>
        {NAV.map(n => (
          <span key={n.key} style={S.navLink(page.name === n.key)}
            onClick={() => navigate(n.key)}>
            {n.label}
          </span>
        ))}
        <div style={{ marginLeft:'auto' }}>
          <SearchBar navigate={navigate} />
        </div>
      </nav>
      <SyncBanner status={status} onSync={triggerSync} />
      <main style={S.main}>{render()}</main>
    </div>
  );
}
