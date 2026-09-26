// The database adapter. Subscribes once per path, and saves through one queue
// per document: at most one write in flight, later changes coalesced into the
// next write, text edits debounced, decisions sent at once. The page writes
// only `decisions` and `glossaryDecisions`.

export const SAVE_DEBOUNCE_MS = 700;

export function createSync(db, { onCollection, onUnit, onSaveState, onFatal, schedule = setTimeout, cancel = clearTimeout }) {
  const unsubs = [];
  let unitUnsub = null, unitPath = '';
  const queues = new Map();   // path -> {want, saved, inflight, timer, exists}
  let lastState = 'idle';

  const fatal = e => {
    if (['revoked', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e?.code)) onFatal(e);
  };

  for (const name of ['meta', 'glossary', 'decisions', 'glossaryDecisions', 'receipts']) {
    unsubs.push(db.collection(name).onSnapshot(snap => {
      const docs = new Map();
      for (const d of snap.docs) if (d.exists) docs.set(d.id, d.data());
      for (const [path, q] of queues) if (path.startsWith(name + '/')) q.exists = q.exists || docs.has(path.slice(name.length + 1));
      onCollection(name, docs, snap.metadata);
    }, fatal));
  }

  function watchUnit(id) {
    const path = 'units/' + id;
    if (path === unitPath) return;
    if (unitUnsub) unitUnsub();
    unitPath = path;
    unitUnsub = db.doc(path).onSnapshot(snap => onUnit(id, snap.exists ? snap.data() : null), fatal);
  }

  function report() {
    let state = 'saved';
    for (const q of queues.values()) {
      if (q.error) { state = 'error'; break; }
      if (q.inflight || q.timer || q.want !== q.saved) state = 'saving';
    }
    if (!queues.size) state = 'idle';
    if (state !== lastState) { lastState = state; onSaveState(state); }
  }

  function patchFor(q) {
    // First write: the whole document. After that: top-level fields plus only the changed sections.
    if (!q.exists || !q.saved) return { op: 'set', body: q.want };
    const body = {};
    for (const [k, v] of Object.entries(q.want)) {
      if (k === 'sections' && v && typeof v === 'object') {
        const changed = {};
        for (const [part, sec] of Object.entries(v)) if (JSON.stringify(sec) !== JSON.stringify(q.saved.sections?.[part])) changed[part] = sec;
        if (Object.keys(changed).length) body.sections = changed;
      } else if (JSON.stringify(v) !== JSON.stringify(q.saved[k])) body[k] = v;
    }
    return { op: 'update', body };
  }

  async function flush(path) {
    const q = queues.get(path);
    if (!q || q.inflight || q.want === q.saved) return report();
    if (q.timer) { cancel(q.timer); q.timer = null; }
    const want = q.want;
    const { op, body } = patchFor(q);
    q.inflight = true; q.error = null; report();
    try {
      if (op === 'update' && !Object.keys(body).length) { /* nothing changed */ }
      else if (op === 'set') await db.doc(path).set(body);
      else await db.doc(path).update(body);
      q.saved = want; q.exists = true;
    } catch (e) {
      if (e?.code === 'invalid_argument' && op === 'update') {
        // The document is gone (or never existed): write it whole next time.
        q.exists = false;
      } else if (e?.code === 'unavailable' && !q.retried) {
        q.retried = true;
        q.inflight = false;
        q.timer = schedule(() => { q.timer = null; flush(path); }, 1000 + Math.random() * 2000);
        return report();
      } else {
        q.error = e || { code: 'unavailable' };
        fatal(e);
      }
    }
    q.inflight = false; q.retried = false;
    if (q.want !== q.saved && !q.error) return flush(path);
    report();
  }

  /** Queue the latest version of a document. immediate: decisions and sends, no debounce. */
  function save(path, doc, { immediate = false } = {}) {
    const q = queues.get(path) || { want: null, saved: null, inflight: false, timer: null, exists: false };
    queues.set(path, q);
    q.want = doc; q.error = null;
    if (q.timer) { cancel(q.timer); q.timer = null; }
    if (immediate) flush(path);
    else { q.timer = schedule(() => { q.timer = null; flush(path); }, SAVE_DEBOUNCE_MS); report(); }
  }

  /** Is a local change to this document not yet confirmed? (Then snapshots must not overwrite it.) */
  const dirty = path => { const q = queues.get(path); return !!q && (q.inflight || !!q.timer || q.want !== q.saved); };

  const retry = () => { for (const [path, q] of queues) if (q.error) { q.error = null; flush(path); } };
  const flushAll = () => { for (const path of queues.keys()) flush(path); };
  const stop = () => { unsubs.forEach(u => u()); if (unitUnsub) unitUnsub(); };

  return { watchUnit, save, dirty, retry, flushAll, stop };
}
