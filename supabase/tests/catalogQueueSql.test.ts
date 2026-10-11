import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../migrations/20261011235900_fix_catalog_message_id_conflicts.sql', import.meta.url),
  'utf8',
);

describe('catalog WhatsApp queue migration', () => {
  it('qualifies the partial-index predicate that collides with RETURNS TABLE message_id', () => {
    expect(migration).toContain('insert into public.message_attachments as attachment');
    expect(migration).toContain('where attachment.message_id is not null and attachment.external_url is not null');
    expect(migration).not.toContain('where message_id is not null and external_url is not null do nothing');
    expect(migration).toContain('on conflict on constraint conversation_knowledge_events_message_id_item_id_event_type_key do nothing');
    expect(migration).not.toContain('on conflict (message_id, item_id, event_type) do nothing');
    expect(migration).toContain('returns table(job_id uuid, message_id uuid, job_status text, duplicate boolean)');
  });
});
