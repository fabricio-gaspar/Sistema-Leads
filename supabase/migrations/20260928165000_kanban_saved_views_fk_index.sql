-- Covers the foreign-key maintenance path for personal Kanban views.
-- The existing organization/user/module lookup index remains the read path.
create index if not exists user_saved_views_user_id_idx
  on public.user_saved_views (user_id);
