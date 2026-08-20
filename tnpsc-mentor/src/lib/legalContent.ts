// ─── Legal content — the single source of truth ─────────────────────────────
// Everything published at /privacy, /guidelines, /payment-policy,
// /refund-policy and /delete-account lives here, and `npm run legal:export`
// regenerates legal/*.md from it for the .docx merchant-onboarding pack.
//
// WHY ONE FILE: this app previously had two divergent policy sets — a thorough
// pair of drafts in legal/*.md that were never published, and a thinner version
// hard-coded in PolicyPage.tsx that was. The thin one is what users, stores and
// a consumer forum would actually have read. One source, one drift-free story.
//
// BEFORE PUBLISHING: every field in COMPANY marked TODO below is a fact only the
// operator or their advocate can supply. Unfilled ones render as an explicit
// "to be confirmed" rather than leaking a raw `[address]` placeholder onto a
// live page. See docs/LEGAL_HANDOFF.md.

/** Sentinel prefix for a fact that has not been supplied yet. */
const TODO = 'TODO:'

/** True when a COMPANY field is still a placeholder. */
export function needsInput(value: string): boolean {
  return value.startsWith(TODO)
}

/** Renders a placeholder honestly instead of printing the sentinel. */
export function show(value: string, fallback = 'to be confirmed'): string {
  return needsInput(value) ? fallback : value
}

/**
 * Operator identity and the facts every policy references.
 *
 * India's Consumer Protection (E-Commerce) Rules 2020 require a seller to
 * display its legal name, registered address and contact details; the IT Rules
 * 2021 and the DPDP Act require a named grievance contact. Both stores also ask
 * for a physical address on a paid app.
 */
export const COMPANY = {
  /** Registered legal name, exactly as on the GST/incorporation certificate. */
  legalName: 'Mohamed Riyaz (proprietor, Sirah Digital)',
  /** Brand shown to users. */
  tradeName: 'TNPSC Mentors',
  operator: 'Sirah Digital',
  /** Full registered address including PIN — printed on every policy page. */
  address:
    'SY NO 203/10B, Innov8, Featherlite The Address, 200 Feet Radial Rd, ' +
    'Raja Joseph Colony, Pallavaram, Chennai, Tambaram, Tamil Nadu',
  // NO GST FIELDS. Nothing is added to the displayed price, and with no GSTIN to
  // publish the Payment policy states the price is the total and says nothing
  // further about tax. If the business registers for GST, add `gstin` and
  // `gstTreatment` back here AND restore the two bullets in PAYMENT §4 — the
  // Consumer Protection (E-Commerce) Rules require a registered seller to
  // display its GSTIN.

  supportEmail: 'support@tnpscmentors.in',
  supportPhone: '+91 96777 79808',

  /** Grievance Officer — must be a real named person, not a role mailbox. */
  grievanceOfficerName: 'Mohamed Riyaz',
  grievanceEmail: 'support@tnpscmentors.in',
  /** Statutory acknowledgement window. 48 hours is the usual commitment. */
  grievanceAckHours: '48 hours',
  /** Statutory resolution window under the IT Rules. */
  grievanceResolveDays: '15 days',

  /** Courts with exclusive jurisdiction. Chennai — where the business is
   *  registered, which is also the default position without a clause. */
  jurisdictionCity: 'Chennai',
  /** Cap on aggregate liability. Deliberately a formula, not a figure, so it
   *  never goes stale when plan prices change. */
  liabilityCap: 'the amount you paid for the plan the claim relates to',

  /**
   * Where user data physically lives. Not a placeholder — this is a fact about
   * the deployment, and DPDP-era policies are expected to state it.
   */
  dataRegion: 'Sydney, Australia (AWS ap-southeast-2, via Supabase)',
  serverRegion: 'India',
} as const

/** Per-document effective dates. One shared date across five policies is a tell
 *  that they are not maintained independently. */
export const EFFECTIVE = {
  // Privacy + delete-account revised 5 August 2026: operator and Grievance
  // Officer named, purchase-record retention corrected (it does NOT survive
  // account deletion — the FK cascades), proctoring described as the on-device
  // count it actually is, and the analytics identifier, session IP/user-agent,
  // Google avatar, in-app feedback and new audit trail disclosed.
  privacy: '5 August 2026',
  guidelines: '3 August 2026',
  payment: '3 August 2026',
  refund: '3 August 2026',
  'delete-account': '5 August 2026',
} as const

