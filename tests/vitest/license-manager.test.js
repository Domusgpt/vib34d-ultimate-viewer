import { describe, it, expect, vi } from 'vitest';
import { LicenseManager } from '../../src/product/licensing/LicenseManager.js';

describe('LicenseManager', () => {
  it('returns unregistered status when no license is set', async () => {
    const manager = new LicenseManager({ clock: () => new Date('2025-01-01T00:00:00Z') });
    const status = await manager.validate();

    expect(status.state).toBe('unregistered');
    expect(manager.getValidationHistory()).toHaveLength(1);
  });

  it('validates licenses through registered validators and merges metadata', async () => {
    const validator = vi.fn().mockResolvedValue({ valid: true, metadata: { region: 'EU' } });
    const manager = new LicenseManager({
      validators: [validator],
      clock: () => new Date('2025-06-01T00:00:00Z')
    });

    manager.setLicense({
      key: 'tenant-key',
      tenantId: 'tenant-123',
      features: ['core', 'telemetry'],
      expiresAt: '2025-12-31T00:00:00Z'
    });

    const status = await manager.validate({ environment: 'staging' });

    expect(status.state).toBe('valid');
    expect(status.metadata).toEqual({ region: 'EU' });
    expect(validator).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'tenant-key' }),
      expect.objectContaining({ environment: 'staging' })
    );
  });

  it('flags expired licenses and records history entries', async () => {
    const manager = new LicenseManager({ clock: () => new Date('2025-03-01T00:00:00Z') });
    manager.setLicense({ key: 'expired', expiresAt: '2025-01-01T00:00:00Z' });

    const status = await manager.validate();

    expect(status.state).toBe('expired');
    expect(manager.getValidationHistory()).toHaveLength(1);
    expect(manager.isActive()).toBe(false);
  });

  it('handles validator failures gracefully', async () => {
    const validator = vi.fn().mockImplementation(() => {
      throw new Error('Network error');
    });
    const manager = new LicenseManager({ validators: [validator], clock: () => new Date('2025-04-01T00:00:00Z') });

    manager.setLicense({ key: 'tenant', expiresAt: '2025-12-01T00:00:00Z' });
    const status = await manager.validate();

    expect(status.state).toBe('invalid');
    expect(status.reason).toBe('VALIDATOR_ERROR');
    expect(manager.isActive()).toBe(false);
  });

  it('throws when required features are missing', () => {
    const manager = new LicenseManager();
    manager.setLicense({ key: 'basic', features: ['core'] });

    expect(() => manager.requireFeature('advanced')).toThrow(/required feature/);
  });
});
