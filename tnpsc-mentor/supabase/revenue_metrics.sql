-- ============================================================================
-- TNPSC Mentors — Revenue / founder metrics (superadmin console)
-- ----------------------------------------------------------------------------
-- Run AFTER payments.sql + coupons.sql + superadmin.sql. One jsonb payload for
-- the Revenue tab, computed straight off the trusted `payments` ledger (only
-- status='paid' rows count as revenue; `amount` is the FINAL charged paise).
-- is_superadmin()-gated + SECURITY DEFINER, mirroring get_platform_metrics().
-- Idempotent.
-- ============================================================================

create or replace function public.get_revenue_metrics()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'currency', 'INR',
    -- All revenue figures are in paise (₹1 = 100). Calendar-based windows.
    'revenueToday',   coalesce((select sum(amount) from payments
                                 where status = 'paid' and created_at::date = current_date), 0),
    'revenueWeek',    coalesce((select sum(amount) from payments
                                 where status = 'paid' and created_at >= date_trunc('week', now())), 0),
    'revenueMonth',   coalesce((select sum(amount) from payments
                                 where status = 'paid' and created_at >= date_trunc('month', now())), 0),
    'revenueYear',    coalesce((select sum(amount) from payments
                                 where status = 'paid' and created_at >= date_trunc('year', now())), 0),
    'revenueAllTime', coalesce((select sum(amount) from payments where status = 'paid'), 0),

    'paidOrders',      (select count(*) from payments where status = 'paid'),
    'payingCustomers', (select count(distinct user_id) from payments where status = 'paid'),
    -- Active premium = a paid premium_annual order within the last year.
    'premiumActive',   (select count(distinct user_id) from payments
                          where status = 'paid'
                            and notes->>'plan' = 'premium_annual'
                            and created_at >= now() - interval '1 year'),
    'avgOrderValue',   coalesce((select round(avg(amount)) from payments where status = 'paid'), 0),
    'totalDiscount',   coalesce((select sum(discount_amount) from payments where status = 'paid'), 0),
    'couponOrders',    (select count(*) from payments where status = 'paid' and coupon_id is not null),
    'failedPayments',  (select count(*) from payments where status = 'failed'),
    'totalUsers',      (select count(*) from profiles),

    -- Revenue per month for the last 12 calendar months (zero-filled).
    'revenueByMonth', (
      select coalesce(jsonb_agg(
               jsonb_build_object('month', to_char(m, 'YYYY-MM'), 'revenue', rev) order by m
             ), '[]'::jsonb)
      from (
        select m,
               coalesce((select sum(amount) from payments p
                          where p.status = 'paid'
                            and date_trunc('month', p.created_at) = m), 0) as rev
        from generate_series(
               date_trunc('month', now()) - interval '11 months',
               date_trunc('month', now()),
               interval '1 month'
             ) m
      ) t
    ),

    -- Top 5 promoters by revenue their coupon drove (paid orders only).
    'topPromoters', (
      select coalesce(jsonb_agg(
               jsonb_build_object('promoter', promoter_name, 'code', code,
                                  'revenue', rev, 'redemptions', cnt) order by rev desc
             ), '[]'::jsonb)
      from (
        select c.promoter_name, c.code, sum(p.amount) as rev, count(*) as cnt
        from payments p
        join coupons c on c.id = p.coupon_id
        where p.status = 'paid'
        group by c.promoter_name, c.code
        order by rev desc
        limit 5
      ) tp
    )
  ) into v;

  return v;
end;
$$;

grant execute on function public.get_revenue_metrics() to authenticated;
