import { describe, expect, it } from 'vitest';
import { resolveWaAkgOperational } from '../functions/_shared/waAkgOperational';

const account = (patch: Record<string, unknown> = {}) => ({
  id: 'wa-account', provider: 'wa_akg', label: 'fabricio', enabled: true,
  connection_status: 'connected', connected_phone_suffix: '1875',
  status_checked_at: '2026-10-12T12:38:13.661Z', updated_at: '2026-10-12T12:38:13.661Z',
  ...patch,
});
const integration = (patch: Record<string, unknown> = {}) => ({
  id: 'wa-integration', key: 'whatsapp_wa_akg:wa-account', provider: 'WA-AKG',
  connected: true, enabled: true, paused: false, last_tested_at: '2026-10-12T12:38:13.661Z',
  last_success_at: '2026-10-12T12:38:13.661Z', ...patch,
});
const controls = (patch: Record<string, unknown> = {}) => ({
  provider: 'wa_akg', inbound_enabled: true, send_enabled: true,
  automation_enabled: true, kill_switch: false, ...patch,
});

describe('WA-AKG operational truth', () => {
  it('marks a connected, policy-approved account as operational', () => {
    expect(resolveWaAkgOperational([account({ integration_id: 'wa-integration' })], [integration()], [controls()])).toMatchObject({
      present: true, connected: true, enabled: true, phoneSuffix: '1875', provider: 'WA-AKG',
    });
  });

  it('does not let a stale Z-API row override a connected WA-AKG account', () => {
    const result = resolveWaAkgOperational(
      [account({ integration_id: 'wa-integration' })],
      [integration(), { key: 'whatsapp', provider: 'Z-API', connected: false, enabled: false, paused: true }],
      [controls()],
    );
    expect(result.enabled).toBe(true);
    expect(result.statusDetail).toContain('WA-AKG conectado');
  });

  it('keeps the channel blocked when the administrative control is missing', () => {
    expect(resolveWaAkgOperational([account({ integration_id: 'wa-integration' })], [integration()], [])).toMatchObject({ connected: true, enabled: false });
  });
});
