create extension if not exists pgcrypto with schema extensions;

create table private.mfa_codes (    
    id bigint generated always as identity primary key,    
    user_id uuid not null references auth.users(id) on delete cascade,
    session_id uuid not null ,
    code_hash text not null ,
    attempts smallint not null  default 0,
    created_at timestamptz not null  default now(),
    expires_at timestamptz not null  default now() + interval '10 minutes',
    used_at timestamptz
);

create index mfa_codes_user_created_idx
  ON private.mfa_codes(user_id, created_at DESC);

create table private.mfa_sessions(
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create function private.mfa_required(p_user_id uuid)
  returns boolean
  language sql
  stable
  set search_path to ''
  as $function$
  select exists (select 1 from public.admins a where a.id = p_user_id);
$function$;

create function public.mfa_pending()
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  as $function$
  select private.mfa_required((select auth.uid()))
    and not exists (
      select 1
      from private.mfa_sessions s
      where s.user_id = (select auth.uid())
        and s.session_id = ((select auth.jwt()) ->> 'session_id')::uuid
        and s.expires_at > now()
    );
$function$;

create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  as $function$
  select exists (select 1 from public.admins a where a.id = (select auth.uid()))
    and not public.mfa_pending();
$function$;

create function public.issue_mfa_code (
  p_user_id uuid,
  p_session_id uuid,
  p_code text,
  p_resend boolean
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  as $function$
declare
  v_email text;
  v_last_created timestamptz;
  v_last_expires timestamptz;
  v_last_used timestamptz;
  v_wait integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  if not private.mfa_required(p_user_id) then
    return jsonb_build_object('status', 'not_required');
  end if;

  select u.email into v_email from auth.users u where u.id = p_user_id;

  if exists (
    select 1 from private.mfa_sessions s
    where s.session_id = p_session_id
      and s.user_id = p_user_id
      and s.expires_at > now()
  ) then return jsonb_build_object('status', 'verified');
  end if;

  select c.created_at, c.expires_at, c.used_at
  into v_last_created, v_last_expires, v_last_used
  from private.mfa_codes c
  where c.user_id = p_user_id and c.session_id = p_session_id
  order by c.created_at desc, c.id desc
  limit 1;

  v_wait := greatest(
    0,
    coalesce(ceil(extract(epoch from v_last_created + interval '60 seconds' - now()))::integer, 0)
  );

  if not p_resend and v_last_used is null and v_last_expires > now() then
    return jsonb_build_object('status', 'active', 'retry_after', v_wait);
  end if;

  if v_wait > 0 then
    return jsonb_build_object('status', 'cooldown', 'retry_after', v_wait);
  end if;

  if (
    select count(*) from private.mfa_codes c
    where c.user_id = p_user_id and c.created_at > now() - interval '1 hour'
  ) >= 10 then return jsonb_build_object('status', 'rate_limited');
  end if;

  delete from private.mfa_codes c
  where c.user_id = p_user_id and c.created_at < now() - interval '1 day';

  delete from private.mfa_sessions s
  where s.user_id = p_user_id and s.expires_at <= now();

  update private.mfa_codes c
  set used_at = now()
  where c.user_id = p_user_id and c.session_id = p_session_id and c.used_at is null;

  insert into private.mfa_codes(user_id, session_id, code_hash)
  values(p_user_id, p_session_id, extensions.crypt(p_code, extensions.get_salt('bf', 8)));

  return jsonb_build_object('status', 'sent', 'email', v_email, 'retry_after', 60);
end;
$function$;

create function public.verify_mfa_code(p_code text)
  returns text
  language plpgsql
  security definer
  set search_path to ''
  as $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := (auth.jwt() ->> 'session_id')::uuid;
  v_code private.mfa_codes%ROWTYPE;
begin
  if v_session_id is null or not private.mfa_required(v_user_id) then
    return 'expired';
  end if;

  select * into v_code
  from private.mfa_codes c
  where c.user_id = v_user_id
    and c.session_id = v_session_id
    and c.used_at is null
    and c.expires_at > now()
  order by c.created_at desc, c.id desc
  limit 1
  for update;

  if not found then
    return 'expired';
  end if;

  if extensions.crypt(p_code, v_code.code_hash) = v_code.code_hash then
    update private.mfa_codes c set used_at = now() where c.id = v_code.id;

    insert into private.mfa_sessions (session_id, user_id)
    values (v_session_id, v_user_id)
    on conflict(session_id) do update
      set verified_at = now(), expires_at = now() + interval '7 days';

    return 'verified';
  end if;

  update private.mfa_codes c
  set attempts = c.attempts + 1,
    used_at = case when c.attempts + 1 >= 5 then now() end
  where c.id = v_code.id;

  return case when v_code.attempts + 1 >= 5 then 'expired' else 'incorrect' end;
end;
$function$;

revoke all on function private.mfa_required (uuid) from public, anon, authenticated;

revoke all on function public.mfa_pending () from public, anon;
grant execute on function public.mfa_pending() to authenticated, service_role;

revoke all on function public.issue_mfa_code (uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.issue_mfa_code(uuid, uuid, text, boolean) to service_role;

revoke all on function public.verify_mfa_code(text) from public, anon;
grant execute on function public.verify_mfa_code(text) to authenticated;

create or replace function public.reject_user(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public', 'auth'
  as $function$
begin
  if not public.is_admin() then
    raise exception 'Access denied: You must be an admin to delete users.';
  end if;

  delete from auth.users where id = target_user;
end;
$function$;

alter policy "allow admins to accept/reject" on public.user_requests
  using((select public.is_admin()))
  with check((select public.is_admin()));