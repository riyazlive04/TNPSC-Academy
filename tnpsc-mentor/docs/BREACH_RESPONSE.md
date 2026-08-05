# Personal data breach — detection and response runbook

**Owner:** Mohamed Riyaz (Grievance Officer / incident lead) — support@tnpscmentors.in · +91 96777 79808
**Applies to:** TNPSC Mentors (app, website, API, database, storage buckets)
**Statute:** Digital Personal Data Protection Act 2023, s.8(6) and the DPDP Rules (breach intimation)

The Privacy Policy tells every user that if a breach occurs we will notify the Data Protection
Board of India and each affected person **without undue delay**. This document is how that
promise is kept. Read section 3 first during an incident; the rest is preparation.

> **Verify the rule text before you file.** The intimation format and timelines are set by the
> DPDP Rules and by whatever the Board publishes on its portal. Check the current text at the
> time of the incident rather than trusting the summary below.

---

## 1. What counts as a personal data breach

Any unauthorised processing, or accidental disclosure, acquisition, sharing, use, alteration,
destruction or loss of access to personal data that compromises its confidentiality, integrity
or availability. In this product that includes:

- Anyone reading user rows they are not entitled to — a stolen admin session, a leaked
  service-role key, an RLS policy regression, a scraped API.
- The database, a storage bucket or a backup being copied out.
- Data destroyed or made permanently unavailable (ransomware, a bad migration with no restore).
- A processor telling us **they** were breached (Supabase, Razorpay, Hostinger, MSG91, AiSensy,
  Google, Apple, Telegram).
- A user's account being taken over by someone else.

A near miss with no exposure is **not** a breach, but log it anyway (section 6) — a pattern of
near misses is what a regulator will ask about.

## 2. How we would find out

| Source | What it catches | Where it lands |
| --- | --- | --- |
| `audit_log` (category `security`) | failed-sign-in bursts, admin-route probing, rate-limit abuse, 5xx spikes | DB + Telegram alert |
| `audit_log` (category `admin`) | every admin/superadmin API call: actor, target user, status, IP | DB; high-risk actions also alert |
| `audit_log` (category `auth`) | sign-in success/failure, device-limit blocks, device replacement, password resets, sign-ups | DB |
| API access log | one JSON line per request: method, path, status, duration, user id, IP | PM2 stdout, 90-day rotation |
| Nginx access/error log | requests that never reached the API | `/var/log/nginx`, 90-day rotation |
| Supabase dashboard | Postgres/PostgREST/Auth logs, unusual query volume | Supabase (plan-limited retention) |
| Razorpay dashboard | disputed or anomalous transactions | Razorpay |
| A person | user complaint, security researcher email, public disclosure | support@tnpscmentors.in |

Alerts are delivered to Telegram when `SECURITY_ALERT_CHAT_ID` (and a bot token) are set in
`server/.env`. **If that is unset, nothing pages anybody** — the server logs a warning at boot
saying so. Set it.

### Detector thresholds

Defined in `server/src/lib/securityAlerts.ts`:

| Detector | Fires when |
| --- | --- |
| `auth_failure_burst` | 10 failed sign-ins from one IP in 10 minutes |
| `auth_failure_spike` | 60 failed sign-ins across all IPs in 10 minutes |
| `authz_probe` | 15 × HTTP 403 from one IP in 10 minutes |
| `rate_limit_abuse` | 60 × HTTP 429 from one IP in 10 minutes |
| `error_spike` | 25 × HTTP 5xx in 5 minutes |
| `privileged_action` | first occurrence — any successful role change, grant/revoke, delete or export by an admin |

An alert is **a signal, not a verdict**. Investigate before declaring a breach.

## 3. During an incident

### First 60 minutes — contain and preserve

1. **Write down the time you became aware.** Every deadline runs from this moment. Record it in
   the incident log (section 6) before doing anything else.
2. **Contain.** Rotate what was exposed: `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`,
   `JWT` signing keys, the Telegram bot token, admin passwords. Demote or suspend a compromised
   admin (`profiles.role`). Revoke sessions (`user_sessions`, and Supabase → Auth → Users).
3. **Preserve evidence before you clean up.** `prune_audit_log()` deletes security rows at
   90 days and the log rotation deletes files at 90 days — an investigation that runs long can
   destroy its own evidence. Snapshot first:
   ```bash
   # On the VPS
   sudo cp -r /root/.pm2/logs /root/incident-$(date +%F)/pm2-logs
   sudo cp -r /var/log/nginx  /root/incident-$(date +%F)/nginx-logs
   ```
   ```sql
   -- In Supabase SQL editor: freeze the trail for this window
   create table if not exists audit_log_incident_2026_xx as
     select * from public.audit_log where at >= '<start>' and at < '<end>';
   ```
