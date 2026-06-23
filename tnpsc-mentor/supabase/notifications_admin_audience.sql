-- ============================================================================
-- TNPSC Mentors — add an 'admin' audience to notifications
-- ----------------------------------------------------------------------------
-- Lets the server file in-app alerts aimed only at admins/superadmins (e.g. a
-- passive "free Premium activated" alert when a 100%-discount coupon is redeemed).
-- Widens the audience CHECK; the server's matches()/audienceUserIds() resolve it
-- to users whose profile role is admin or superadmin. Idempotent / re-runnable.
-- ============================================================================

alter table public.notifications drop constraint if exists notifications_audience_check;
alter table public.notifications add constraint notifications_audience_check
  check (audience in ('all', 'premium', 'free', 'group', 'admin'));
