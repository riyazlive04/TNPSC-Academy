-- ============================================================================
-- Rank Booster — Language Tests (General English / General Tamil papers)
-- ----------------------------------------------------------------------------
-- Run AFTER rank_booster.sql (needs the 'testseries_g2' category + the
-- series='g2a_rankbooster' test_series catalog it created).
--
-- The flyer's 23-test schedule interleaves 10 "GS + Aptitude" tests (already
-- loaded as g2rb1..g2rb10, test_set 1..10) with 10 "Language Test" slots
-- (test no. 2, 4, 6, ..., 20 in public/rank-booster-2026-schedule.pdf) — those
-- 10 slots were never in the catalog. This file adds them as 5 General English
-- + 5 General Tamil papers (test_set 11..20), sourced from
-- parser/Group2/english_sets_v2/set01..05 and parser/Group2/tamil_sets/set01..05
-- (loaded separately by server/load-rank-booster-language.mjs).
--
-- sort_order is renumbered across ALL 20 regular-test rows to the flyer's own
-- "TEST NO" (1..20) so the combined Rank Booster list reads in the same
-- chronological order as the schedule the flyer/landing page already show —
-- rather than two blocks (GS 1-10 then Language 11-20) that would look
-- out-of-date-order once both types are mixed in one grid.
--
-- Apply with:  node run-migration.mjs ../supabase/rank_booster_language_tests.sql
-- Idempotent / re-runnable.
-- ============================================================================

-- ─── 1. Re-sequence the existing GS + Aptitude rows to their flyer test-no ───
-- (odd numbers 1,3,5,...,19 — even slots go to the new Language rows below).
update public.test_series set sort_order = case test_set
  when 1 then 1  when 2 then 3  when 3 then 5  when 4 then 7  when 5 then 9
  when 6 then 11 when 7 then 13 when 8 then 15 when 9 then 17 when 10 then 19
  else sort_order end
where series = 'g2a_rankbooster' and test_set between 1 and 10;

-- ─── 2. Language Test catalog: 5 General English + 5 General Tamil papers ───
insert into public.test_series
  (id, series, test_set, title, title_ta, unit_label, unit_label_ta,
   subjects_label, subjects_label_ta,
   total_questions, duration_seconds, scheduled_date, sort_order, tier)