export type Block = { h: string; p?: string[]; list?: string[] }

export interface LegalDoc {
  slug: string
  title: string
  intro: string
  blocks: Block[]
}

const E = COMPANY.supportEmail
const P = COMPANY.supportPhone

// ─── Privacy ────────────────────────────────────────────────────────────────

const PRIVACY: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  intro:
    `This Privacy Policy explains what ${COMPANY.tradeName} (operated by ${COMPANY.operator}, "we", "us") ` +
    'collects about you, why, where it is kept, and the choices and rights you have. It is written to ' +
    'meet India\'s Digital Personal Data Protection Act, 2023 (DPDP Act), under which we are the Data ' +
    'Fiduciary and you are the Data Principal.',
  blocks: [
    {
      h: '1. Who we are',
      list: [
        `Data Fiduciary: ${show(COMPANY.legalName)}, trading as ${COMPANY.tradeName}.`,
        `Registered address: ${show(COMPANY.address)}.`,
        `Contact: ${E} · ${P}.`,
        `Grievance Officer: see section 13.`,
      ],
    },
    {
      h: '2. What we collect',
      list: [
        'Details you give us at signup: name, email address, mobile number, preferred language and target exam group. Gender is optional. If you sign in with Google we also store the profile photo Google gives us, so it can be shown as your avatar.',
        'Your study plan, if you set one: your target exam date and your daily question goal.',
        'Your work in the app: tests attempted, answers selected, scores, time taken, bookmarks, revision decks, which questions you have already seen, and your daily activity and streak.',
        'Feedback you send us: the error reports you file on individual questions, your votes on whether an explanation helped, and any rating or message you submit from the app (including which screen you sent it from).',
        'Purchase records: which plan you bought, when, the amount, and the payment or order reference. We never see or store your card, UPI or bank credentials.',
        'Credit balance and history: the free-tier allowance granted at signup, the daily top-up, and what you have spent.',
        'Device and session data: a randomly generated installation identifier, a device label (e.g. "Android · Chrome"), and the IP address and browser/device identification string recorded against each of your active sign-ins. This is what enforces the 2-device limit and lets you recognise and sign out a device you do not know. It is not an advertising identifier, is not the IDFA or Android Advertising ID, and is never shared.',
        'Notification tokens, if you turn notifications on: the push token issued by your browser, or by Apple (APNs) or Google (FCM), and the browser identification string sent with it.',
        'Mock-test integrity signals, described in section 4.',
        'Technical and security logs: IP address, timestamps, which endpoint was called and its outcome, and error traces. Where an administrator opens or changes an account, we log who did it, whose account it was and when — see section 10.',
      ],
    },
    {
      h: '3. Tracking, advertising and profiling',
      p: [
        'The Android and iOS apps contain NO third-party advertising, analytics, attribution or tracking SDK of any kind. We do not track you across other companies\' apps or websites, we do not build advertising profiles, and we do not sell or share your personal data with data brokers or ad networks. This is why the iOS app shows no App Tracking Transparency prompt.',
        'The website (tnpscmentors.in) uses Google Analytics via Google Tag Manager, Microsoft Clarity and the Meta Pixel to understand how the site is used and to measure our own advertising. These load on the website only, and only after you accept them in the cookie banner. You can change or withdraw that choice at any time from the banner\'s "Cookie settings" link in the footer.',
        'When those tags are active and you are signed in, the events we send to Google and Meta carry your internal account identifier — a random code, not your name, email or phone — so that visits from the same account can be counted as one person rather than several. The events themselves describe what you did on the site: pages viewed, a test started or submitted and its score, a material downloaded, and a purchase with its amount and order reference. If you do not accept the cookie banner, none of this is sent.',
        'We do not carry out any automated decision-making that produces legal or similarly significant effects about you.',
      ],
    },
    {
      h: '4. Mock-test integrity (proctoring)',
      p: [
        'Full-length mock exams run in a supervised mode so that practice scores mean something. While a mock test is open the app counts when you leave the test screen — exiting full screen, switching tabs or apps — and also when you copy, paste or right-click inside the test. Repeated violations end and submit the test automatically.',
        'This count stays on your own device. It is shown to you on your result page and is then discarded; it is never sent to us, never stored on our servers, and never held against you. Nobody else sees it.',
        'On Android the app asks the operating system to block screenshots and screen recording during a test. On iOS the operating system provides no such block, so the app instead detects that a screenshot or screen recording occurred and records it as a violation, and blurs the app in the task switcher.',
        'This monitoring is limited to the mock-test screen, lasts only as long as that test, and captures nothing about what you do in other apps. No screen content, camera, microphone or location data is ever collected.',
      ],
    },
    {
      h: '5. Why we use it, and our legal basis',
      list: [
        'To provide the service you asked for — serving questions, grading on our server, saving progress, applying your entitlement. Basis: performance of our contract with you, and your consent given at signup.',
        'To personalise your preparation — revision decks, weak-area insights, recommended practice. Basis: consent.',
        'To keep accounts secure and enforce fair use — the 2-device limit, abuse detection, mock-test integrity. Basis: legitimate use for security and prevention of misuse.',
        'To communicate — service notices, and study notifications if you opt in. Basis: consent, withdrawable at any time.',
        'To take payment and meet tax obligations. Basis: contract and legal obligation.',
      ],
    },
    {
      h: '6. Who we share it with',
      p: [
        'We do not sell your personal data. We share it only with the processors that operate the product, each bound to use it solely to provide their service to us:',
      ],
      list: [
        'Supabase — database, authentication and file storage.',
        'Our hosting provider — the application server and content delivery.',
        'Razorpay — payments made on the website.',
        'Apple and Google — in-app purchases made in the iOS and Android apps, and push notification delivery.',
        'MSG91 and AiSensy — delivery of one-time codes by SMS and WhatsApp, where you use those sign-in or verification options. Telegram, if you choose it to verify your number.',
        'Google Analytics, Microsoft Clarity and Meta — website analytics and advertising measurement only, and only with your cookie consent. They receive the usage events and the pseudonymous account identifier described in section 3, never your name, email or phone number.',
      ],
    },
    {
      h: '7. Where your data is kept',
      p: [
        `Our database and file storage are hosted in ${COMPANY.dataRegion}. Our application server is in ${COMPANY.serverRegion}. Some processors listed above may process data in other countries.`,
        'This means personal data of Indian users is transferred outside India. The DPDP Act permits such transfers except to countries the Central Government restricts by notification; we transfer only to jurisdictions not so restricted, and our processors are contractually bound to protect the data to the standard described in this Policy.',
      ],
    },
    {
      h: '8. How long we keep it',
      list: [
        'Account and learning data — for as long as your account exists. Deleting your account removes it immediately (section 9).',
        'Purchase records — we keep the record of a purchase (the plan, amount, date and payment reference) only while your account exists. Delete your account and it goes with everything else; we do not keep a copy. The record of the transaction itself continues to exist with our payment provider and in our own accounts, which is where our tax and accounting obligations are met — that record is the provider\'s and ours, and is not part of your account.',
        'Technical and security logs — up to 90 days, then deleted.',
        'Records of administrative access — up to 400 days. These say which administrator opened or changed an account and when. They are deliberately kept beyond the ordinary log window, and they survive the deletion of the account they refer to: an accountability record that anyone could erase by deleting an account would be no accountability at all. They are used only to investigate misuse.',
        'Push notification tokens — until you turn notifications off, the token is rejected by Apple or Google, or you delete your account.',
        'Backups — our database provider keeps encrypted backups on a rolling schedule and overwrites them as they rotate. Deleted data disappears from the backups as the backups covering that period roll over, within 35 days at the outside.',
      ],
    },
    {
      h: '9. Deleting your account',
      p: [
        'You can delete your account and everything linked to it yourself, at any time, from Profile → Account → Delete account. Deletion is immediate and cannot be undone. If you cannot sign in, email us and we will verify ownership of the address and complete it within 7 working days. Full detail, including exactly what is and is not deleted, is on the "Delete account" page.',
      ],
    },
    {
      h: '10. Security',
      list: [
        'All traffic is encrypted in transit with TLS.',
        'Passwords are hashed by our authentication provider; nobody at our end can read them.',
        'Access to production data is restricted to the people who need it, and database access rules restrict every account to its own rows.',
        'Every administrative action on the service is written to an audit log that records who did it, whose account it concerned, when, and from where. That log cannot be edited or deleted from the app by anyone, including us.',
        'Sign-ins, failed sign-in attempts, password-reset requests and device changes are logged, so unusual access to an account can be found after the fact.',
        'Automated monitoring watches for the patterns an attack produces — bursts of failed sign-ins, probing of administrative routes, unusual error rates, unexpected privileged actions — and alerts us when one appears.',
        'The apps disable operating-system backup of local app data, so a signed-in session cannot be cloned onto another device from a cloud backup.',
        'A sign-in is limited to 2 devices at a time, and you can sign out a lost device yourself.',
      ],
      p: [
        'No system is perfectly secure. If a personal data breach occurs we will notify the Data Protection Board of India and every affected user without undue delay, as the DPDP Act requires, describing what happened, what data was involved and what you should do. Our internal procedure for this — including who is responsible and the deadlines we work to — is written down and followed rather than improvised.',
      ],
    },
    {
      h: '11. Your rights',
      list: [
        'Access — get a copy of the personal data we hold about you, and a summary of how it is processed.',
        'Correction and completion — fix your profile details in the app, or ask us.',
        'Erasure — delete your account and data yourself from Profile → Account.',
        'Withdraw consent — turn notifications off, change your cookie choice, or delete your account. Withdrawing does not affect processing already carried out.',
        'Nominate — nominate another person to exercise these rights on your behalf if you die or become incapacitated. Email us to register a nominee.',
        'Grievance — complain to our Grievance Officer (section 13), and if unsatisfied, to the Data Protection Board of India.',
      ],
    },
    {
      h: '12. Children',
      p: [
        'Under the DPDP Act a child is anyone under 18 years of age. This service is intended for candidates preparing for TNPSC examinations and is offered only to people aged 18 or over. You confirm you are 18 or older when you create an account.',
        'We do not knowingly collect personal data from anyone under 18. We do not track, monitor, profile or direct advertising at children. If you believe someone under 18 has created an account, contact our Grievance Officer and we will delete it.',
      ],
    },
    {
      h: '13. Grievance Officer',
      p: [
        'If you have a concern about how your personal data is handled, contact our Grievance Officer. We will acknowledge within ' +
          `${COMPANY.grievanceAckHours} and aim to resolve within ${COMPANY.grievanceResolveDays}.`,
      ],
      list: [
        `Name: ${show(COMPANY.grievanceOfficerName)}`,
        `Email: ${show(COMPANY.grievanceEmail, `to be confirmed — until then use ${E}`)}`,
        `Address: ${show(COMPANY.address)}`,
        'If you remain unsatisfied you may complain to the Data Protection Board of India.',
      ],
    },
    {
      h: '14. Changes',
      p: [
        'We may update this Policy. The effective date at the top changes with it, and for material changes we will give reasonable notice in the app or by email before they take effect.',
      ],
    },
  ],
}

