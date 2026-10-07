import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionContext } from '@/lib/sessionContext';
import { runAnaOperationNow, setAnaAutomaticOperation } from './anaOperationRepository';
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
});
