import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionContext } from '@/lib/sessionContext';
import {
  DEFAULT_ANA_EXISTING_LEAD_WORK_SETTINGS,
  getAnaExistingLeadWorkRequestState,
  getAnaExistingLeadWork,
  requestAnaExistingLeadWork,
  runAnaOperationNow,
  saveAnaExistingLeadWork,
  setAnaAutomaticOperation,
} from './anaOperationRepository';
const mock = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: mock.invoke } } }));
beforeEach(() => { mock.invoke.mockReset(); sessionContext.replace('synthetic-user','synthetic-org'); });
describe('Ana operation transport R11', () => {
  it('surfaces the structured location error from a non-2xx response, without consuming/retrying it', async () => {
    const response = new Response(JSON.stringify({ok:false,error:'operation_city_required'}),{status:400});
    mock.invoke.mockResolvedValue({data:null,error:{message:'Edge Function returned a non-2xx status code',context:response}});
    await expect(setAnaAutomaticOperation(true)).rejects.toThrow('operation_city_required');
    expect(response.bodyUsed).toBe(false);expect(mock.invoke).toHaveBeenCalledTimes(1);
  });
  it('does not fabricate a confirmed result after network failure', async () => {
    mock.invoke.mockRejectedValue(new Error('Failed to fetch'));
    await expect(runAnaOperationNow()).rejects.toThrow('Failed to fetch');expect(mock.invoke).toHaveBeenCalledTimes(1);
  });
  it('discards a response after the user/org context changes', async () => {
    mock.invoke.mockImplementation(async()=>{sessionContext.replace('other','other');return {data:{ok:true,run:{status:'queued'}},error:null};});
    await expect(runAnaOperationNow()).rejects.toThrow('session_context_changed');
  });
  it('uses a separate aggregate-only transport for existing-lead work', async () => {
    const settings = { enabled: false, mode: 'review_only' as const, batchLimit: 10 };
    mock.invoke.mockResolvedValue({ data: { ok: true, settings, nextRunAt: null, eligibleCount: 0, queuedCount: 0, latestBatch: null }, error: null });

    await getAnaExistingLeadWork();
    expect(mock.invoke).toHaveBeenLastCalledWith('ana-operations', { body: { action: 'get_existing_lead_work' } });

    await saveAnaExistingLeadWork(settings);
    expect(mock.invoke).toHaveBeenLastCalledWith('ana-operations', { body: { action: 'save_existing_lead_work_policy', settings } });

    await requestAnaExistingLeadWork();
    expect(mock.invoke).toHaveBeenLastCalledWith('ana-operations', { body: { action: 'request_existing_lead_work' } });
    expect(mock.invoke.mock.calls).toHaveLength(3);
  });
  it('keeps existing-lead work disabled and review-only unless the server-side flow says otherwise', () => {
    expect(DEFAULT_ANA_EXISTING_LEAD_WORK_SETTINGS).toEqual({ enabled: false, mode: 'review_only', batchLimit: 10 });
    expect(getAnaExistingLeadWorkRequestState({ enabled: false, mode: 'review_only', batchLimit: 10 })).toBe('disabled');
    expect(getAnaExistingLeadWorkRequestState({ enabled: true, mode: 'review_only', batchLimit: 10 })).toBe('review_ready');
    expect(getAnaExistingLeadWorkRequestState({ enabled: true, mode: 'approved_followup', batchLimit: 10 })).toBe('blocked');
  });
});