// ─── Guidelines / Terms of Use ──────────────────────────────────────────────

const GUIDELINES: LegalDoc = {
  slug: 'guidelines',
  title: 'Terms of Use',
  intro:
    `These Terms govern your use of ${COMPANY.tradeName}, operated by ${show(COMPANY.legalName, COMPANY.operator)}. ` +
    'By creating an account or using the app or website you agree to them. If you do not agree, do not use the service.',
  blocks: [
    {
      h: '1. Eligibility',
      p: [
        'You must be 18 or older to use this service and to create an account. By registering you confirm that you are.',
      ],
    },
    {
      h: '2. Independence — no affiliation with TNPSC',
      p: [
        `${COMPANY.tradeName} is an independent examination-preparation product. It is NOT affiliated with, ` +
          'endorsed by, sponsored by, or connected in any way to the Tamil Nadu Public Service Commission ' +
          '(TNPSC), the Government of Tamil Nadu, or any government body. "TNPSC" is used only to describe ' +
          'the examinations this product helps you prepare for.',
        'We do not issue notifications, conduct examinations, declare results, or influence selection in any way. Always rely on the official TNPSC website for authoritative information.',
      ],
    },
    {
      h: '3. One account, your own',
      list: [
        'Create one account with accurate details and keep your login private. One mobile number and one email address may each be linked to only one account.',
        'Do not share, sell or transfer your account. A 2-device limit applies; you can sign out another device from your profile.',
        'You are responsible for everything done through your account.',
      ],
    },
    {
      h: '4. What the service includes',
      list: [
        'A free tier that runs on credits — an allowance granted when you sign up and a smaller daily top-up when you sign in. Practising a test spends credits in proportion to the number of questions.',
        'Paid plans that remove the credit limit and unlock the paid content, as described in the Payment Policy.',
        'Content and features change over time. We may add, alter or withdraw parts of the service, and will avoid doing so in a way that removes something you have already paid for within its access window.',
      ],
    },
    {
      h: '5. Fair use of content',
      list: [
        'Questions, explanations, mock tests and study material are licensed to you for your own personal exam preparation only.',
        'Do not copy, redistribute, resell, publish, bulk-download, screen-record or scrape the content, or use it to train a machine-learning model.',
        'Do not attempt to bypass grading, paywalls, the credit system or mock-test supervision.',
        'Breaching this section may lead to suspension without refund.',
      ],
    },
    {
      h: '6. Mock-test supervision',
      p: [
        'Full-length mock exams run in a supervised mode. Leaving the test screen is recorded, and repeated violations submit your test automatically. This is explained on the instructions screen before every test begins, and what is recorded is set out in section 4 of the Privacy Policy. Attempting to defeat it is a breach of section 5.',
      ],
    },
    {
      h: '7. Accuracy and no guarantee of results',
      p: [
        'We work hard to keep content accurate and aligned to the TNPSC pattern, and we correct errors you report. But questions, explanations and predictions are provided for practice only, we do not warrant that they are error-free or that any topic will appear in an examination, and WE DO NOT GUARANTEE ANY EXAMINATION RESULT, RANK OR SELECTION. Your preparation and outcome remain your own.',
      ],
    },
    {
      h: '8. Intellectual property',
      p: [
        'All content, software, design and branding in the service belong to us or our licensors and are protected by law. Past examination questions are reproduced for educational commentary and preparation; rights in the original papers remain with their owners. Nothing here transfers ownership to you.',
      ],
    },
    {
      h: '9. Your content and feedback',
      p: [
        'You keep ownership of anything you submit — error reports, feedback, messages. You grant us a licence to use it to operate and improve the service. Feedback may be used without obligation or payment to you.',
      ],
    },
    {
      h: '10. Third-party services',
      p: [
        'The service relies on third parties listed in the Privacy Policy. Their own terms apply to their part, and we are not responsible for their acts or omissions beyond our own duty to choose them with care.',
      ],
    },
    {
      h: '11. Apple App Store — additional terms',
      p: [
        'These Terms are between you and us only, not Apple, and Apple is not responsible for the app or its content. Apple has no obligation to provide any maintenance or support for the app.',
        'If the app fails to conform to any applicable warranty, you may notify Apple and Apple will refund the purchase price; to the maximum extent permitted by law Apple has no other warranty obligation. Apple is not responsible for addressing any claim by you or a third party relating to the app, including product liability, legal or regulatory non-compliance, or consumer protection claims.',
        'You confirm you are not located in a country subject to a U.S. Government embargo or designated a "terrorist supporting" country, and that you are not on any U.S. Government list of prohibited or restricted parties.',
        'Apple and its subsidiaries are third-party beneficiaries of these Terms and, upon your acceptance, will have the right to enforce them against you.',
      ],
    },
    {
      h: '12. Disclaimers and liability',
      p: [
        'The service is provided "as is" and "as available". To the maximum extent permitted by law we exclude implied warranties of merchantability, fitness for a particular purpose and non-infringement.',
        `To the maximum extent permitted by law, our aggregate liability arising out of or relating to the service is limited to ${show(COMPANY.liabilityCap)}. We are not liable for indirect, incidental, special or consequential loss, or for loss of opportunity, rank or selection.`,
        'Nothing in these Terms excludes liability that cannot be excluded under Indian law, including for fraud or for death or personal injury caused by negligence.',
      ],
    },
    {
      h: '13. Suspension and termination',
      p: [
        'We may suspend or terminate an account that breaches these Terms, is used fraudulently, or endangers the service or other users. Where a paid plan is terminated for breach, no refund is due. You may stop using the service and delete your account at any time.',
      ],
    },
    {
      h: '14. Governing law and disputes',
      p: [
        `These Terms are governed by the laws of India. The courts at ${show(COMPANY.jurisdictionCity)} have exclusive jurisdiction, subject to any right you have as a consumer to bring proceedings where you live.`,
        'Before starting proceedings, please contact our Grievance Officer — most issues are resolved that way.',
      ],
    },
    {
      h: '15. Changes and contact',
      p: [
        `We may update these Terms; the effective date changes with them and material changes are notified in advance. Questions: ${E} or ${P}.`,
      ],
    },
  ],
}

