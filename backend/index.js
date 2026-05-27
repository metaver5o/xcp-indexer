const express = require('express');
const axios   = require('axios');
const cors    = require('cors');
const Database = require('better-sqlite3');
const path    = require('path');

const XCP_URL          = process.env.XCP_URL          || 'http://localhost:4000';
const PORT             = parseInt(process.env.PORT     || '3002');
const POLL_MS          = parseInt(process.env.POLL_MS  || '60000');   // 1 min between full syncs
const DB_PATH          = process.env.DB_PATH           || path.join(__dirname, 'indexer.db');
const BATCH_SIZE       = parseInt(process.env.BATCH_SIZE || '1000');  // records per page
const CONCURRENT_PAGES = parseInt(process.env.CONCURRENT_PAGES || '5'); // parallel fetches

const app = express();
app.use(cors());
app.use(express.json());

// ─── SQLite schema ────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -32000'); // 32MB cache
db.exec(`
  CREATE TABLE IF NOT EXISTS indexer_state (key TEXT PRIMARY KEY, value TEXT);

  CREATE TABLE IF NOT EXISTS issuances (
    tx_hash        TEXT PRIMARY KEY,
    block_index    INTEGER,
    block_time     INTEGER,
    source         TEXT,
    asset          TEXT,
    asset_longname TEXT,
    quantity       INTEGER,
    divisible      INTEGER,
    description    TEXT,
    mime_type      TEXT,
    inscription    INTEGER DEFAULT 0,
    locked         INTEGER DEFAULT 0,
    reset          INTEGER DEFAULT 0,
    status         TEXT,
    indexed_at     INTEGER
  );

  CREATE TABLE IF NOT EXISTS assets (
    asset          TEXT PRIMARY KEY,
    asset_longname TEXT,
    owner          TEXT,
    supply         INTEGER,
    divisible      INTEGER,
    description    TEXT,
    mime_type      TEXT,
    inscription    INTEGER DEFAULT 0,
    locked         INTEGER DEFAULT 0,
    first_block    INTEGER,
    last_block     INTEGER,
    issuance_count INTEGER DEFAULT 1,
    updated_at     INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_iso_block      ON issuances(block_index);
  CREATE INDEX IF NOT EXISTS idx_iso_source     ON issuances(source);
  CREATE INDEX IF NOT EXISTS idx_iso_asset      ON issuances(asset);
  CREATE INDEX IF NOT EXISTS idx_iso_insc       ON issuances(inscription);
  CREATE INDEX IF NOT EXISTS idx_iso_mime       ON issuances(mime_type);
  CREATE INDEX IF NOT EXISTS idx_asset_owner    ON assets(owner);
  CREATE INDEX IF NOT EXISTS idx_asset_insc     ON assets(inscription);
  CREATE INDEX IF NOT EXISTS idx_asset_block    ON assets(last_block);
`);

// ─── State helpers ────────────────────────────────────────────────────────────
const getState = (k, def = null) => { const r = db.prepare('SELECT value FROM indexer_state WHERE key=?').get(k); return r ? r.value : def; };
const setState = (k, v)          => db.prepare('INSERT OR REPLACE INTO indexer_state(key,value) VALUES(?,?)').run(k, String(v));

// ─── XCP HTTP helpers ─────────────────────────────────────────────────────────
const xcpClient = axios.create({ baseURL: `${XCP_URL}/v2`, timeout: 30000 });

async function xcpGet(path, params = {}) {
  const r = await xcpClient.get(path, { params });
  return r.data;
}

async function getChainInfo() {
  const d = await xcpGet('/');
  // counterparty v9+ returns server_info.counterparty_height or last_block
  const result = d?.result || d;
  return {
    height: result?.counterparty_height
         || result?.last_block?.block_index
         || result?.block_count
         || 0,
    version: result?.version || result?.server_version || '?',
  };
}

