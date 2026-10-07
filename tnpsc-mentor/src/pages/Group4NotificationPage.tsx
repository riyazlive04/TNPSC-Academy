import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  ExternalLink,
  FileText,
  GraduationCap,
  ListChecks,
  MapPin,
  Timer,
  Users,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useForceLightTheme } from '../hooks/useForceLightTheme'
import LandingLangPrompt, { useLandingLang } from '../components/Landing/LandingLangPrompt'
import {
  AnswerKeyFaqSection,
  AnswerKeyFeaturesSection,
  AnswerKeyFooter,
  AnswerKeyHeader,
  AnswerKeySidebarBox,
  AnswerKeyStickyBar,
  TNPSC_OFFICIAL_URL,
} from '../components/Landing/AnswerKeyChrome'
import { track, trackViewContent } from '../lib/tracking'
import { isAndroidWebView, openInBrowser } from '../lib/webview'
import {
  GROUP4,
  GROUP4_DATES,
  GROUP4_DOC_TITLE,
  GROUP4_FAQS,
  GROUP4_HERO_IMAGE,
  GROUP4_NOTIFICATION_PATH,
  GROUP4_ORIGIN,
  GROUP4_POST_GROUPS,
  GROUP4_UPDATED,
  applyWindowOpen,
  daysToApply,
  postsInBand,
  vacanciesInBand,
  type QualBand,
} from '../lib/group4Notification'

