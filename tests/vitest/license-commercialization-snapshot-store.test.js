import { describe, it, expect, vi } from 'vitest';
import {
  LicenseCommercializationSnapshotStore,
  createInMemoryCommercializationSnapshotStorage
} from '../../src/product/licensing/LicenseCommercializationSnapshotStore.js';

const baseSummary = {
  packs: [
    { id: 'enterprise', adoptionCount: 3, profileIds: ['enterprise/default'] },
    { id: 'studio', adoptionCount: 0, profileIds: ['studio/core'] }
  ],
  profiles: [
    { id: 'enterprise/default', adoptionCount: 3 },
    { id: 'studio/core', adoptionCount: 0 }
  ],
  segments: {
    enterprise: { profileCount: 1, adoptionCount: 3 },
    studio: { profileCount: 1, adoptionCount: 0 }
  },
  regions: {
    global: { profileCount: 2, adoptionCount: 3 }
  },
  defaultProfileId: 'enterprise/default',
  lastUpdated: '2025-10-20T12:00:00.000Z'
};

describe('LicenseCommercializationSnapshotStore', () => {
  it('computes KPIs when recording snapshots', () => {
    const store = new LicenseCommercializationSnapshotStore();
    const snapshot = store.recordSnapshot(baseSummary, { trigger: 'test' });

    expect(snapshot.kpis.totalPacks).toBe(2);
    expect(snapshot.kpis.totalProfiles).toBe(2);
    expect(snapshot.kpis.totalAdoption).toBe(3);
    expect(snapshot.kpis.activePacks).toBe(1);
    expect(snapshot.kpis.activeProfiles).toBe(1);
    expect(snapshot.kpis.topSegments[0].key).toBe('enterprise');
  });

  it('enforces snapshot limits and persists via storage adapter', () => {
    const storage = createInMemoryCommercializationSnapshotStorage();
    const store = new LicenseCommercializationSnapshotStore({ maxSnapshots: 2, storage });

    store.recordSnapshot(baseSummary, { trigger: 'first' });
    store.recordSnapshot({ ...baseSummary, lastUpdated: '2025-10-20T13:00:00.000Z' }, { trigger: 'second' });
    store.recordSnapshot({ ...baseSummary, lastUpdated: '2025-10-20T14:00:00.000Z' }, { trigger: 'third' });

    const snapshots = store.getSnapshots();
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].context.trigger).toBe('third');
    expect(storage.loadSnapshots()).toHaveLength(2);
  });

  it('generates KPI reports and exports BI payloads', () => {
    const store = new LicenseCommercializationSnapshotStore();

    store.recordSnapshot(baseSummary, { trigger: 'baseline' });
    store.recordSnapshot({
      ...baseSummary,
      profiles: [
        { id: 'enterprise/default', adoptionCount: 5 },
        { id: 'studio/core', adoptionCount: 1 }
      ]
    }, { trigger: 'growth' });

    const report = store.getKpiReport();
    expect(report.latest.kpis.totalAdoption).toBe(6);
    expect(report.deltas.totalAdoption).toBe(3);

    const json = store.exportForBi({ format: 'json', includeSummary: false });
    expect(json).toContain('"snapshotCount"');

    const csv = store.exportForBi({ format: 'csv' });
    expect(csv.split('\n')[1]).toContain('6');
  });

  it('notifies listeners on change', () => {
    const listener = vi.fn();
    const store = new LicenseCommercializationSnapshotStore({ onChange: listener });

    store.recordSnapshot(baseSummary, { trigger: 'listener-test' });
    expect(listener).toHaveBeenCalled();
  });

  it('awaits asynchronous storage hydration and appends snapshots remotely', async () => {
    const loadSnapshots = vi.fn().mockResolvedValue([
      {
        id: 'existing',
        capturedAt: '2025-10-20T08:00:00.000Z',
        context: { trigger: 'hydrated' },
        kpis: { totalPacks: 1 }
      }
    ]);
    const appendSnapshot = vi.fn().mockResolvedValue(undefined);

    const store = new LicenseCommercializationSnapshotStore({
      storage: {
        loadSnapshots,
        appendSnapshot
      }
    });

    await store.whenReady();
    expect(store.getSnapshots()).toHaveLength(1);

    store.recordSnapshot(baseSummary, { trigger: 'async' });
    expect(appendSnapshot).toHaveBeenCalledTimes(1);
  });

  it('propagates clear operations to the storage adapter', () => {
    const clearSnapshots = vi.fn();
    const store = new LicenseCommercializationSnapshotStore({
      storage: { clearSnapshots }
    });

    store.clearSnapshots();
    expect(clearSnapshots).toHaveBeenCalledTimes(1);
  });
});