// ─── Field normalizer ─────────────────────────────────────────────────────────
// Counterparty v9/v10/v11 all return slightly different shapes.
// Handle top-level fields + nested params/msg_params.
function normalizeIssuance(raw) {
  const p   = raw.params || raw.msg_params || {};
  const m   = { ...p, ...raw }; // raw wins over nested

  const tx_hash        = (m.tx_hash        || '').toLowerCase();
  const block_index    = parseInt(m.block_index    || m.block || 0);
  const block_time     = parseInt(m.block_time     || m.timestamp || 0);
  const source         = m.source          || m.address          || '';
  const asset          = m.asset           || m.asset_name       || '';
  const asset_longname = m.asset_longname  || '';
  const quantity       = parseInt(m.quantity       || m.supply || 0);
  const divisible      = m.divisible   ? 1 : 0;
  const locked         = m.locked      ? 1 : 0;
  const reset          = m.reset       ? 1 : 0;
  const status         = m.status      || 'valid';
  const description    = m.description || '';

  // mime_type: direct field, or inside params
  let mime_type  = m.mime_type || m.content_type || '';

  // inscription: bool, string "true", or integer 1
  let inscription = (m.inscription === true || m.inscription === 1 || m.inscription === 'true') ? 1 : 0;

  // Heuristic: if description is pure hex AND we have a mime_type → inscription
  if (!inscription && mime_type && /^[0-9a-fA-F]+$/.test(description.trim())) {
    inscription = 1;
  }
  // Heuristic: mime/: prefix in description e.g. "image/png:deadbeef..."
  if (!mime_type && description.includes(':')) {
    const before = description.split(':')[0];
    if (before.includes('/') && before.length < 60) {
      mime_type   = before;
      inscription = 1;
    }
  }

  return { tx_hash, block_index, block_time, source, asset, asset_longname,
           quantity, divisible, locked, reset, status, description,
           mime_type, inscription };
}