4. **Do not tamper.** Never edit or delete `audit_log` rows. If a fix requires a schema change,
   snapshot the table first.

### Scoping — what was actually exposed

```sql
-- Everything one actor did in a window
select at, action, subject_id, status, ip, detail
  from public.audit_log
 where actor_id = '<uuid>' and at between '<start>' and '<end>'
 order by at;

-- Every admin action against one user
select at, actor_id, actor_role, action, status, ip
  from public.audit_log
 where subject_id = '<uuid>' order by at desc;

-- All security detections in a window
select at, action, ip, detail from public.audit_log
 where category = 'security' and at >= now() - interval '7 days' order by at desc;

-- Sign-ins for a possibly-hijacked account, with IP and device
select at, action, status, ip, user_agent, detail
  from public.audit_log
 where category = 'auth' and subject_id = '<uuid>' order by at desc limit 100;

-- Live sessions and the IP each was created from
select id, user_id, label, created_at, last_seen_at, revoked_at
  from public.user_sessions where user_id = '<uuid>';
```

Then answer, in writing: **which categories** of personal data (name, email, phone, learning
history, payment references), **how many** Data Principals, **when** it started and ended, and
**whether it is still ongoing**.

### Notify — the clock

Once it is a personal data breach, both notifications are owed. Do not wait for a complete
investigation to start them; an incomplete first intimation followed by detail is what the rules
contemplate.

**A. Every affected user — without delay.** Send in English and Tamil, through the in-app
notification system (`/api/notifications`, superadmin console) **and** by email. It must say, in
plain language: what happened; the nature, extent and timing; the likely consequences for them;
what we have done to mitigate it; what they should do (change password, watch for phishing,
review devices); and our contact details.

> **Template**
> *Subject: Important security notice about your TNPSC Mentors account*
> On <date> we discovered that <what happened, in one sentence>. The information involved was
> <categories>. This happened between <start> and <end>. We <contained it how>.
> **What you should do:** <change your password / sign out other devices / be alert to messages
> claiming to be from us and asking for payment or codes>. We will never ask you for a password
> or an OTP.
> If you have questions, contact Mohamed Riyaz, Grievance Officer, at support@tnpscmentors.in or
> +91 96777 79808. You may also complain to the Data Protection Board of India.

**B. The Data Protection Board — without delay, then in detail within 72 hours.** File the first
intimation as soon as you know a breach occurred (a short description is enough). Within 72 hours
of becoming aware, provide the fuller report:

- [ ] Broad facts: the events, circumstances and reasons that led to the breach
- [ ] Nature, extent and timing; categories of data and approximate number of Data Principals
- [ ] Measures taken to mitigate risk
- [ ] Findings on who caused it, if known
- [ ] Remedial measures taken to prevent recurrence
- [ ] A report on the intimations given to affected Data Principals (when, how, how many)

If 72 hours is not enough, ask the Board in writing for an extension **before** it expires.

### Processors to contact

| Processor | Scope | Where |
| --- | --- | --- |
| Supabase | database, auth, storage | dashboard support · status.supabase.com |
| Hostinger | VPS, application server | hPanel support |
| Razorpay | payment orders and references | dashboard support |
| MSG91 / AiSensy | OTP delivery (phone numbers) | account support |
| Google / Apple | IAP, push delivery, Google sign-in | Play Console / App Store Connect |
| Telegram | signup verification, CA broadcast | @BotFather (rotate token) |

## 4. After

- Root cause in writing: what allowed it, why detection did or did not catch it, how long
  discovery took.
- Fix the cause, then add or tune the detector that would have caught it sooner
  (`securityAlerts.ts`).
- If the Privacy Policy's description of our practices is no longer accurate, update
  `src/lib/legalContent.ts` and run `npm run legal:export`.
- Keep the incident record. The Board can ask for it later.

## 5. Quarterly check (15 minutes)

- [ ] A test alert reaches the Telegram chat (temporarily lower a threshold, or restart the API
      and confirm the boot warning is absent).
- [ ] `select max(at) from public.audit_log where category='admin'` returns something recent.
- [ ] `ls -la /root/.pm2/logs` shows rotated, compressed files — not one enormous `.log`.
- [ ] Supabase backups exist and a restore has been tried at least once.
- [ ] The admin/superadmin list contains only people who should still have it:
      `select id, email, role from public.profiles where role in ('admin','superadmin');`

## 6. Incident log

Append one entry per incident, including near misses. Keep it in this file.

| Date became aware | What happened | Personal data breach? | Users affected | Board notified | Users notified | Closed |
| --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — | — |
