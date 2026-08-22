-- ============================================================================
-- Rank Booster — sync catalog content to the 23-test flyer
-- ----------------------------------------------------------------------------
-- Source: public/rank-booster-2026-schedule.pdf ("RANK BOOSTER TNPSC GROUP
-- II / IIA PRELIMS TEST SERIES 2026"), the same 23-test schedule already cited
-- by supabase/rank_booster_language_tests.sql. Verified against LIVE data
-- (2026-08-22) before writing this file:
--   - scheduled_date on g2rb1..g2rb20 already matches the flyer's every-
--     third-day cadence — no date changes needed here.
--   - g2rb1..g2rb20 all have exactly 100 real questions loaded under
--     category='testseries_g2' — untouched by this file.
--   - Tests 21-23 ("Grand Mock Test 1/2/3", 200Q full-exam-pattern, on
--     20/23/26 Oct 2026) were never added to the catalog at all.
--
-- This file only:
--   1. Corrects unit_label/subjects_label (EN+TA) on 8 rows (g2rb3, g2rb4,
--      g2rb5, g2rb6, g2rb7, g2rb8, g2rb9, g2rb10) that paraphrased or
--      mislabeled their flyer "DETAILS / FOCUS" text — most notably g2rb8/9/10
--      were tagged "Full Mock", which the flyer does not support (all 20
--      regular tests are plain GS+Aptitude/Language papers; the only actual
--      mocks are tests 21-23 below).
--   2. Adds catalog rows for tests 21-23 with enabled=false: the schedule/
--      title/label metadata is real, but no question content has been
--      authored for them yet (metadata-only per 2026-08-22 decision — full
--      200Q-per-test bilingual authoring deferred as separate follow-up work).
--      Leave disabled until server/load-rank-booster*.mjs-equivalent loading
--      populates category='testseries_g2' for test_set 21/22/23, then flip
--      enabled via admin_set_test_series (or superadmin UI) once verified.
--
-- Apply with:  node --env-file=.env run-migration.mjs ../supabase/rank_booster_23test_sync.sql
-- Idempotent / re-runnable.
-- ============================================================================

-- ─── 1. Content corrections on existing rows (EN + TA) ───────────────────────

update public.test_series set
  subjects_label    = 'Indian Polity · Aptitude: Percentage, Ratio & Proportion',
  subjects_label_ta = 'இந்திய அரசியலமைப்பு · எண்ணியல்: சதவீதம், விகிதம் & விகிதாசாரம்'
where id = 'g2rb3';

update public.test_series set
  unit_label         = 'Development Administration & Economics',
  unit_label_ta      = 'வளர்ச்சி நிர்வாகம் & பொருளாதாரம்',
  subjects_label     = 'Development Administration · Core Economics · Aptitude: Simple & Compound Interest',
  subjects_label_ta  = 'வளர்ச்சி நிர்வாகம் · அடிப்படைப் பொருளாதாரம் · எண்ணியல்: தனி & கூட்டு வட்டி'
where id = 'g2rb4';

update public.test_series set
  subjects_label     = 'History, Culture, Heritage & Socio-Political Movements in Tamil Nadu · Aptitude: Area & Volume (2D, 3D, Pathway)',
  subjects_label_ta  = 'தமிழ்நாட்டின் வரலாறு, பண்பாடு, பாரம்பரியம் & சமூக-அரசியல் இயக்கங்கள் · எண்ணியல்: பரப்பளவு & கன அளவு (2D, 3D, பாதை)'
where id = 'g2rb5';

update public.test_series set
  subjects_label     = 'General Studies (Full Syllabus) · Aptitude: Time & Work',
  subjects_label_ta  = 'பொது அறிவு (முழு பாடத்திட்டம்) · எண்ணியல்: வேலை & நேரம்'
where id = 'g2rb6';

update public.test_series set
  subjects_label     = 'General Studies (Full Syllabus) · Aptitude: Reasoning (Full Syllabus)',
  subjects_label_ta  = 'பொது அறிவு (முழு பாடத்திட்டம்) · எண்ணியல்: தர்க்கப் பகுத்தறிவு (முழு பாடத்திட்டம்)'
where id = 'g2rb7';

-- g2rb8/9/10 shared the same "Full Mock" mislabel + identical flyer wording —
-- fixed together, differentiated only by unit_label's Roman numeral (III/IV/V,
-- continuing g2rb6/g2rb7's existing I/II) so the review sequence reads as one
-- consistent 5-part "Full Syllabus Review" arc rather than I/II then "Mock".
update public.test_series set
  unit_label         = 'Full Syllabus Review III',
  unit_label_ta      = 'முழு பாடத்திட்ட மீள்பார்வை III',
  subjects_label     = 'General Studies (Full Syllabus) · Aptitude (Full Syllabus)',
  subjects_label_ta  = 'பொது அறிவு (முழு பாடத்திட்டம்) · எண்ணியல் (முழு பாடத்திட்டம்)'
where id = 'g2rb8';

update public.test_series set
  unit_label         = 'Full Syllabus Review IV',
  unit_label_ta      = 'முழு பாடத்திட்ட மீள்பார்வை IV',
  subjects_label     = 'General Studies (Full Syllabus) · Aptitude (Full Syllabus)',
  subjects_label_ta  = 'பொது அறிவு (முழு பாடத்திட்டம்) · எண்ணியல் (முழு பாடத்திட்டம்)'
where id = 'g2rb9';

update public.test_series set
  unit_label         = 'Full Syllabus Review V',
  unit_label_ta      = 'முழு பாடத்திட்ட மீள்பார்வை V',
  subjects_label     = 'General Studies (Full Syllabus) · Aptitude (Full Syllabus)',
  subjects_label_ta  = 'பொது அறிவு (முழு பாடத்திட்டம்) · எண்ணியல் (முழு பாடத்திட்டம்)'
where id = 'g2rb10';

-- ─── 2. Grand Mock catalog rows (tests 21-23) — disabled until content loads ─
-- duration_seconds = 10800 (3h), matching the real TNPSC Group II/IIA combined
-- prelim's 200-question exam duration ("Full Exam Pattern"), not the 90-minute/
-- 100Q pacing the other 20 papers use.
insert into public.test_series
  (id, series, test_set, title, title_ta, unit_label, unit_label_ta,
   subjects_label, subjects_label_ta,
   total_questions, duration_seconds, scheduled_date, sort_order, tier, enabled)
values
  ('g2rb21', 'g2a_rankbooster', 21, 'Grand Mock Test 1', 'கிராண்ட் மாக் தேர்வு 1',
   'Full Exam Pattern', 'முழு தேர்வு முறை',
   'General Studies (all subjects) · Aptitude & Reasoning — Full Exam Pattern',
   'பொது அறிவு (அனைத்து பாடங்களும்) · எண்ணியல் & தர்க்கப் பகுத்தறிவு — முழு தேர்வு முறை',
   200, 10800, '2026-10-20', 21, 'paid', false),
  ('g2rb22', 'g2a_rankbooster', 22, 'Grand Mock Test 2', 'கிராண்ட் மாக் தேர்வு 2',
   'Full Exam Pattern', 'முழு தேர்வு முறை',
   'General Studies (all subjects) · Aptitude & Reasoning — Full Exam Pattern',
   'பொது அறிவு (அனைத்து பாடங்களும்) · எண்ணியல் & தர்க்கப் பகுத்தறிவு — முழு தேர்வு முறை',
   200, 10800, '2026-10-23', 22, 'paid', false),
  ('g2rb23', 'g2a_rankbooster', 23, 'Grand Mock Test 3 (Final Mock)', 'கிராண்ட் மாக் தேர்வு 3 (இறுதி மாதிரி)',
   'Final Mock', 'இறுதி மாதிரி',
   'General Studies (all subjects) · Aptitude & Reasoning — Final Mock',
   'பொது அறிவு (அனைத்து பாடங்களும்) · எண்ணியல் & தர்க்கப் பகுத்தறிவு — இறுதி மாதிரி',
   200, 10800, '2026-10-26', 23, 'paid', false)
on conflict (id) do nothing;