// ─── Bulk upsert helpers ──────────────────────────────────────────────────────
const stmtIso = db.prepare(`
  INSERT OR REPLACE INTO issuances
    (tx_hash,block_index,block_time,source,asset,asset_longname,
     quantity,divisible,description,mime_type,inscription,locked,reset,status,indexed_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

const stmtAsset = db.prepare(`
  INSERT INTO assets
    (asset,asset_longname,owner,supply,divisible,description,mime_type,
     inscription,locked,first_block,last_block,issuance_count,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?)
  ON CONFLICT(asset) DO UPDATE SET
    owner          = excluded.owner,
    supply         = supply + excluded.supply,
    description    = CASE WHEN excluded.description!='' THEN excluded.description ELSE description END,
    mime_type      = CASE WHEN excluded.mime_type!=''   THEN excluded.mime_type   ELSE mime_type   END,
    inscription    = MAX(inscription, excluded.inscription),
    locked         = MAX(locked,      excluded.locked),
    last_block     = MAX(last_block,  excluded.last_block),
    issuance_count = issuance_count + 1,
    updated_at     = excluded.updated_at
`);

const bulkInsert = db.transaction((rows) => {
  const now = Date.now();
  for (const f of rows) {
    stmtIso.run(f.tx_hash, f.block_index, f.block_time, f.source, f.asset,
      f.asset_longname, f.quantity, f.divisible, f.description,
      f.mime_type, f.inscription, f.locked, f.reset, f.status, now);
    if (f.asset) {
      stmtAsset.run(f.asset, f.asset_longname, f.source, f.quantity,
        f.divisible, f.description, f.mime_type, f.inscription, f.locked,
        f.block_index, f.block_index, now);
    }
  }
});

// ─── Indexer ──────────────────────────────────────────────────────────────────
let syncing   = false;
let syncState = {
  running: false, phase: 'idle',
  tip: 0, totalIssuances: 0,
  indexed: 0, cursor: null,
  error: null, lastSync: null,
  progress: 0,
};

// Fetch one page of /v2/issuances using cursor-based pagination
async function fetchIssuancePage(cursor) {
  const params = { limit: BATCH_SIZE, verbose: true };
  if (cursor) params.cursor = cursor;
  // XCP v2 supports both cursor and offset; cursor is preferred for large sets
  const data = await xcpGet('/issuances', params);
  // result may be array directly or wrapped
  const result     = Array.isArray(data)        ? data        : (data?.result || []);
  const nextCursor = data?.next_cursor          || data?.cursor_id
                  || (result.length === BATCH_SIZE ? result[result.length - 1]?.tx_hash : null);
  return { result, nextCursor };
}

async function syncIssuances() {
  // Get total count first for progress
  try {
    const info = await xcpGet('/issuances', { limit: 1 });
    syncState.totalIssuances = info?.result_count || info?.total || 0;
  } catch (_) {}

  let cursor = getState('last_cursor', null);
  let totalDone = parseInt(getState('total_indexed', '0'));
  syncState.indexed = totalDone;

  // Parallel page fetching
  while (true) {
    // Build CONCURRENT_PAGES worth of cursor requests
    // For first run we go sequentially until we know offsets;
    // use offset-based if node doesn't support cursor
    const params = { limit: BATCH_SIZE, verbose: true };
    if (cursor) params.cursor = cursor;

    let data;
    try {
      data = await xcpGet('/issuances', params);
    } catch (e) {
      // Try offset fallback
      const offset = parseInt(getState('offset', '0'));
      data = await xcpGet('/issuances', { limit: BATCH_SIZE, offset, verbose: true });
      setState('offset', offset + BATCH_SIZE);
    }

    const rows = Array.isArray(data) ? data : (data?.result || []);
    if (!rows.length) break;

    const normalized = rows.map(normalizeIssuance);
    bulkInsert(normalized);

    totalDone += rows.length;
    syncState.indexed = totalDone;
    setState('total_indexed', totalDone);

    // next cursor
    cursor = data?.next_cursor || data?.cursor_id || null;
    if (cursor) setState('last_cursor', cursor);

    if (syncState.totalIssuances > 0) {
      syncState.progress = Math.round((totalDone / syncState.totalIssuances) * 100);
    }

    console.log(`[sync] ${totalDone.toLocaleString()} issuances indexed (cursor: ${cursor || 'end'})`);

    // If server returned fewer than BATCH_SIZE, we're at the end
    if (rows.length < BATCH_SIZE) break;

    // Small yield to avoid hammering
    await new Promise(r => setTimeout(r, 50));
  }
}

async function syncAssets() {
  // Sync assets table from /v2/assets for richer metadata
  let offset = 0;
  const stmtUpsertAsset = db.prepare(`
    INSERT OR REPLACE INTO assets
      (asset,asset_longname,owner,supply,divisible,description,mime_type,
       inscription,locked,first_block,last_block,issuance_count,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const bulkAssets = db.transaction((rows) => {
    for (const a of rows) stmtUpsertAsset.run(
      a.asset, a.asset_longname||'', a.issuer||a.owner||'',
      parseInt(a.supply||0), a.divisible?1:0,
      a.description||'', a.mime_type||'',
      (a.inscription===true||a.inscription===1||a.inscription==='true')?1:0,
      a.locked?1:0,
      parseInt(a.first_issuance_block||a.first_block||0),
      parseInt(a.last_issuance_block||a.last_block||0),
      parseInt(a.issuances_count||a.issuance_count||1),
      Date.now()
    );
  });

  while (true) {
    const data = await xcpGet('/assets', { limit: BATCH_SIZE, offset, verbose: true });
    const rows = Array.isArray(data) ? data : (data?.result || []);
    if (!rows.length) break;
    bulkAssets(rows);
    offset += rows.length;
    console.log(`[sync] ${offset.toLocaleString()} assets synced`);
    if (rows.length < BATCH_SIZE) break;
    await new Promise(r => setTimeout(r, 50));
  }
}

async function runSync() {
  if (syncing) return;
  syncing = true;
  syncState.running = true;
  syncState.lastSync = Date.now();
  syncState.error    = null;

  try {
    const info = await getChainInfo();
    syncState.tip     = info.height;
    syncState.version = info.version;

    // Phase 1: index all issuances (the source of truth for inscriptions)
    syncState.phase = 'issuances';
    await syncIssuances();

    // Phase 2: enrich assets table from /v2/assets endpoint
    syncState.phase = 'assets';
    await syncAssets();

    syncState.phase = 'idle';
    syncState.error = null;
    console.log(`[sync] complete — ${syncState.indexed.toLocaleString()} issuances, tip=${syncState.tip}`);
  } catch (err) {
    syncState.error = err.message;
    console.error('[sync error]', err.message);
  } finally {
    syncing = false;
    syncState.running = false;
  }
}

// ─── REST API ─────────────────────────────────────────────────────────────────

app.get('/api/status', (_req, res) => {
  const issuanceCount   = db.prepare('SELECT COUNT(*) c FROM issuances').get().c;
  const assetCount      = db.prepare('SELECT COUNT(*) c FROM assets').get().c;
  const inscCount       = db.prepare('SELECT COUNT(*) c FROM issuances WHERE inscription=1').get().c;
  const inscAssetCount  = db.prepare('SELECT COUNT(*) c FROM assets   WHERE inscription=1').get().c;
  const mimeBreakdown   = db.prepare(`
    SELECT mime_type, COUNT(*) c FROM issuances
    WHERE inscription=1 AND mime_type!=''
    GROUP BY mime_type ORDER BY c DESC LIMIT 20
  `).all();

  res.json({
    ...syncState,
    stats: { issuanceCount, assetCount, inscCount, inscAssetCount, mimeBreakdown }
  });
});

// Issuances — paginated, filterable
app.get('/api/issuances', (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || '50'), 200);
  const offset = parseInt(req.query.offset || '0');
  const { inscription, mime_type, asset, source } = req.query;

  let where = '1=1', p = [];
  if (inscription !== undefined) { where += ' AND inscription=?'; p.push(inscription === 'true' ? 1 : 0); }
  if (mime_type)  { where += ' AND mime_type LIKE ?'; p.push(`%${mime_type}%`); }
  if (asset)      { where += ' AND asset=?';          p.push(asset.toUpperCase()); }
  if (source)     { where += ' AND source=?';         p.push(source); }

  const rows  = db.prepare(`SELECT tx_hash,block_index,block_time,source,asset,quantity,mime_type,inscription,status FROM issuances WHERE ${where} ORDER BY block_index DESC LIMIT ? OFFSET ?`).all(...p, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) c FROM issuances WHERE ${where}`).all(...p)[0].c;
  res.json({ result: rows, total, offset, limit });
});

// Assets — paginated, filterable
app.get('/api/assets', (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || '50'), 200);
  const offset = parseInt(req.query.offset || '0');
  const { inscription, search, owner } = req.query;

  let where = '1=1', p = [];
  if (inscription !== undefined) { where += ' AND inscription=?'; p.push(inscription === 'true' ? 1 : 0); }
  if (owner)  { where += ' AND owner=?';              p.push(owner); }
  if (search) { where += ' AND (asset LIKE ? OR asset_longname LIKE ? OR owner LIKE ?)'; p.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  const rows  = db.prepare(`SELECT * FROM assets WHERE ${where} ORDER BY last_block DESC LIMIT ? OFFSET ?`).all(...p, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) c FROM assets WHERE ${where}`).all(...p)[0].c;
  res.json({ result: rows, total, offset, limit });
});