// ─── Payment ────────────────────────────────────────────────────────────────

const PAYMENT: LegalDoc = {
  slug: 'payment',
  title: 'Payment Policy',
  intro:
    'This Payment Policy explains what we sell, what it costs, how long access lasts, and how payment is ' +
    'taken. How you pay depends on where you are using the service — the website takes payment directly, ' +
    'while the Android and iOS apps must use the app stores\' own billing.',
  blocks: [
    {
      h: '1. The free tier and credits',
      list: [
        'You can use the service without paying. A free account is granted a starting balance of credits when you register, plus a smaller top-up each day you sign in. The daily top-up expires at the end of that day (Indian Standard Time); your starting balance does not.',
        'Starting a practice test spends one credit per question in it, so a longer test costs more than a shorter one. The cost is shown and confirmed before the test begins.',
        'Full-length mock exams are large enough that they are not normally affordable on the free tier.',
        'A paid plan removes the credit limit entirely.',
      ],
    },
    {
      h: '2. Paid plans',
      list: [
        'Premium — ₹1,699, valid for 180 days (6 months). Unlocks all paid content, including the Test Marathon papers.',
        'Vettri Nichayam (full) — ₹899, valid for 60 days. The 13-paper scheduled mock-exam programme, plus unlimited previous-year questions and current affairs.',
        'Vettri Nichayam (monthly) — ₹499, valid for 30 days. The first month of the same programme; pay again to continue into the second.',
        'Every plan is a one-time payment for a fixed period. Nothing auto-renews and no recurring mandate is created. When the period ends, access simply stops until you buy again.',
        'Access begins as soon as the payment is verified, and ends at the stated expiry.',
      ],
    },
    {
      h: '3. How you pay',
      list: [
        'On the website — Razorpay, using UPI, card, net banking or wallet. We receive the payment status and an order reference; we never see your card or UPI credentials.',
        'In the Android app — Google Play billing.',
        'In the iOS app — Apple App Store billing.',
        'The app stores require their own billing for digital content, so the in-app price is the one shown by Apple or Google, and it may differ slightly from the website price because of store price points and local taxes. The price shown to you before you confirm is always the price you pay.',
      ],
    },
    {
      h: '4. Prices and taxes',
      list: [
        // No GST line here by design: nothing is added to the displayed price at
        // checkout, so saying "the price is the price" is both accurate and the
        // only claim about tax status we can make without a GSTIN to publish. If
        // the business registers for GST later, this bullet and a GSTIN line
        // have to come back — the Consumer Protection (E-Commerce) Rules require
        // a registered seller to display it.
        'Prices are in Indian Rupees (₹). The price shown is the total amount payable — nothing is added at checkout.',
        'For purchases through Apple or Google, those companies act as the merchant of record for the transaction and apply tax according to their own rules; your receipt comes from them.',
        'We may change prices or offers at any time for future purchases. A purchase you have already completed is unaffected.',
      ],
    },
    {
      h: '5. Discount codes',
      list: [
        'On the website, promoter and discount codes are applied at checkout. The final price is always recalculated on our server and shown to you before you pay.',
        'In the apps, our own codes cannot be used — the stores require their own. Apple offer codes are redeemed from "Have a code?" on the plan card; Google Play codes are redeemed from "Redeem code" in the Play payment screen.',
        'Codes are non-transferable, have no cash value, and are subject to their own expiry and usage limits.',
      ],
    },
    {
      h: '6. Receipts and records',
      p: [
        'A record of every purchase is kept in your account. For website payments, Razorpay also emails a confirmation. For in-app purchases, Apple or Google issues the receipt and it appears in your App Store or Play purchase history.',
      ],
    },
    {
      h: '7. If money is deducted but access is not granted',
      p: [
        `This is rare and recoverable. In the apps, reopening the app usually completes it by itself; if not, use Profile → Account → Restore purchases. If access still does not appear, email ${E} with the payment or order reference, the amount and the date, and we will verify against the payment provider and activate it. See the Return & Cancellation Policy for refunds.`,
      ],
    },
  ],
}

