/**
 * Protects list fields inside a project from being overwritten by another device.
 *
 * The server merges a project patch at the top level only (`data || patch`), so a list
 * such as dailyLogs is replaced by whatever the sending device had. When two devices add
 * to the same list (or one sends from a stale copy), the other device's items vanished.
 *
 * At commit time we remember which items this device knew about (baseline). Right before
 * sending, the queue reads the server copy and adds back every item that the server has,
 * the patch doesn't, and the baseline didn't know about = added by someone else meanwhile.
 * Items that were in the baseline but left out of the patch were removed on purpose
 * (e.g. a manager deleting a daily log) and stay removed.
 */

type Item = Record<string, any>;

const keyOf: Record<string, (item: Item) => string | undefined> = {
  dailyLogs: (i) => i?.id,
  stuckIncidents: (i) => i?.id,
  qcDefects: (i) => i?.id,
  qcInspections: (i) => i?.id,
  evaluations: (i) => i?.id,
  planAmendments: (i) => i?.id,
  teamTransfers: (i) => i?.id,
  // work sessions have no id: one person starts one session at a given moment
  workSessions: (i) => (i?.startedAt ? `${i.byUserId || ''}@${i.startedAt}` : undefined),
};

export const REBASED_ARRAY_FIELDS = Object.keys(keyOf);

export type ArrayBaseline = Record<string, string[]>;

/** ids of the list items this device had when it made the change (only for lists the patch touches) */
export function captureArrayBaseline(project: Item | undefined, patch: Item | undefined): ArrayBaseline | undefined {
  if (!project || !patch) return undefined;
  const baseline: ArrayBaseline = {};
  for (const field of REBASED_ARRAY_FIELDS) {
    if (!(field in patch) || !Array.isArray(patch[field])) continue;
    const current: Item[] = Array.isArray(project[field]) ? project[field] : [];
    baseline[field] = current.map(keyOf[field]).filter((k): k is string => Boolean(k));
  }
  return Object.keys(baseline).length > 0 ? baseline : undefined;
}

/** the patch with items that other devices added meanwhile put back into its lists */
export function rebasePatchArrays(patch: Item, baseline: ArrayBaseline | undefined, serverData: Item | undefined): Item {
  if (!baseline || !serverData || !patch) return patch;
  let next: Item | null = null;
  for (const [field, baseIds] of Object.entries(baseline)) {
    const keyFn = keyOf[field];
    const patched = patch[field];
    const server = serverData[field];
    if (!keyFn || !Array.isArray(patched) || !Array.isArray(server)) continue;
    const known = new Set<string>(baseIds);
    for (const item of patched) {
      const k = keyFn(item);
      if (k) known.add(k);
    }
    const addedElsewhere = server.filter((item: Item) => {
      const k = keyFn(item);
      return Boolean(k) && !known.has(k as string);
    });
    if (addedElsewhere.length === 0) continue;
    next = next || { ...patch };
    next[field] = [...patched, ...addedElsewhere];
  }
  return next || patch;
}
