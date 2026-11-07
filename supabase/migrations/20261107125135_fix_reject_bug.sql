-- This fixes a bug where reject does not automatically delete accounts after 7-days

create or replace function public.delete_expired_rejects()
  returns void
  language plpgsql
  security definer
  set search_path to 'public', 'auth'
  as $function$
begin
  delete from auth.users
  where id in (
    select user_id
    from public.user_requests
    -- Offending line, old function checked for 'rejected'
    where request_status = 'reject'
      and reject_date < now() - interval '7 days'
  );
end;
$function$;

-- Only the scheduled job needs to call this.
revoke all on function public.delete_expired_rejects() from public, anon, authenticated;