// Single asset detail
app.get('/api/assets/:asset', (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE asset=?').get(req.params.asset.toUpperCase());
  if (!asset) return res.status(404).json({ error: 'Not found' });
  const history = db.prepare('SELECT * FROM issuances WHERE asset=? ORDER BY block_index DESC').all(req.params.asset.toUpperCase());
  res.json({ result: { asset, history } });
});

// Single issuance detail (with raw description for content preview)
app.get('/api/issuances/:tx', (req, res) => {
  const iso = db.prepare('SELECT * FROM issuances WHERE tx_hash=?').get(req.params.tx.toLowerCase());
  if (!iso) return res.status(404).json({ error: 'Not found' });
  res.json({ result: iso });
});

// Serve inscription content as raw binary
app.get('/api/content/:tx', (req, res) => {
  const iso = db.prepare('SELECT description, mime_type FROM issuances WHERE tx_hash=?')
    .get(req.params.tx.toLowerCase());
  if (!iso || !iso.description) return res.status(404).send('Not found');

  const desc = iso.description.trim();
  let buf;

  if (/^[0-9a-fA-F]+$/.test(desc) && desc.length % 2 === 0) {
    buf = Buffer.from(desc, 'hex');
  } else if (desc.includes(':')) {
    const colon = desc.indexOf(':');
    const payload = desc.slice(colon + 1).trim();
    if (/^[0-9a-fA-F]+$/.test(payload) && payload.length % 2 === 0) {
      buf = Buffer.from(payload, 'hex');
    }
  }
  if (!buf) {
    try { buf = Buffer.from(desc, 'base64'); } catch (_) {
      return res.status(422).send('Cannot decode content');
    }
  }

  const mime = iso.mime_type || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Length', buf.length);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(buf);
});

