-- ============================================================================
-- TNPSC Mentors — CA → Telegram: is the self-hosted DB ready?
-- ----------------------------------------------------------------------------
-- Read-only. Run after ca_telegram.sql (and storage_buckets.sql) to confirm the
-- daily CA broadcast has everything it needs. Every row should read 'OK'.
-- ============================================================================

select 'ca_telegram_posts table' as check,
       case when to_regclass('public.ca_telegram_posts') is not null
            then 'OK' else 'MISSING - run supabase/ca_telegram.sql' end as status
union all
select 'ca_telegram_posts index',
       case when exists (select 1 from pg_indexes
                         where schemaname = 'public' and indexname = 'ca_telegram_posts_issue_idx')
            then 'OK' else 'MISSING' end
union all
select 'RLS enabled (server-only table)',
       case when exists (select 1 from pg_class
                         where oid = 'public.ca_telegram_posts'::regclass and relrowsecurity)
            then 'OK' else 'RLS OFF - table would be client-readable' end
union all
select 'ca_magazine table (the issue source)',
       case when to_regclass('public.ca_magazine') is not null
            then 'OK' else 'MISSING - run supabase/ca_generator.sql' end
union all
select 'app_settings: telegram_ca_channel',
       coalesce((select 'OK - ' || (value #>> '{}') from public.app_settings
                 where key = 'telegram_ca_channel'),
                'MISSING - falls back to the TELEGRAM_CA_CHANNEL env var')
union all
select 'app_settings: caption_en',
       case when exists (select 1 from public.app_settings where key = 'telegram_ca_caption_en')
            then 'OK' else 'MISSING - server uses its built-in default' end
union all
select 'app_settings: caption_ta',
       case when exists (select 1 from public.app_settings where key = 'telegram_ca_caption_ta')
            then 'OK' else 'MISSING - server uses its built-in default' end
union all
select 'ca-deliverables bucket',
       case when exists (select 1 from storage.buckets where id = 'ca-deliverables')
            then 'OK' else 'MISSING - run supabase/storage_buckets.sql' end;

-- What has already been sent (and whether its archived PDF still exists).
-- NOTE: the 2026-09-04 migration lost 91 CA daily Telegram PDFs from storage,
-- so old rows can show 'archive lost' — a re-send of those issues will fail on
-- download. Newly sent issues archive fine.
select p.date, p.ca_type, p.lang, p.message_id, p.sent_at,
       case when o.id is null then 'archive lost' else 'archived' end as pdf
from public.ca_telegram_posts p
left join storage.objects o
       on o.bucket_id = 'ca-deliverables' and o.name = p.storage_path
order by p.date desc, p.sent_at desc
limit 20;
