// An in-memory stand-in for the `db` capability (the subset the Studio uses),
// for tests and screenshots. Records every write so tests can check the
// one-write-in-flight rule. Not part of the published page.

export function createFakeDb(seed = {}, { latency = 0 } = {}) {
  const docs = new Map(Object.entries(seed));           // "collection/id" -> body
  const listeners = new Set();
  const log = [];
  let inflight = 0, maxInflight = 0;
  const wait = () => new Promise(r => setTimeout(r, latency));
  const snapDoc = (path) => ({ id: path.split('/').pop(), exists: docs.has(path), data: () => docs.get(path), metadata: { fromCache: false, hasPendingWrites: false } });
  const notify = () => { for (const l of listeners) l(); };

  const merge = (a, b) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && a?.[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? merge(a[k], v) : v;
    return out;
  };

  const docRef = path => ({
    id: path.split('/').pop(), path,
    async get() { return snapDoc(path); },
    async set(body) {
      inflight++; maxInflight = Math.max(maxInflight, inflight); log.push({ op: 'set', path, body: structuredClone(body) });
      await wait(); docs.set(path, structuredClone(body)); inflight--; notify();
    },
    async update(body) {
      inflight++; maxInflight = Math.max(maxInflight, inflight); log.push({ op: 'update', path, body: structuredClone(body) });
      await wait();
      if (!docs.has(path)) { inflight--; throw { code: 'invalid_argument', message: 'no such document' }; }
      docs.set(path, merge(docs.get(path), structuredClone(body))); inflight--; notify();
    },
    async delete() { docs.delete(path); notify(); },
    onSnapshot(next) {
      const fire = () => next(snapDoc(path));
      listeners.add(fire); setTimeout(fire, 0);
      return () => listeners.delete(fire);
    },
  });

  const collRef = name => ({
    path: name,
    doc: id => docRef(`${name}/${id}`),
    onSnapshot(next) {
      const fire = () => {
        const list = [...docs.keys()].filter(k => k.startsWith(name + '/') && k.split('/').length === 2).sort()
          .map(k => snapDoc(k));
        next({ docs: list, size: list.length, empty: !list.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } });
      };
      listeners.add(fire); setTimeout(fire, 0);
      return () => listeners.delete(fire);
    },
  });

  return {
    db: { doc: docRef, collection: collRef },
    docs, log,
    get maxInflight() { return maxInflight; },
  };
}