// ─── Bilingual copy ──────────────────────────────────────────────────────────
// The H1, the post names and the service names stay English in both languages:
// they are the exact phrases aspirants search, and the ones printed on the
// notification. Tamil: have a native speaker review before the next edit.
const T = {
  navVacancies: { ta: 'காலியிடங்கள்', en: 'Vacancies' },
  navFeatures: { ta: 'வசதிகள்', en: 'Features' },
  navFaq: { ta: 'கேள்வி-பதில்', en: 'FAQ' },
  openApp: { ta: 'App-ஐ திற', en: 'Open App' },
  otherLang: { ta: 'English', en: 'தமிழ்' },
  otherLangAria: { ta: 'Read in English', en: 'தமிழில் படிக்க' },

  byline: { ta: 'TNPSC Mentors · புதுப்பிக்கப்பட்டது', en: 'TNPSC Mentors · Updated' },

  heroTitle: {
    ta: 'TNPSC குரூப் 4 அறிவிப்பு 2026: 6,574 காலியிடங்கள்',
    en: 'TNPSC Group 4 Notification 2026: 6,574 Vacancies Announced',
  },
  heroLead: {
    ta: 'தமிழ்நாடு அரசுப் பணியாளர் தேர்வாணையம் 06.10.2026 அன்று குரூப் 4 அறிவிப்பை (விளம்பர எண் 747, அறிவிப்பு எண் 11/2026) வெளியிட்டுள்ளது — 26 துறைகளில் 46 பணியிடங்களுக்கு மொத்தம் 6,574 காலியிடங்கள். விண்ணப்பம் 06.10.2026 முதல் 05.11.2026 வரை, ஆன்லைனில் மட்டும்.',
    en: 'The Tamil Nadu Public Service Commission has released the TNPSC Group 4 notification 2026 (Advertisement No. 747, Notification No. 11/2026) on 6 October 2026, announcing 6,574 vacancies across 46 posts in 26 services, corporations and boards. Applications are open online only, from 6 October 2026 to 5 November 2026.',
  },
  heroLead2: {
    ta: 'பெரும்பாலான பணியிடங்களுக்கு SSLC (10ஆம் வகுப்பு) தேர்ச்சி மட்டுமே தேவை — தமிழ்நாடு அரசுப் பணிக்கான மிகப்பெரிய நுழைவாயில் இதுவே. எழுத்துத் தேர்வு ஒரே கட்டம்: 200 வினாக்கள், 300 மதிப்பெண்கள், OMR முறையில், 10.01.2027 அன்று.',
    en: 'Most Group 4 posts need only a pass in SSLC (10th standard), which makes this the single largest entry point into Tamil Nadu government service. The written examination is a single-stage, 200-question OMR paper worth 300 marks, on 10 January 2027 from 9.30 A.M. to 12.30 P.M.',
  },
  heroCtaPractice: { ta: 'இலவசமாகப் பயிற்சி தொடங்கு', en: 'Start free practice' },
  heroCtaOfficial: { ta: 'அதிகாரப்பூர்வ அறிவிப்பு', en: 'Official notification' },

  countdownDays: { ta: 'நாட்கள் மீதம் — விண்ணப்பிக்க', en: 'days left to apply' },
  countdownClosed: { ta: 'விண்ணப்ப காலம் முடிந்தது', en: 'Applications have closed' },

  glanceTitle: { ta: 'ஒரே பார்வையில்', en: 'TNPSC Group 4 2026 at a Glance' },
  glanceVacancies: { ta: 'மொத்த காலியிடங்கள்', en: 'Total vacancies' },
  glancePosts: { ta: 'பணியிடங்கள்', en: 'Number of posts' },
  glanceQual: { ta: 'குறைந்தபட்சத் தகுதி', en: 'Minimum qualification' },
  glanceQualVal: { ta: 'SSLC (10ஆம் வகுப்பு)', en: 'SSLC (10th pass)' },
  glanceExam: { ta: 'தேர்வு தேதி', en: 'Exam date' },
  glanceExamVal: { ta: '10.01.2027 · காலை 9.30 – மதியம் 12.30', en: '10.01.2027 · 9.30 AM to 12.30 PM' },
  glanceFee: { ta: 'தேர்வுக் கட்டணம்', en: 'Application fee' },
  glanceFeeVal: { ta: '₹100 (விலக்கு உண்டு)', en: '₹100 (concession available)' },
  glanceMode: { ta: 'தேர்வு முறை', en: 'Exam mode' },
  glanceModeVal: { ta: 'OMR · ஒரே தாள் · 200 வினா / 300 மதிப்பெண்', en: 'OMR · single paper · 200 Q / 300 marks' },
  glanceApply: { ta: 'விண்ணப்பிக்க', en: 'Apply at' },

  datesTitle: { ta: 'முக்கிய தேதிகள்', en: 'TNPSC Group 4 Important Dates 2026-27' },
  colEvent: { ta: 'நிகழ்வு', en: 'Event' },
  colDate: { ta: 'தேதி', en: 'Date' },
  colTime: { ta: 'நேரம்', en: 'Time' },
  datesNote: {
    ta: 'திருத்தக் காலம் மூன்று நாட்கள் மட்டுமே. 11.11.2026-க்குப் பிறகு விண்ணப்பத்தில் எந்த மாற்றமும் செய்ய முடியாது.',
    en: 'The correction window is open for three days only. After 11 November 2026, no modification of any kind is allowed in the online application.',
  },

  vacTitle: { ta: 'குரூப் 4 காலியிடங்கள் 2026 — முழுப் பட்டியல்', en: 'TNPSC Group 4 Vacancy 2026: Full Post-Wise List' },
  vacLead: {
    ta: '6,574 காலியிடங்கள் 46 பணியிடங்களாகப் பிரிக்கப்பட்டுள்ளன. இதில் பாதிக்கும் மேல் Junior Assistant பிரிவில் — தமிழ்நாடு அமைச்சுப் பணியில் மட்டும் 2,610 Junior Assistant (Non Security) இடங்கள், இந்த அறிவிப்பிலேயே ஒரே பணியிடத்தில் அதிகபட்சம்.',
    en: 'The 6,574 vacancies are spread across 46 distinct posts. The Junior Assistant cadre alone accounts for over half of them, led by 2,610 Junior Assistant (Non Security) posts in the Tamil Nadu Ministerial Service — the largest single-post vacancy in this notification.',
  },
  filterLabel: { ta: 'தகுதி வாரியாக வடிகட்டு', en: 'Filter by qualification' },
  bandAll: { ta: 'அனைத்தும்', en: 'All posts' },
  bandSslc: { ta: 'SSLC மட்டும்', en: 'SSLC only' },
  bandHsc: { ta: '+2 / HSC', en: 'HSC / +2' },
  bandDegree: { ta: 'பட்டப்படிப்பு', en: 'Degree' },
  colSNo: { ta: 'எண்', en: 'S.No' },
  colPost: { ta: 'பணியிடம்', en: 'Post' },
  colCode: { ta: 'குறியீடு', en: 'Code' },
  colService: { ta: 'துறை / நிறுவனம்', en: 'Service / Organisation' },
  colVac: { ta: 'இடங்கள்', en: 'Vacancies' },
  colPay: { ta: 'ஊதிய நிலை', en: 'Pay Level' },
  vacTotal: { ta: 'மொத்தம்', en: 'Total' },
  vacShown: { ta: 'காட்டப்படுவது', en: 'Showing' },
  vacTentative: {
    ta: 'அறிவிக்கப்பட்ட காலியிடங்கள் தற்காலிகமானவை; கலந்தாய்வு தொடங்கும் முன் மாறலாம். துறை வாரியான பகிர்வு பின்னர் அறிவிக்கப்படும்.',
    en: 'The number of vacancies notified is tentative and is liable for modification before the start of counselling. The department- and unit-wise distribution will be announced later by the Commission.',
  },
  groupsTitle: { ta: 'பிரிவு வாரியாக', en: 'Vacancies by post group' },

  eligTitle: { ta: 'தகுதி விவரங்கள்', en: 'TNPSC Group 4 Eligibility 2026' },
  eligQualTitle: { ta: 'கல்வித் தகுதி', en: 'Educational Qualification' },
  eligQualBody: {
    ta: 'குறைந்தபட்சப் பொதுக் கல்வித் தகுதி என்பது தமிழ்நாடு SSLC (10ஆம் வகுப்பு) தேர்ச்சி. VAO, Junior Assistant, Bill Collector, Tax Collector உள்ளிட்ட பெரும்பாலான பணியிடங்களுக்கு இதுவே போதும். Typist / Steno Typist பணியிடங்களுக்கு தட்டச்சு / சுருக்கெழுத்து அரசுத் தொழில்நுட்பத் தேர்வுத் தேர்ச்சியும், சில கழகப் பணியிடங்களுக்கு பட்டப்படிப்பும் தேவை. தகுதிகள் அனைத்தும் அறிவிப்பு நாளான 06.10.2026 அன்றே இருக்க வேண்டும்.',
    en: 'The minimum general educational qualification is a pass in the SSLC (10th standard) examination of Tamil Nadu, and this covers the majority of posts including VAO, Junior Assistant, Bill Collector and Tax Collector. Typist and Steno Typist posts additionally need Government Technical Examination passes in Typewriting and / or Shorthand. A smaller set of corporation posts requires a degree. All qualifications must be held on the notification date, 6 October 2026.',
  },
  eligAgeTitle: { ta: 'வயது வரம்பு (01.07.2026 அன்று)', en: 'Age Limit as on 01.07.2026' },
  eligAgeBody: {
    ta: 'SC, SC(A), ST, MBC/DC, BC(OBCM), BCM அல்லாதவர்களுக்கு பொதுவாக 18–30 வயது (VAO மற்றும் வனப் பணியிடங்களுக்கு 21–30; Executive Officer-க்கு குறைந்தபட்சம் 25). இட ஒதுக்கீட்டுப் பிரிவினருக்கு BC(OBCM), BCM, MBC/DC — 32; SC, SC(A), ST — 35; VAO-க்கு 40. மாற்றுத் திறனாளிகள், முன்னாள் படைவீரர்கள் (48 / 53), ஆதரவற்ற விதவைகளுக்கு வயது தளர்வு உண்டு. 11 கழக / வாரியப் பணியிடங்களுக்கு அதிகபட்ச வயது வரம்பே இல்லை.',
    en: 'For candidates not belonging to SCs, SC(A)s, STs, MBCs/DCs, BC(OBCM)s and BCMs, the usual range is 18 to 30 years (21 to 30 for VAO and the Forest posts; minimum 25 for Executive Officer). For the reserved communities the maximum is 32 years for BC(OBCM)s, BCMs and MBCs/DCs and 35 years for SCs, SC(A)s and STs; for VAO it is 40. Concessions extend the limit for persons with benchmark disability, ex-servicemen (up to 48 / 53) and destitute widows. Eleven corporation and board posts carry no maximum age limit at all.',
  },
  eligTamilTitle: { ta: 'தமிழ் அறிவு', en: 'Knowledge in Tamil' },
  eligTamilBody: {
    ta: 'அறிவிப்பு நாளன்று போதிய தமிழ் அறிவு இருக்க வேண்டும்: SSLC / HSC / பட்டப்படிப்பில் தமிழ் ஒரு பாடமாக, அல்லது உயர்நிலைப் படிப்பு தமிழ் வழியில், அல்லது TNPSC நடத்தும் இரண்டாம் வகுப்பு மொழித் தேர்வில் (முழுத் தேர்வு) தேர்ச்சி. ஆதாரம் தர இயலாதவர்கள் பணி நியமனத்திலிருந்து இரண்டு ஆண்டுகளுக்குள் அத்தேர்வில் தேர்ச்சி பெற வேண்டும்.',
    en: 'Candidates must possess adequate knowledge of Tamil as on the notification date: SSLC / HSC / Degree with Tamil as one of the languages, or High School studied in Tamil medium, or a pass in the TNPSC Second Class Language Test (Full Test) in Tamil. Candidates who cannot produce proof must clear that test within two years of appointment.',
  },

  patternTitle: { ta: 'தேர்வு முறை', en: 'TNPSC Group 4 Exam Pattern 2026' },
  patternLead: {
    ta: 'ஒரே கட்ட எழுத்துத் தேர்வு — OMR முறையில் ஒரே புறநிலைத் தாள்: 200 வினாக்கள், 300 மதிப்பெண்கள், 3 மணி நேரம்.',
    en: 'The Group 4 exam is a single-stage written examination in OMR mode — one objective paper of 200 questions, 300 marks and 3 hours.',
  },
  colPart: { ta: 'பகுதி', en: 'Part' },
  colSubject: { ta: 'பாடம்', en: 'Subject' },
  colQuestions: { ta: 'வினாக்கள்', en: 'Questions' },
  colMarks: { ta: 'மதிப்பெண்', en: 'Marks' },
  partBcMarks: { ta: '150 (B + C சேர்ந்து)', en: '150 (B + C combined)' },
  gateTitle: { ta: 'மிக முக்கியமான விதி', en: 'The single most important rule' },
  gateBody: {
    ta: 'பகுதி A-ல் குறைந்தபட்சம் 60 மதிப்பெண் (40%) பெற்றால் மட்டுமே பகுதி B, C திருத்தப்படும். பகுதி A வினாக்கள் தமிழில் மட்டும்; பகுதி B, C தமிழ் & English இரண்டிலும். தகுதி பெற்றவர்களுக்கு மூன்று பகுதிகளின் மொத்த மதிப்பெண்ணே தரவரிசைக்கு எடுத்துக்கொள்ளப்படும் — எனவே தமிழ்த் தாள் ஒரு வாயிலும் கூட, மதிப்பெண் பெறும் வாய்ப்பும் கூட.',
    en: 'Part B and Part C are evaluated only if you score at least 60 marks (40%) in Part A. Part A questions are set in Tamil only; Part B and Part C are set in both Tamil and English. Candidates who clear the Part A gate are ranked on the combined total of all three parts, so the Tamil paper is both a gate and a scoring opportunity.',
  },
  patternDa: {
    ta: 'வாரியம் / பல்கலைக்கழக அளவில் English மட்டும் பயின்ற மாற்றுத் திறனாளிகள், தமிழ்த் தாளுக்குப் பதிலாக General English (SSLC நிலை) எழுதலாம் — அதே 40% தகுதி மதிப்பெண்ணுடன், இயலாமைச் சான்றிதழை விண்ணப்பத்துடன் பதிவேற்றினால்.',
    en: 'Differently abled candidates who studied only English at Board or University level may opt for General English (SSLC standard) in place of the Tamil paper, with the same 40% qualifying requirement, provided the Certificate of Disability is uploaded with the application.',
  },

  selectionTitle: { ta: 'தேர்வு நடைமுறை', en: 'TNPSC Group 4 Selection Process' },
  selectionNote: {
    ta: 'சமமான மதிப்பெண் எனில்: உயர் கல்வித் தகுதி → உயர் தொழில்நுட்பத் தகுதி → வயது மூத்தவர் → முந்தைய விண்ணப்ப எண் என்ற வரிசையில் தரவரிசை முடிவு செய்யப்படும்.',
    en: 'Ties are broken by higher educational qualification, then higher technical qualification where prescribed, then age seniority, then the earlier application number.',
  },

  centresTitle: { ta: 'தேர்வு மையங்கள் — 38 மாவட்டங்களிலும்', en: 'Exam Centres: All 38 Districts' },
  centresBody: {
    ta: 'தமிழ்நாட்டின் 38 மாவட்டங்களிலும் தாலுகா அளவிலான மையங்களில் தேர்வு நடைபெறும். விண்ணப்பத்தில் இரண்டு மையங்களைத் தேர்ந்தெடுக்கலாம்; அவற்றில் ஒன்றில் இடம் ஒதுக்கப்படும். மாற்றுத் திறனாளிகள் ஒரு மையத்தை மட்டும் தேர்ந்தெடுப்பர். ஒதுக்கப்பட்ட பிறகு மையம் மாற்றக் கோரிக்கை ஏற்கப்படாது.',
    en: 'The written examination will be held at taluk-level centres across all 38 districts of Tamil Nadu. Candidates may choose two preferred centres and will be allotted a venue in one of them; candidates with benchmark disability choose one centre. Requests to change the examination centre are not permitted after allotment.',
  },

  applyTitle: { ta: 'எப்படி விண்ணப்பிப்பது', en: 'How to Apply for TNPSC Group 4 2026' },
  feeTitle: { ta: 'தேர்வுக் கட்டணம்', en: 'Application Fee' },
  feeBody: {
    ta: 'தேர்வுக் கட்டணம் ₹100 — Net Banking, Credit Card, Debit Card அல்லது UPI வழியாக ஆன்லைனில் மட்டும். Demand Draft / Postal Order ஏற்கப்படாது. சிறப்புப் பிரிவினர் கட்டண விலக்கு கோரலாம்; ஆனால் ஒவ்வொரு கோரிக்கையும் ஒரு இலவச வாய்ப்பைக் குறைக்கும், மேலும் Yes / No தேர்வை சமர்ப்பித்த பின் மாற்ற முடியாது.',
    en: 'The examination fee is ₹100, payable online by Net Banking, Credit Card, Debit Card or UPI. Offline payment by Demand Draft or Postal Order is not accepted. Candidates in special categories may claim a fee concession — but each claim consumes one free chance, and the Yes / No choice cannot be edited after submission.',
  },

  ctaTitle: { ta: 'இன்றே தயாரிப்பைத் தொடங்குங்க', en: 'Start Your Group 4 Preparation Today' },
  ctaHook: { ta: '6,574 காலியிடங்கள். ஒரே தாள். 10 ஜனவரி 2027.', en: '6,574 vacancies. One paper. 10 January 2027.' },
  ctaBody: {
    ta: 'தமிழ்ப் பகுதியில் 40% வாயிலைத் தாண்டி, 1:3 சுருக்கப்பட்ட பட்டியலில் இடம்பிடிக்கும் மதிப்பெண்ணை உருவாக்க உங்களுக்கு இருப்பது சில மாதங்களே. லட்சக்கணக்கானோர் விண்ணப்பிப்பார்கள் — தரவரிசையை முடிவு செய்வது General Studies & Aptitude-ல் உள்ள சில மதிப்பெண்களே.',
    en: 'That gives you around three months to clear the Tamil 40% gate and build a score good enough to survive a 1:3 shortlist. Lakhs of aspirants will apply for these posts — the merit list is decided by a handful of marks in General Studies and Aptitude.',
  },
  ctaB1: { ta: 'முந்தைய ஆண்டு வினாத்தாள்கள் — ஒவ்வொரு வினாவுக்கும் இருமொழி விளக்கத்துடன்', en: 'Previous year question papers from every past Group 4 paper, with full bilingual explanations' },
  ctaB2: { ta: 'உண்மையான 200-வினா OMR தாள் போன்ற முழு நீள மாதிரித் தேர்வுகள்', en: 'Full-length mock tests that mirror the real 200-question, 3-hour OMR paper' },
  ctaB3: { ta: 'General Studies & Aptitude பாட வாரியான பயிற்சி — பலவீனப் பகுதி பகுப்பாய்வுடன்', en: 'Topic-wise practice across General Studies and Aptitude, with instant weak-area analysis' },
  ctaB4: { ta: 'தினசரி நடப்பு நிகழ்வுகள் — தமிழ் & English-ல், தினமும் காலையில்', en: 'Daily current affairs in Tamil and English, updated every morning' },
  ctaPrimary: { ta: 'இலவசப் பயிற்சியைத் தொடங்கு', en: 'Start free practice now' },
  ctaSecondary: { ta: 'குரூப் 4 PYQ-க்களைப் பார்', en: 'See Group 4 previous year questions' },
  heroImageAlt: {
    ta: 'TNPSC குரூப் 4 (Group IV) 2026 அறிவிப்பு — 6,574 காலியிடங்கள், 46 பணியிடங்கள்; விண்ணப்பம் 06.10.2026 முதல் 05.11.2026 வரை; தேர்வு 10.01.2027, காலை 9.30 முதல் மதியம் 12.30 வரை',
    en: 'TNPSC Group IV 2026 notification, important dates and vacancies — 6,574 vacancies across 46 posts; applications 06.10.2026 to 05.11.2026; correction window 09.11.2026 to 11.11.2026; exam 10.01.2027, 9.30 AM to 12.30 PM',
  },
  ctaFinePrint: {
    ta: 'தொடங்க இலவசம். பயிற்சி தொடங்க எந்தக் கட்டணமும் இல்லை. Web மற்றும் Android-ல் கிடைக்கிறது.',
    en: 'Free to start. No payment needed to begin practising. Available on web and Android.',
  },

  featuresTitle: { ta: 'TNPSC Mentors-ல் என்ன இருக்கு', en: "What's inside TNPSC Mentors" },
  faqTitle: { ta: 'அடிக்கடி கேட்கப்படும் கேள்விகள்', en: 'TNPSC Group 4 2026 FAQs' },

  disclaimerTitle: { ta: 'கவனிக்க', en: 'Please note' },
  disclaimer: {
    ta: 'இப்பக்கத்தின் தகவல்கள் TNPSC விளம்பர எண் 747, அறிவிப்பு எண் 11/2026 (06.10.2026) ஆகியவற்றிலிருந்து தொகுக்கப்பட்டவை. ஏதேனும் வேறுபாடு இருந்தால் tnpsc.gov.in-ல் உள்ள அதிகாரப்பூர்வ அறிவிப்பே இறுதியானது.',
    en: 'The details on this page are compiled from TNPSC Advertisement No. 747, Notification No. 11/2026 dated 06.10.2026. Where this page and the official notification differ, the notification on tnpsc.gov.in is final.',
  },

  sidebarLinksTitle: { ta: 'தொடர்புடைய இணைப்புகள்', en: 'Related Links' },
  linkArchive4_2025: { ta: 'குரூப் 4 2025 வினாத்தாள்', en: 'Group 4 2025 Question Paper' },
  linkArchive4_2024: { ta: 'குரூப் 4 2024 வினாத்தாள்', en: 'Group 4 2024 Question Paper' },
  linkArchiveAll: { ta: 'அனைத்து முந்தைய ஆண்டு வினாத்தாள்கள்', en: 'All Past Question Papers' },
  linkPyq4: { ta: 'குரூப் 4 PYQ (App)', en: 'Group 4 Previous Year Questions (App)' },
  linkKey4: { ta: 'குரூப் 4 விடைக்குறிப்பு 2026', en: 'Group 4 Answer Key 2026' },
  linkPyq2: { ta: 'குரூப் 2 PYQ', en: 'Group 2 Previous Year Questions' },
  linkPyq1: { ta: 'குரூப் 1 PYQ', en: 'Group 1 Previous Year Questions' },
  linkMaterials: { ta: 'படிப்புப் பொருட்கள்', en: 'Study Materials' },
  sidebarStartTitle: { ta: 'இலவசமாகத் தொடங்குங்க', en: 'Start free' },
  sidebarStartBody: {
    ta: 'மாதிரித் தேர்வுகள், PYQ, தினசரி நடப்பு நிகழ்வுகள் — TNPSC Mentors-ல்.',
    en: 'Mock tests, PYQ, daily current affairs — all on TNPSC Mentors.',
  },
  ctaAppAuthed: { ta: 'என் Dashboard-க்கு செல்', en: 'Go to my dashboard' },
  ctaApp: { ta: 'இலவசக் கணக்கு', en: 'Free account' },

  footerTagline: {
    ta: 'TNPSC குரூப் 1, 2 & 4 தயாரிப்புக்கான இருமொழிப் பயிற்சித் தளம்.',
    en: 'A bilingual practice platform for TNPSC Group 1, 2 and 4 preparation.',
  },
  footerFollow: { ta: 'பின்தொடரவும்', en: 'Follow us' },
  footerDisclaimer: {
    ta: 'TNPSC Mentors ஒரு தனியார் பயிற்சித் தளம்; தமிழ்நாடு அரசுப் பணியாளர் தேர்வாணையத்துடன் தொடர்பில்லை.',
    en: 'TNPSC Mentors is an independent practice platform and is not affiliated with the Tamil Nadu Public Service Commission.',
  },
} as const