// ─── Refund ─────────────────────────────────────────────────────────────────

const REFUND: LegalDoc = {
  slug: 'refund',
  title: 'Return & Cancellation Policy',
  intro:
    'This policy explains refunds and cancellations. Who processes a refund depends on where you bought: ' +
    'we handle website purchases ourselves, but purchases made inside the Android or iOS apps are refunded ' +
    'by Google or Apple under their own policies, because they, not we, took the payment.',
  blocks: [
    {
      h: '1. Digital content — the general rule',
      p: [
        'A paid plan unlocks digital content immediately. Once it is unlocked and the content has been accessed, the purchase is generally non-refundable, because digital content cannot be returned. A free tier exists so you can evaluate the app thoroughly before paying.',
      ],
    },
    {
      h: '2. Where to ask, depending on how you paid',
      list: [
        'Bought on the website (Razorpay) — contact us using section 5 below. We decide and process it.',
        'Bought in the iOS app — request the refund from Apple at reportaproblem.apple.com, or through your App Store purchase history. We cannot issue it; Apple took the payment and Apple decides.',
        'Bought in the Android app — request the refund from Google Play, or from Play\'s order history. Google decides. Where Google has already declined and you believe the outcome is wrong, contact us and we will look at whether we can help another way, such as restoring access.',
        'If you are unsure where you bought, check whether the receipt came from us and Razorpay, or from Apple or Google.',
      ],
    },
    {
      h: '3. When you are eligible (website purchases)',
      list: [
        'Duplicate payment — you were charged more than once for the same plan.',
        'Payment deducted but access not granted, and we cannot activate it within a reasonable time.',
        'A failed or erroneous transaction caused an incorrect charge.',
        'A significant, reproducible technical fault prevents access to the core paid content and we cannot resolve it within 7 days of you reporting it.',
      ],
    },
    {
      h: '4. When you are not eligible',
      list: [
        'Change of mind, or an accidental purchase, after the content has been accessed.',
        'Dissatisfaction with your own results or preparation — we do not guarantee outcomes.',
        'Problems caused by your device, operating system or internet connection.',
        'An account suspended or terminated for breaching the Terms of Use.',
        'Requests made after the window in section 5, except where the law requires otherwise.',
      ],
    },
    {
      h: '5. How to request (website purchases)',
      p: [
        `Email ${E}, or WhatsApp ${P}, within 7 days of the transaction, with: your registered name, the email or ` +
          'phone on the account, the payment or order reference, the date and amount, and the reason. We aim to ' +
          'decide within 7 business days and will tell you the outcome either way.',
      ],
    },
    {
      h: '6. How approved refunds are paid',
      list: [
        'To the original payment method, through Razorpay.',
        'Typically visible within 5–10 business days, depending on your bank or UPI provider.',
        'Limited to the amount actually paid. Discount codes have no independent cash value.',
        'Access to the paid content ends when a refund is issued.',
      ],
    },
    {
      h: '7. Cancellation',
      p: [
        'Every plan is a one-time purchase for a fixed period with no auto-renewal, so there is no subscription to cancel and nothing will be charged again. Access simply ends at the stated expiry. You can stop using the service, or delete your account, at any time.',
        'Deleting your account ends any active plan immediately and does not itself trigger a refund. If you think you are owed one, ask before deleting — once the account is gone we can no longer verify your entitlement.',
      ],
    },
    {
      h: '8. Grievances',
      p: [
        `If you are unhappy with a refund decision, escalate to our Grievance Officer, ${show(COMPANY.grievanceOfficerName)}, at ` +
          `${show(COMPANY.grievanceEmail, E)}. We acknowledge within ${COMPANY.grievanceAckHours} and aim to resolve within ` +
          `${COMPANY.grievanceResolveDays}.`,
      ],
    },
  ],
}

