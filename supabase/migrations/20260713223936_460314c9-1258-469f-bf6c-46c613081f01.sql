
CREATE POLICY "auth read docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'docs');
CREATE POLICY "auth insert docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'docs');
CREATE POLICY "auth update docs" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'docs');
CREATE POLICY "auth delete own docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'docs' AND owner = auth.uid());

CREATE POLICY "auth read avatars" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "auth insert own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "auth update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "auth delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "auth read contracts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'contracts');
CREATE POLICY "auth insert contracts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contracts');
CREATE POLICY "admin update contracts" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "admin delete contracts" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'administrador'));
