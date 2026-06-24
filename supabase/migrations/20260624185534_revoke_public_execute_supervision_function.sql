
-- Revoke execute on the SECURITY DEFINER function from ALL roles including PUBLIC.
-- The previous migration revoked anon/authenticated individually but the implicit
-- PUBLIC grant remained. This covers all paths.
REVOKE EXECUTE ON FUNCTION public.reset_supervision_hours_this_week() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_supervision_hours_this_week() FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_supervision_hours_this_week() FROM authenticated;