// ─── Delete account ─────────────────────────────────────────────────────────

const DELETE_ACCOUNT: LegalDoc = {
  slug: 'delete-account',
  title: 'Delete your account',
  intro:
    'You can permanently delete your account and the data associated with it at any time. Deletion is ' +
    'immediate and cannot be undone. This page is also the public deletion route required by Google Play, ' +
    'so it works without installing the app.',
  blocks: [
    {
      h: '1. Delete it yourself, in the app',
      list: [
        'Open the app (or tnpscmentors.in) and sign in.',
        'Go to Profile → Account.',
        'Tap "Delete account", type DELETE to confirm, and confirm again.',
        'Your account is removed straight away and you are signed out.',
      ],
    },
    {
      h: '2. Or ask us to delete it',
      p: [
        `If you cannot sign in, email ${E} from the address registered on the account, with the subject ` +
          '"Delete my account". We verify ownership of the address and complete the deletion within 7 working ' +
          'days, confirming by email when it is done.',
      ],
    },
    {
      h: '3. What gets deleted',
      list: [
        'Your profile: name, email, phone number, language, target group, gender, exam date, daily goal and profile photo.',
        'Your work: every test attempt, answer, score, bookmark, revision deck and progress record.',
        'Your credit balance and streak history.',
        'Your notification subscriptions and registered devices, and the sign-in sessions recorded against them.',
        'Question reports and feedback you submitted, and their link to you.',
        'Your purchase records — which plan you bought, when, the amount and the payment reference. We do not keep a copy after deletion.',
      ],
    },
    {
      h: '4. What we keep, and for how long',
      p: [
        'The record of a payment continues to exist with our payment provider (and in our own accounts), because that is where our tax and accounting obligations sit. That record belongs to the transaction, not to your account, and deleting your account does not and cannot remove it. If you need a copy of an invoice, ask us BEFORE deleting.',
        'Security logs are kept for up to 90 days, and records of administrative access — which administrator opened or changed an account, and when — for up to 400 days. These may still contain the internal identifier your account used. They are kept so that misuse can be investigated after the fact, which is only possible if deleting an account cannot erase the trail, and they are used for nothing else.',
        'Encrypted backups are overwritten on a rolling basis and deleted data is gone from them within 35 days at the outside.',
      ],
    },
    {
      h: '5. Paid plans and refunds',
      p: [
        'Deleting your account ends any active plan immediately and does NOT trigger a refund. If you believe you are owed one, read the Return & Cancellation Policy and contact support BEFORE deleting — once the account is gone we can no longer verify your entitlement.',
        'Purchases made through the App Store or Google Play are refunded by Apple or Google under their own policies, not by us.',
      ],
    },
  ],
}

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  privacy: PRIVACY,
  guidelines: GUIDELINES,
  payment: PAYMENT,
  refund: REFUND,
  'delete-account': DELETE_ACCOUNT,
}

export const LEGAL_NAV: { slug: string; label: string; path: string }[] = [
  { slug: 'privacy', label: 'Privacy', path: '/privacy' },
  { slug: 'guidelines', label: 'Terms of Use', path: '/guidelines' },
  { slug: 'payment', label: 'Payment', path: '/payment-policy' },
  { slug: 'refund', label: 'Refund & Cancellation', path: '/refund-policy' },
  { slug: 'delete-account', label: 'Delete account', path: '/delete-account' },
]

/** Every COMPANY fact still awaiting input — surfaced in dev so an unfilled
 *  policy cannot quietly reach production. */
export function outstandingCompanyFacts(): string[] {
  return Object.entries(COMPANY)
    .filter(([, v]) => typeof v === 'string' && needsInput(v))
    .map(([k, v]) => `${k}: ${(v as string).slice(TODO.length).trim()}`)
}