values
  ('g2rb11', 'g2a_rankbooster', 11, 'General English Test 1', 'பொது ஆங்கிலம் தேர்வு 1',
   'General English', 'பொது ஆங்கிலம்',
   'Grammar · Vocabulary · Reading Comprehension · Writing Skills · Literary Works · Technical Terms · Translation',
   'இலக்கணம் · சொல்லகராதி · வாசித்தல் · எழுதும் திறன் · இலக்கியம் · கலைச் சொற்கள் · மொழிபெயர்ப்பு',
   100, 5400, '2026-08-24', 2, 'paid'),
  ('g2rb12', 'g2a_rankbooster', 12, 'General Tamil Test 1', 'பொது தமிழ் தேர்வு 1',
   'General Tamil', 'பொது தமிழ்',
   'இலக்கணம் · சொல்லகராதி · வாசித்தல் · எழுதும் திறன் · இலக்கியம் · கலைச் சொற்கள் · மொழிபெயர்ப்பு',
   'இலக்கணம் · சொல்லகராதி · வாசித்தல் · எழுதும் திறன் · இலக்கியம் · கலைச் சொற்கள் · மொழிபெயர்ப்பு',
   100, 5400, '2026-08-30', 4, 'paid'),
  ('g2rb13', 'g2a_rankbooster', 13, 'General English Test 2', 'பொது ஆங்கிலம் தேர்வு 2',
   'General English', 'பொது ஆங்கிலம்',
   'Grammar · Vocabulary · Reading Comprehension · Writing Skills · Literary Works · Technical Terms · Translation',
   'இலக்கணம் · சொல்லகராதி · வாசித்தல் · எழுதும் திறன் · இலக்கியம் · கலைச் சொற்கள் · மொழிபெயர்ப்பு',
   100, 5400, '2026-09-05', 6, 'paid'),
  ('g2rb14', 'g2a_rankbooster', 14, 'General Tamil Test 2', 'பொது தமிழ் தேர்வு 2',
   'General Tamil', 'பொது தமிழ்',
   'இலக்கணம் · சொல்லகராதி · வாசித்தல் · எழுதும் திறன் · இலக்கியம் · கலைச் சொற்கள் · மொழிபெயர்ப்பு',
   'இலக்கணம் · சொல்லகராதி · வாசித்தல் · எழுதும் திறன் · இலக்கியம் · கலைச் சொற்கள் · மொழிபெயர்ப்பு',
   100, 5400, '2026-09-11', 8, 'paid'),
  ('g2rb15', 'g2a_rankbooster', 15, 'General English Test 3', 'பொது ஆங்கிலம் தேர்வு 3',
   'General English', 'பொது ஆங்கிலம்',
   'Grammar · Vocabulary · Reading Comprehension · Writing Skills · Literary Works · Technical Terms · Translation',
   'இலக்கணம் · சொல்லகராதி · வாசித்தல் · எழுதும் திறன் · இலக்கியம் · கலைச் சொற்கள் · மொழிபெயர்ப்பு',
   100, 5400, '2026-09-17', 10, 'paid'),
  ('g2rb16', 'g2a_rankbooster', 16, 'General Tamil Test 3', 'பொது தமிழ் தேர்வு 3',
   'General Tamil', 'பொது தமிழ்',
   'இலக்கணம் · சொல்லகராதி · வாசித்தல் · எழுதும் திறன் · இலக்கியம் · கலைச் சொற்கள் · மொழிபெயர்ப்பு',
   'இலக்கணம் · சொல்லகராதி · வாசித்தல் · எழுதும் திறன் · இலக்கியம் · கலைச் சொற்கள் · மொழிபெயர்ப்பு',
   100, 5400, '2026-09-23', 12, 'paid'),
  ('g2rb17', 'g2a_rankbooster', 17, 'General English Test 4', 'பொது ஆங்கிலம் தேர்வு 4',
   'General English', 'பொது ஆங்கிலம்',
   'Grammar · Vocabulary · Reading Comprehension · Writing Skills · Literary Works · Technical Terms · Translation',
   'இலக்கணம் · சொல்லகராதி · வாசித்தல் · எழுதும் திறன் · இலக்கியம் · கலைச் சொற்கள் · மொழிபெயர்ப்பு',
   100, 5400, '2026-09-29', 14, 'paid'),
  ('g2rb18', 'g2a_rankbooster', 18, 'General Tamil Test 4', 'பொது தமிழ் தேர்வு 4',
   'General Tamil', 'பொது தமிழ்',
   'இலக்கணம் · சொல்லகராதி · வாசித்தல் · எழுதும் திறன் · இலக்கியம் · கலைச் சொற்கள் · மொழிபெயர்ப்பு',
   'இலக்கணம் · சொல்லகராதி · வாசித்தல் · எழுதும் திறன் · இலக்கியம் · கலைச் சொற்கள் · மொழிபெயர்ப்பு',
   100, 5400, '2026-10-05', 16, 'paid'),
  ('g2rb19', 'g2a_rankbooster', 19, 'General English Test 5', 'பொது ஆங்கிலம் தேர்வு 5',
   'General English', 'பொது ஆங்கிலம்',
   'Grammar · Vocabulary · Reading Comprehension · Writing Skills · Literary Works · Technical Terms · Translation',
   'இலக்கணம் · சொல்லகராதி · வாசித்தல் · எழுதும் திறன் · இலக்கியம் · கலைச் சொற்கள் · மொழிபெயர்ப்பு',
   100, 5400, '2026-10-11', 18, 'paid'),
  ('g2rb20', 'g2a_rankbooster', 20, 'General Tamil Test 5', 'பொது தமிழ் தேர்வு 5',
   'General Tamil', 'பொது தமிழ்',
   'இலக்கணம் · சொல்லகராதி · வாசித்தல் · எழுதும் திறன் · இலக்கியம் · கலைச் சொற்கள் · மொழிபெயர்ப்பு',
   'இலக்கணம் · சொல்லகராதி · வாசித்தல் · எழுதும் திறன் · இலக்கியம் · கலைச் சொற்கள் · மொழிபெயர்ப்பு',
   100, 5400, '2026-10-17', 20, 'paid')
on conflict (id) do nothing;