type CopyKey = keyof typeof T

const BANDS: { key: QualBand; label: CopyKey }[] = [
  { key: 'all', label: 'bandAll' },
  { key: 'sslc', label: 'bandSslc' },
  { key: 'hsc', label: 'bandHsc' },
  { key: 'degree', label: 'bandDegree' },
]

// robots.txt disallows /test-arena, so every link that pointed there was a
// dead end for a crawler: good for a signed-in reader, worth nothing to the
// page. The archive pages below are public, indexable and about Group 4.
const SIDEBAR_LINKS: { href: string; label: CopyKey }[] = [
  { href: '/questions/past-papers/group-4-2025/', label: 'linkArchive4_2025' },
  { href: '/questions/past-papers/group-4-2024/', label: 'linkArchive4_2024' },
  { href: '/tnpsc-group-4-answer-key-2026', label: 'linkKey4' },
  { href: '/questions/past-papers/', label: 'linkArchiveAll' },
  { href: '/test-arena/pyq/group4', label: 'linkPyq4' },
  { href: '/materials', label: 'linkMaterials' },
]

// The four semantic tiles from design-system.md, rotated one per section.
const TINTS = [
  { bg: 'bg-tint-violet', fg: 'text-brand' },
  { bg: 'bg-tint-coral', fg: 'text-accent' },
  { bg: 'bg-tint-blue', fg: 'text-sky' },
  { bg: 'bg-tint-green', fg: 'text-correct' },
] as const

