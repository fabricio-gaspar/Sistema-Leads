import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { optionalString, readJson, requiredString, requiredUuid } from '../_shared/validation.ts';

const MANAGER_ROLES = ['owner', 'admin', 'manager', 'seller'];

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ error: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers);

  try {
    const body = await readJson(request);
    const organizationId = requiredUuid(body.organizationId, 'organization_id');
    const connectionId = requiredUuid(body.connectionId, 'connection_id');
    const recipient = requiredString(body.recipient, 'recipient', 32).replace(/\D/g, '');
    const message = requiredString(body.message, 'message', 4_096);
    const idempotencyKey = requiredString(body.idempotencyKey, 'idempotency_key', 128);
    const scheduledFor = optionalString(body.scheduledFor, 'scheduled_for', 64);
    if (recipient.length < 10 || recipient.length > 15) throw new Error('invalid_recipient');

    const { client, user } = await requireUser(request);
    await requireOrganizationRole(client, user.id, organizationId, MANAGER_ROLES);
    const admin = createAdminClient();
    const { data: connection, error: connectionError } = await admin
      .from('integration_connections')
      .select('id, organization_id, provider, status')
      .eq('id', connectionId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (connectionError || !connection || !['whatsapp_meta', 'whatsapp_zapi'].includes(connection.provider)) {
      throw new Error('invalid_connection');
    }
    if (connection.status !== 'connected') throw new Error('connection_not_ready');

    const { data: queued, error: queueError } = await admin
      .from('outbound_messages')
      .upsert(
        {
          organization_id: organizationId,
          integration_connection_id: connectionId,
          channel: 'whatsapp',
          recipient,
          body: message,
          status: 'queued',
          idempotency_key: idempotencyKey,
          requested_by: user.id,
          scheduled_for: scheduledFor ?? new Date().toISOString(),
        },
        { onConflict: 'organization_id,idempotency_key', ignoreDuplicates: true },
      )
      .select('id, status')
      .maybeSingle();
    if (queueError) throw new Error('queue_failed');

    await admin.from('audit_logs').insert({
      organization_id: organizationId,
      actor_id: user.id,
      action: 'outbound_message.queued',
      entity_type: 'outbound_message',
      entity_id: queued?.id ?? null,
      metadata: { channel: 'whatsapp', connection_id: connectionId },
    });
    return json({ queued: true, messageId: queued?.id ?? null, status: queued?.status ?? 'queued' }, 202, headers);
  } catch (error) {
    const message = safeError(error);
    const status = ['authentication_required', 'invalid_session', 'organization_access_denied'].includes(message) ? 403 : 400;
    return json({ error: message }, status, headers);
  }
});
