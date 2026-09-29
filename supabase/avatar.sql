-- Avatar persistence for the SOE Hub profile page.
--
-- The frontend currently keeps the picture in localStorage, so nothing here is
-- required to run the app. Run this once when the backend task picks the
-- feature up, then swap the two bodies marked in `lib/avatar.ts`.
--
-- Target: the connected Supabase project's SQL editor.

-- 1. Column the app writes to.
alter table public.users
  add column if not exists avatar_path text;

-- 2. Public bucket. Objects are named "<user id>/<uuid>.jpg".
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3. Storage policies: anyone can read, only the owner can write their folder.
create policy "avatars are public"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Allow a signed-in user to write their own row. Replace the placeholder
--    policy if the table already has one.
create policy "users update their own row"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