const num = (n: number) => n.toLocaleString('en-IN')

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Group4NotificationPage() {
  const { isAuthenticated } = useAuth()
  useForceLightTheme()
  const [lang, setLang, langChosen] = useLandingLang()
  const t = (key: CopyKey): string => T[key][lang]

  const [band, setBand] = useState<QualBand>('all')
  const posts = useMemo(() => postsInBand(band), [band])
  const shown = useMemo(() => vacanciesInBand(band), [band])

  // Read once per mount: the deadline is months out, so a ticking clock would
  // only cost renders. A visitor who leaves the tab open overnight sees a
  // day-stale number, which is fine for a countdown measured in weeks.
  const now = useMemo(() => Date.now(), [])
  const daysLeft = daysToApply(now)
  const open = applyWindowOpen(now)

  useEffect(() => {
    trackViewContent({ contentName: 'Group4Notification2026', contentCategory: 'landing' })
  }, [])

  useEffect(() => {
    document.title = GROUP4_DOC_TITLE
    // The short links render this page too, and index.html's canonical names
    // whatever path the visitor arrived on — point it at the one URL.
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', GROUP4_ORIGIN + GROUP4_NOTIFICATION_PATH)
  }, [])

  useEffect(() => {
    const el = document.documentElement
    const prev = el.lang
    el.lang = lang === 'ta' ? 'ta' : 'en'
    return () => {
      el.lang = prev
    }
  }, [lang])

  const appHref = isAuthenticated ? '/test-arena' : '/register'
  // Instagram / Facebook in-app browsers cannot run Google Sign-In, so a guest
  // there is handed to the real browser at the tap (same as /group-1).
  const onAppClick = (e: MouseEvent<HTMLAnchorElement>, source: string) => {
    track('group4_notification_open_app', { source })
    if (!isAuthenticated && isAndroidWebView) {
      e.preventDefault()
      openInBrowser('/register')
    }
  }
  const appLabel = isAuthenticated ? t('ctaAppAuthed') : t('ctaApp')

  return (
    <div id="top" className="min-h-screen overflow-x-clip bg-surface pb-24 sm:pb-0">
      <AnswerKeyHeader
        onToggleLang={() => setLang(lang === 'ta' ? 'en' : 'ta')}
        copy={{
          navAnswerKey: t('navVacancies'),
          navFeatures: t('navFeatures'),
          navFaq: t('navFaq'),
          openApp: t('openApp'),
          otherLang: t('otherLang'),
          otherLangAria: t('otherLangAria'),
        }}
        appHref={appHref}
        onAppClick={onAppClick}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:grid lg:grid-cols-[1fr,300px] lg:items-start lg:gap-10">
        <div className="min-w-0">
          {/* ─── Hero ─────────────────────────────────────────────────────── */}
          <section className="rounded-card border border-line bg-card p-4 shadow-soft sm:p-6">
          <span className="tamil inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 font-heading text-xs font-bold text-white">
            <CalendarDays size={13} /> {GROUP4.notification.notificationNo} · {GROUP4_DATES[0].displayDate}
          </span>

          <h1 className="mt-3 font-heading text-[1.5rem] font-extrabold leading-[1.25] tracking-tight text-ink [text-wrap:balance] sm:text-[2rem]">
            {t('heroTitle')}
          </h1>
          <p className="tamil mt-2 font-body text-xs font-medium text-ink2">
            {t('byline')}: {GROUP4_UPDATED}
          </p>

          {GROUP4_HERO_IMAGE && (
            <div className="mt-5 overflow-hidden rounded-field border border-line">
              <img
                src={GROUP4_HERO_IMAGE}
                alt={t('heroImageAlt')}
                width={1400}
                height={788}
                className="block w-full"
                // The hero IS the LCP element: fetch it ahead of the lazy route
                // chunks rather than letting it arrive after first paint.
                loading="eager"
                fetchPriority="high"
                decoding="async"
                // A missing file must not leave a broken-image icon under the
                // H1: drop the frame instead.
                onError={(e) => {
                  const frame = e.currentTarget.parentElement
                  if (frame) frame.style.display = 'none'
                }}
              />
            </div>
          )}

          <p className="tamil mt-5 font-body text-[15px] leading-relaxed text-ink2">{t('heroLead')}</p>
          <p className="tamil mt-3 font-body text-[15px] leading-relaxed text-ink2">{t('heroLead2')}</p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={appHref}
              onClick={(e) => onAppClick(e, 'hero')}
              className="btn-wrap btn-brand tamil min-h-[48px] justify-center px-6 text-sm shadow-lg shadow-brand/25 sm:w-auto"
            >
              {t('heroCtaPractice')} <ArrowRight size={16} className="shrink-0" />
            </a>
            <a
              href={GROUP4.notification.applyUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn-wrap btn-ghost tamil min-h-[48px] justify-center px-6 text-sm sm:w-auto"
            >
              {t('heroCtaOfficial')} <ExternalLink size={15} className="shrink-0" />
            </a>
          </div>

          {open && (
            <p className="tamil mt-4 inline-flex items-center gap-2 rounded-field bg-tint-coral px-3 py-2 font-heading text-sm font-bold text-accent">
              <Timer size={15} /> {num(daysLeft)} {t('countdownDays')}
            </p>
          )}
          </section>

          {/* ─── At a glance ──────────────────────────────────────────────── */}
          <Section id="glance" icon={ListChecks} title={t('glanceTitle')} tint={TINTS[0]}>
            <dl className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2">
              {[
                { k: t('glanceVacancies'), v: num(GROUP4.summary.totalVacancies) },
                { k: t('glancePosts'), v: String(GROUP4.summary.totalPosts) },
                { k: t('glanceQual'), v: t('glanceQualVal') },
                { k: t('glanceExam'), v: t('glanceExamVal') },
                { k: t('glanceMode'), v: t('glanceModeVal') },
                { k: t('glanceFee'), v: t('glanceFeeVal') },
              ].map((row) => (
                <div key={row.k} className="bg-card px-4 py-3">
                  <dt className="tamil font-body text-xs font-medium text-ink2">{row.k}</dt>
                  <dd className="tamil mt-0.5 font-heading text-sm font-bold text-ink">{row.v}</dd>
                </div>
              ))}
              <div className="bg-card px-4 py-3 sm:col-span-2">
                <dt className="tamil font-body text-xs font-medium text-ink2">{t('glanceApply')}</dt>
                <dd className="mt-0.5 font-heading text-sm font-bold">
                  <a
                    href={GROUP4.notification.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex min-h-[40px] items-center gap-1.5 text-brand-dark hover:underline"
                  >
                    apply.tnpscexams.in <ExternalLink size={13} />
                  </a>
                </dd>
              </div>
            </dl>
          </Section>

          {/* ─── Important dates ──────────────────────────────────────────── */}
          <Section id="dates" icon={CalendarDays} title={t('datesTitle')} tint={TINTS[1]}>
            <Scroller>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    <Th>{t('colEvent')}</Th>
                    <Th>{t('colDate')}</Th>
                    <Th>{t('colTime')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {GROUP4_DATES.map((d) => {
                    const key = d.event === 'Last date to apply online' || d.event === 'Written Examination'
                    return (
                      <tr key={d.event} className="border-b border-line last:border-0">
                        <Td className={key ? 'font-bold text-ink' : ''}>{d.event}</Td>
                        <Td className={key ? 'font-bold text-ink' : ''}>{d.displayDate}</Td>
                        <Td>{d.time ?? '—'}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Scroller>
            <Note>{t('datesNote')}</Note>
          </Section>

          {/* ─── Vacancies ────────────────────────────────────────────────── */}
          <Section id="vacancies" icon={Users} title={t('vacTitle')} tint={TINTS[2]}>
            <p className="tamil font-body text-[15px] leading-relaxed text-ink2">{t('vacLead')}</p>

            <h3 className="tamil mt-6 font-heading text-base font-bold text-ink">{t('groupsTitle')}</h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {GROUP4_POST_GROUPS.map((g) => (
                <li key={g.group} className="flex items-baseline justify-between gap-3 rounded-field border border-line bg-card px-3 py-2.5">
                  <span className="font-body text-sm text-ink2">{g.group}</span>
                  <span className="shrink-0 font-heading text-sm font-bold text-brand-dark">{num(g.vacancies)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="tamil mr-1 font-body text-xs font-medium text-ink2">{t('filterLabel')}:</span>
              {BANDS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBand(b.key)}
                  aria-pressed={band === b.key}
                  className={
                    band === b.key
                      ? 'tamil inline-flex min-h-[40px] items-center rounded-full bg-brand px-4 font-heading text-xs font-bold text-white'
                      : 'tamil inline-flex min-h-[40px] items-center rounded-full border border-line bg-card px-4 font-heading text-xs font-bold text-ink transition hover:border-brand/40 hover:text-brand-dark'
                  }
                >
                  {t(b.label)}
                </button>
              ))}
            </div>

            <p className="tamil mt-3 font-body text-xs font-medium text-ink2">
              {t('vacShown')}: {posts.length} / {GROUP4.summary.totalPosts} · {num(shown)} {t('colVac').toLowerCase()}
            </p>

            {/* Phones get a card per post. A 46-row, 6-column table in a
                horizontal scroller technically "works" at 320px, but the first
                screenful is S.No and half a post name — the vacancy count, the
                thing people came for, is two swipes off-screen. */}
            <ul className="mt-3 space-y-2 sm:hidden">
              {posts.map((p) => (
                <li key={p.postCode} className="rounded-field border border-line bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-heading text-sm font-bold text-ink">{p.name}</p>
                    <span className="shrink-0 rounded-full bg-tint-violet px-2.5 py-1 font-heading text-sm font-bold text-brand">
                      {num(p.vacancies)}
                    </span>
                  </div>
                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-body text-xs text-ink2">
                    <div className="flex gap-1.5">
                      <dt className="tamil font-medium">{t('colCode')}:</dt>
                      <dd>{p.postCode}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="tamil font-medium">{t('colPay')}:</dt>
                      <dd>{p.payLevel}</dd>
                    </div>
                  </dl>
                  <p className="mt-1.5 font-body text-xs leading-relaxed text-ink2">{p.service}</p>
                  <p className="mt-1.5 font-body text-xs leading-relaxed text-ink2">{p.qualification}</p>
                  {p.note && <p className="mt-1 font-body text-xs italic leading-relaxed text-ink2">{p.note}</p>}
                </li>
              ))}
            </ul>
            {band === 'all' && (
              <p className="mt-3 flex items-center justify-between rounded-field bg-tint-violet px-3 py-2.5 font-heading text-sm font-bold text-ink sm:hidden">
                <span className="tamil">{t('vacTotal')}</span>
                <span>{num(GROUP4.summary.totalVacancies)}</span>
              </p>
            )}

            <Scroller className="mt-3 hidden sm:block">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    <Th>{t('colSNo')}</Th>
                    <Th>{t('colPost')}</Th>
                    <Th>{t('colCode')}</Th>
                    <Th>{t('colService')}</Th>
                    <Th className="text-right">{t('colVac')}</Th>
                    <Th>{t('colPay')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.postCode} className="border-b border-line last:border-0 align-top">
                      <Td>{p.sNo}</Td>
                      {/* Qualification rides under the post name rather than
                          in its own column: the strings run to ~200 characters,
                          and a seventh column squeezed them to one word a line. */}
                      <Td className="min-w-[260px] font-bold text-ink">
                        {p.name}
                        <span className="mt-1 block font-body text-xs font-normal leading-relaxed text-ink2">
                          {p.qualification}
                        </span>
                        {p.note && (
                          <span className="mt-1 block font-body text-xs font-normal italic leading-relaxed text-ink2">
                            {p.note}
                          </span>
                        )}
                      </Td>
                      <Td>{p.postCode}</Td>
                      <Td className="min-w-[150px]">{p.service}</Td>
                      <Td className="text-right font-bold text-brand-dark">{num(p.vacancies)}</Td>
                      <Td className="whitespace-nowrap">{p.payLevel}</Td>
                    </tr>
                  ))}
                </tbody>
                {band === 'all' && (
                  <tfoot>
                    <tr className="border-t-2 border-line">
                      <Td colSpan={4} className="font-heading font-bold text-ink">
                        {t('vacTotal')}
                      </Td>
                      <Td className="text-right font-heading font-bold text-ink">{num(GROUP4.summary.totalVacancies)}</Td>
                      <Td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </Scroller>
            <Note>{t('vacTentative')}</Note>
          </Section>

          {/* ─── Eligibility ──────────────────────────────────────────────── */}
          <Section id="eligibility" icon={GraduationCap} title={t('eligTitle')} tint={TINTS[3]}>
            {[
              { h: t('eligQualTitle'), b: t('eligQualBody') },
              { h: t('eligAgeTitle'), b: t('eligAgeBody') },
              { h: t('eligTamilTitle'), b: t('eligTamilBody') },
            ].map((x) => (
              <div key={x.h} className="mt-4 first:mt-0">
                <h3 className="tamil font-heading text-base font-bold text-ink">{x.h}</h3>
                <p className="tamil mt-1.5 font-body text-[15px] leading-relaxed text-ink2">{x.b}</p>
              </div>
            ))}
          </Section>

          {/* ─── Exam pattern ─────────────────────────────────────────────── */}
          <Section id="pattern" icon={FileText} title={t('patternTitle')} tint={TINTS[0]}>
            <p className="tamil font-body text-[15px] leading-relaxed text-ink2">{t('patternLead')}</p>
            <Scroller className="mt-4">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    <Th>{t('colPart')}</Th>
                    <Th>{t('colSubject')}</Th>
                    <Th className="text-right">{t('colQuestions')}</Th>
                    <Th className="text-right">{t('colMarks')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {GROUP4.examPattern.parts.map((p, i) => (
                    <tr key={p.part} className="border-b border-line">
                      <Td className="font-bold text-ink">{p.part}</Td>
                      <Td>
                        {p.subject}
                        {p.standard && <span className="block font-body text-xs text-ink2">{p.standard} standard</span>}
                      </Td>
                      <Td className="whitespace-nowrap text-right">{p.questions}</Td>
                      <Td className="text-right">{i === 0 ? p.marks : i === 1 ? t('partBcMarks') : ''}</Td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-line">
                    <Td colSpan={2} className="font-heading font-bold text-ink">
                      {t('vacTotal')}
                    </Td>
                    <Td className="text-right font-heading font-bold text-ink">{GROUP4.examPattern.totalQuestions}</Td>
                    <Td className="text-right font-heading font-bold text-ink">{GROUP4.examPattern.totalMarks}</Td>
                  </tr>
                </tbody>
              </table>
            </Scroller>

            <div className="mt-5 rounded-card border border-accent/40 bg-tint-coral p-4 sm:p-5">
              <h3 className="tamil flex items-center gap-2 font-heading text-sm font-bold text-ink">
                <AlertTriangle size={16} className="shrink-0 text-accent" /> {t('gateTitle')}
              </h3>
              <p className="tamil mt-1.5 font-body text-sm leading-relaxed text-ink2">{t('gateBody')}</p>
            </div>
            <p className="tamil mt-4 font-body text-sm leading-relaxed text-ink2">{t('patternDa')}</p>
          </Section>

          {/* ─── Selection process ────────────────────────────────────────── */}
          <Section id="selection" icon={ListChecks} title={t('selectionTitle')} tint={TINTS[1]}>
            <ol className="space-y-3">
              {GROUP4.selectionProcess.steps.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand font-heading text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="font-body text-[15px] leading-relaxed text-ink2">{step}</span>
                </li>
              ))}
            </ol>
            <Note>{t('selectionNote')}</Note>
          </Section>

          {/* ─── Centres ──────────────────────────────────────────────────── */}
          <Section id="centres" icon={MapPin} title={t('centresTitle')} tint={TINTS[2]}>
            <p className="tamil font-body text-[15px] leading-relaxed text-ink2">{t('centresBody')}</p>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {GROUP4.examCentres.districts.map((d) => (
                <li key={d} className="rounded-full border border-line bg-card px-2.5 py-1 font-body text-xs text-ink2">
                  {d}
                </li>
              ))}
            </ul>
          </Section>

          {/* ─── How to apply + fee ───────────────────────────────────────── */}
          <Section id="apply" icon={Check} title={t('applyTitle')} tint={TINTS[3]}>
            <ol className="space-y-3">
              {GROUP4.applicationProcess.steps.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand font-heading text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="font-body text-[15px] leading-relaxed text-ink2">{step}</span>
                </li>
              ))}
            </ol>
            <h3 className="tamil mt-6 font-heading text-base font-bold text-ink">{t('feeTitle')}</h3>
            <p className="tamil mt-1.5 font-body text-[15px] leading-relaxed text-ink2">{t('feeBody')}</p>
          </Section>

          {/* ─── Conversion block ─────────────────────────────────────────── */}
          <section id="prepare" className="mt-6 scroll-mt-20 rounded-card border border-brand/40 bg-brand-soft p-5 shadow-soft sm:p-7">
            <h2 className="tamil font-heading text-lg font-bold text-ink sm:text-xl">{t('ctaTitle')}</h2>

            <p className="tamil mt-2 font-heading text-base font-extrabold text-brand-dark">{t('ctaHook')}</p>
            <p className="tamil mt-2 font-body text-sm leading-relaxed text-ink2">{t('ctaBody')}</p>
            <ul className="mt-4 space-y-2">
              {[t('ctaB1'), t('ctaB2'), t('ctaB3'), t('ctaB4')].map((b) => (
                <li key={b} className="flex gap-2.5">
                  <Check size={16} className="mt-0.5 shrink-0 text-correct" />
                  <span className="tamil font-body text-sm leading-relaxed text-ink2">{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a
                href={appHref}
                onClick={(e) => onAppClick(e, 'cta')}
                className="btn-wrap btn-brand tamil min-h-[48px] justify-center px-6 text-sm shadow-lg shadow-brand/25 sm:w-auto"
              >
                {t('ctaPrimary')} <ArrowRight size={16} className="shrink-0" />
              </a>
              <a
                href="/questions/past-papers/group-4-2025/"
                className="btn-wrap btn-ghost tamil min-h-[48px] justify-center px-6 text-sm sm:w-auto"
              >
                {t('ctaSecondary')}
              </a>
            </div>
            <p className="tamil mt-3 font-body text-xs text-ink2">{t('ctaFinePrint')}</p>
          </section>

          {/* ─── Disclaimer ───────────────────────────────────────────────── */}
          <aside className="mt-6 flex items-start gap-3 rounded-card border border-line bg-card p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-ink2" />
            <div>
              <p className="tamil font-heading text-sm font-bold text-ink">{t('disclaimerTitle')}</p>
              <p className="tamil mt-1 font-body text-sm leading-relaxed text-ink2">
                {t('disclaimer')}{' '}
                <a
                  href={TNPSC_OFFICIAL_URL}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="font-medium text-brand-dark hover:underline"
                >
                  tnpsc.gov.in
                </a>
              </p>
            </div>
          </aside>
        </div>

        {/* ─── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="mt-10 min-w-0 lg:mt-0">
          <AnswerKeySidebarBox
            title={t('sidebarLinksTitle')}
            items={SIDEBAR_LINKS.map((l) => ({ href: l.href, label: t(l.label) }))}
          />
          <div className="mt-6 rounded-card border border-brand/40 bg-brand-soft p-5">
            <h2 className="tamil font-heading text-base font-bold text-ink">{t('sidebarStartTitle')}</h2>
            <p className="tamil mt-1.5 font-body text-sm leading-relaxed text-ink2">{t('sidebarStartBody')}</p>
            <a
              href={appHref}
              onClick={(e) => onAppClick(e, 'sidebar')}
              className="btn-wrap btn-brand tamil mt-4 min-h-[44px] w-full justify-center px-4 text-sm"
            >
              {appLabel} <ArrowRight size={15} className="shrink-0" />
            </a>
          </div>
        </aside>
      </main>

      <AnswerKeyFeaturesSection
        lang={lang}
        title={t('featuresTitle')}
        appLabel={appLabel}
        appHref={appHref}
        onAppClick={onAppClick}
      />

      <AnswerKeyFaqSection title={t('faqTitle')}>
        {GROUP4_FAQS.map((f) => (
          <div key={f.q} className="rounded-card border border-line bg-card p-4">
            <h3 className="font-heading text-sm font-bold text-ink">{f.q}</h3>
            <p className="mt-1.5 font-body text-sm leading-relaxed text-ink2">{f.a}</p>
          </div>
        ))}
      </AnswerKeyFaqSection>

      <AnswerKeyFooter tagline={t('footerTagline')} followLabel={t('footerFollow')} disclaimer={t('footerDisclaimer')} />

      <AnswerKeyStickyBar
        answerKeyLabel={t('navVacancies')}
        appLabel={t('openApp')}
        appHref={appHref}
        onAppClick={onAppClick}
      />

      <LandingLangPrompt open={!langChosen} onChoose={setLang} />
    </div>
  )
}

// ─── Small presentational helpers ────────────────────────────────────────────

/**
 * One content block: a card on the canvas with a tinted icon tile in its
 * header. The page is a long run of tables and prose, and with every section
 * drawn flat on one white field they ran together — the card edge is what
 * tells a scanning visitor where "Eligibility" stops and "Exam pattern"
 * starts. The tint rotates through the four semantic tiles (design-system.md)
 * so neighbouring sections never share one.
 */
function Section({
  id,
  icon: Icon,
  title,
  tint,
  children,
}: {
  id: string
  icon: typeof Users
  title: string
  tint: (typeof TINTS)[number]
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="mt-6 scroll-mt-20 overflow-hidden rounded-card border border-line bg-card shadow-soft"
    >
      <h2 className="tamil flex items-center gap-3 border-b border-line px-4 py-3.5 font-heading text-lg font-bold tracking-tight text-ink sm:px-6 sm:text-xl">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-field ${tint.bg}`}>
          <Icon size={18} className={tint.fg} />
        </span>
        {title}
      </h2>
      <div className="px-4 py-5 sm:px-6">{children}</div>
    </section>
  )
}

/** Wide tables stay readable on a phone by scrolling inside their own box. */
function Scroller({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-card border border-line ${className}`}>
      <div className="min-w-full">{children}</div>
    </div>
  )
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`tamil px-2 py-2.5 font-heading text-xs font-bold text-ink2 sm:px-3 sm:uppercase sm:tracking-wide ${className}`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  className = '',
  colSpan,
}: {
  children?: React.ReactNode
  className?: string
  colSpan?: number
}) {
  return (
    <td colSpan={colSpan} className={`px-2 py-2.5 font-body text-sm text-ink2 sm:px-3 ${className}`}>
      {children}
    </td>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="tamil mt-3 font-body text-xs leading-relaxed text-ink2">{children}</p>
}
