-- on_user_register gives every new account a user_requests row. A student row
-- without one (from before that) was stuck: it counted as pending, but the
-- account review page joins on user_requests, so admins never saw it to accept
-- it. Give those accounts a pending request so they show up for review.
INSERT INTO public.user_requests (user_id, request_status)
SELECT s.id, 'pending'
FROM public.students s
WHERE NOT EXISTS (SELECT 1 FROM public.user_requests r WHERE r.user_id = s.id)
ON CONFLICT (user_id) DO NOTHING;