// Address summary
app.get('/api/address/:addr', (req, res) => {
  const addr      = req.params.addr;
  const issuances = db.prepare('SELECT tx_hash,block_index,asset,mime_type,inscription,status FROM issuances WHERE source=? ORDER BY block_index DESC LIMIT 200').all(addr);
  const assets    = db.prepare('SELECT * FROM assets WHERE owner=? ORDER BY last_block DESC').all(addr);
  res.json({ result: { address: addr, issuances, assets,
    stats: {
      total: issuances.length,
      inscriptions: issuances.filter(i => i.inscription).length,
      assetCount: assets.length,
    }
  }});
});

// Search
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ result: { type: null } });

  if (/^\d+$/.test(q)) {
    const isos = db.prepare('SELECT tx_hash,block_index,asset,source FROM issuances WHERE block_index=? LIMIT 1').all(parseInt(q));
    if (isos.length) return res.json({ result: { type: 'block', blockIndex: parseInt(q) } });
  }
  if (/^[0-9a-f]{64}$/i.test(q)) {
    const iso = db.prepare('SELECT * FROM issuances WHERE tx_hash=?').get(q.toLowerCase());
    if (iso) return res.json({ result: { type: 'issuance', data: iso } });
  }
  const asset = db.prepare('SELECT * FROM assets WHERE asset=? OR asset_longname=?').get(q.toUpperCase(), q);
  if (asset) return res.json({ result: { type: 'asset', data: asset } });

  if (q.length >= 26 && q.length <= 62) {
    const check = db.prepare('SELECT COUNT(*) c FROM issuances WHERE source=?').get(q);
    if (check.c > 0) return res.json({ result: { type: 'address', address: q } });
  }
  res.json({ result: { type: null } });
});

// Stats: mime-type breakdown for inscriptions
app.get('/api/stats/mime-types', (_req, res) => {
  const rows = db.prepare(`
    SELECT mime_type, COUNT(*) count FROM issuances
    WHERE inscription=1 AND mime_type!=''
    GROUP BY mime_type ORDER BY count DESC
  `).all();
  res.json({ result: rows });
});

// Force re-sync from scratch
app.post('/api/reindex', (_req, res) => {
  db.exec('DELETE FROM issuances; DELETE FROM assets;');
  setState('last_cursor', '');
  setState('offset', '0');
  setState('total_indexed', '0');
  res.json({ ok: true, message: 'Full reindex started' });
  runSync();
});

// Incremental sync (only new records since last run)
app.post('/api/sync', (_req, res) => {
  res.json({ ok: true, message: 'Sync triggered' });
  runSync();
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`XCP-Indexer :${PORT} → ${XCP_URL}`);
  runSync();
  setInterval(runSync, POLL_MS);
});
// NOTE: content endpoint added below via patch - see index.js
