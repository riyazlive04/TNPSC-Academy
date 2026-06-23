import type { StudyNote } from './studyNotesPdf'

/**
 * Bilingual study-note content, recreated as TNPSC Mentors material from the
 * "quick notes" infographics. Each topic renders to one bilingual PDF via
 * generateStudyNotePdf(). Add new topics by appending to STUDY_NOTES.
 */
export const STUDY_NOTES: StudyNote[] = [
  // ─── 1. Modern History (1917–1947) ──────────────────────────────────────────
  {
    id: 'modern-history-1917-1947',
    title: { en: 'Modern History', ta: 'நவீன கால இந்தியா' },
    subtitle: {
      en: 'Key events of the freedom struggle',
      ta: 'சுதந்திரப் போராட்டத்தின் முக்கிய நிகழ்வுகள்',
    },
    period: '1917 – 1947',
    layout: 'timeline',
    entries: [
      {
        marker: '1915',
        heading: { en: 'Arrival of Gandhi', ta: 'காந்தியின் வருகை' },
      },
      {
        marker: '1917',
        heading: { en: 'Champaran (Bihar) Satyagraha', ta: 'சம்பாரன் (பிஹார்) சத்தியாகிரகம்' },
        body: {
          en: 'Against the oppressive European "Indigo planters".',
          ta: 'அடக்குமுறையாளர்களான ஐரோப்பிய "அவுரித் தோட்டக்காரர்களுக்கு" எதிராக.',
        },
      },
      {
        marker: '1918',
        heading: { en: 'Kheda Satyagraha', ta: 'கேதா சத்தியாகிரகம்' },
        body: {
          en: 'In Gujarat, to support people unable to pay land tax due to crop failure.',
          ta: 'குஜராத்தில் பயிர் கருகியதால் / வெள்ளாமை பொய்ப்பித்ததால் நில வரி செலுத்த முடியாத மக்களுக்கு ஆதரவாக.',
        },
      },
      {
        marker: '1919',
        heading: { en: 'Rowlatt Act', ta: 'ரெளலட் சட்டம்' },
        body: {
          en: 'Any person could be arrested on mere suspicion; no appeal or petition could be filed against such arrest. Also called the "Black Act".',
          ta: 'சந்தேகத்தின் அடிப்படையில் எந்த நபரையும் கைது செய்யலாம்; அத்தகைய கைதுக்கு எதிராக மேல்முறையீடோ மனுவோ தாக்கல் செய்ய முடியாது. அதனால் இது "கருப்புச் சட்டம்" என்றும் அழைக்கப்பட்டது.',
        },
      },
      {
        marker: '1919',
        heading: { en: 'Jallianwala Bagh Massacre', ta: 'ஜாலியன்வாலா பாக் படுகொலை' },
        body: {
          en: '13th April, on Baisakhi Day. Rabindranath Tagore renounced his Knighthood in protest.',
          ta: 'ஏப்ரல் 13, பைசாகி தினம் அன்று நடந்தேறியது. எதிர்ப்பு தெரிவிக்கும் வகையில் ரவீந்திரநாத் தாகூர் தமக்கு வழங்கப்பட்ட "நைட்" (Knighthood) பட்டத்தைத் துறந்தார்.',
        },
      },
      {
        marker: '1919',
        heading: { en: 'Khilafat Movement (19 Oct)', ta: 'கிலாஃபத் இயக்கம் (19 அக்டோபர்)' },
        body: {
          en: 'Launched because of the harsh terms of the "Treaty of Sevres".',
          ta: '"செவ்ர் உடன்படிக்கையின்" கடுமையான விதிமுறைகள் காரணமாகத் தொடங்கப்பட்டது.',
        },
      },
      {
        marker: '1920-22',
        heading: { en: 'Non-Cooperation Movement', ta: 'ஒத்துழையாமை இயக்கம்' },
        bullets: [
          {
            en: 'Began with Gandhi renouncing his titles.',
            ta: 'காந்தி தனது பட்டங்களைத் துறந்து தொடங்கிவைத்தார்.',
          },
          {
            en: 'Boycott of elections under the 1919 Act, govt functions, schools and colleges.',
            ta: '1919 சட்டத்தின் கீழ் தேர்தல்களை, அரசு விழாக்கள், அரசுப் பள்ளிகள் மற்றும் கல்லூரிகளைப் புறக்கணித்தல்.',
          },
          {
            en: '1921: mass demonstration against the "Prince of Wales" during his tour of India.',
            ta: '1921: "வேல்ஸ் இளவரசர்" இந்தியா சுற்றுப்பயணம் வந்தபோது வெகுஜன ஆர்ப்பாட்டம்.',
          },
        ],
        body: {
          en: 'Gandhi called off the NCM on 11 February following the Chauri Chaura incident in Gorakhpur (a police station was set on fire and 22 policemen were burnt). Gandhi was arrested on 10 March 1922.',
          ta: 'கோரக்பூரில் நடந்த சௌரி சௌரா சம்பவத்தைத் தொடர்ந்து பிப்ரவரி 11 அன்று காந்தி ஒத்துழையாமை இயக்கத்தைக் கைவிட்டார் (காவல் நிலையம் தீ வைக்கப்பட்டு 22 காவலர்கள் எரிந்தனர்). காந்தி 1922 மார்ச் 10 அன்று கைது செய்யப்பட்டார்.',
        },
      },
      {
        marker: '1923',
        heading: { en: 'Formation of the Swaraj Party (1 Jan)', ta: 'சுயராஜ்யக் கட்சி உருவானது (ஜனவரி 1)' },
        body: {
          en: 'The suspension of the NCM led to a split in the Congress at the Gaya session (Dec 1922). Motilal Nehru and Chittaranjan Das formed a separate group within the Congress.',
          ta: 'ஒத்துழையாமை இயக்கம் கைவிடப்பட்டது 1922 டிசம்பரில் நடந்த காயா அமர்வில் காங்கிரஸ் பிளவுற வழிவகுத்தது. மோதிலால் நேரு மற்றும் சித்தரஞ்சன் தாஸ் காங்கிரஸுக்குள் தனிக் குழுவை உருவாக்கினர்.',
        },
      },
      {
        marker: '1927',
        heading: { en: 'Simon Commission', ta: 'சைமன் குழு' },
        body: {
          en: 'When the commission reached Bombay on 3 Feb 1928, black flags and cries of "Simon Go Back" were seen across the country. Its report became the basis of the Government of India Act, 1935.',
          ta: '1928 பிப்ரவரி 3 அன்று குழு பம்பாய்க்கு வந்தபோது நாடு முழுவதும் கறுப்புக் கொடிகளும் "சைமன் கோ பேக்" கூக்குரலும் ஒலித்தன. அதன் அறிக்கையே 1935 இந்திய அரசுச் சட்டத்தின் அடிப்படையாக அமைந்தது.',
        },
      },
      {
        marker: '1928',
        heading: { en: 'Nehru Report', ta: 'நேரு அறிக்கை' },
        body: {
          en: 'Secretary of State Lord Birkenhead challenged whether Indians could draft a constitution acceptable to all. On 28 Feb 1928 a committee of 8 headed by Motilal Nehru was formed; its report was submitted on 28 August 1928.',
          ta: 'மாநிலச் செயலாளர் லார்ட் பிரைகன்ஹெட், அனைவரும் ஏற்கும் வகையில் ஓர் அரசியலமைப்பை இந்தியர்களால் உருவாக்க முடியுமா எனச் சவால் விடுத்தார். 1928 பிப்ரவரி 28 அன்று மோதிலால் நேரு தலைமையில் 8 பேர் கொண்ட குழு அமைக்கப்பட்டது; அதன் அறிக்கை 1928 ஆகஸ்ட் 28 அன்று சமர்ப்பிக்கப்பட்டது.',
        },
      },
      {
        marker: '1929',
        heading: { en: 'Poorna Swaraj', ta: 'பூரண சுயராஜ்யம்' },
        body: {
          en: 'The government refused the Nehru Report and the Congress called for civil disobedience. On 31 Dec 1929, Nehru hoisted the tricolour on the banks of the Ravi, demanded "Poorna Swaraj" (complete self-rule), and 26 January 1930 was set as the date for independence.',
          ta: 'நேரு அறிக்கையை அரசாங்கம் ஏற்க மறுத்தது; காங்கிரஸ் சட்ட மறுப்பு இயக்கத்திற்கு அழைப்பு விடுத்தது. 1929 டிசம்பர் 31 அன்று நேரு ராவி ஆற்றின் கரையில் மூவர்ணக் கொடியை ஏற்றி "பூரண சுயராஜ்யம்" (முழுமையான சுயராஜ்யம்) கோரினார்; 1930 ஜனவரி 26 சுதந்திர நாளாக நிர்ணயிக்கப்பட்டது.',
        },
      },
      {
        marker: '1930-34',
        heading: { en: 'Civil Disobedience Movement (CDM)', ta: 'சட்ட மறுப்பு இயக்கம் (CDM)' },
        body: {
          en: 'On 12 March 1930 Gandhi began the Dandi March from the Sabarmati Ashram, Ahmedabad. On 6 April 1930 he formally launched the CDM by breaking the salt law.',
          ta: '1930 மார்ச் 12 அன்று அகமதாபாத்தில் உள்ள சபர்மதி ஆசிரமத்திலிருந்து காந்தி தண்டி யாத்திரையைத் தொடங்கினார். 1930 ஏப்ரல் 6 அன்று உப்புச் சட்டத்தை மீறி சட்ட மறுப்பு இயக்கத்தை முறையாகத் தொடங்கினார்.',
        },
      },
      {
        marker: '1930-32',
        heading: { en: 'Round Table Conferences', ta: 'வட்ட மேசை மாநாடுகள்' },
        bullets: [
          {
            en: '1st RTC (Nov 1930): boycotted by the Congress (its leaders were in prison).',
            ta: 'முதல் மாநாடு (நவம்பர் 1930): காங்கிரஸால் புறக்கணிக்கப்பட்டது (தலைவர்கள் சிறையில் இருந்தனர்).',
          },
          {
            en: '8 March 1931: the Gandhi–Irwin Pact was signed; Gandhi agreed to suspend the CDM.',
            ta: '1931 மார்ச் 8: காந்தி–இர்வின் ஒப்பந்தம் கையெழுத்தானது; காந்தி CDM-ஐ இடைநிறுத்த ஒப்புக்கொண்டார்.',
          },
          {
            en: '2nd RTC (Sep 1931): Gandhi participated but returned disappointed; the CDM resumed.',
            ta: '2வது மாநாடு (செப்டம்பர் 1931): காந்தி பங்கேற்றார், ஆனால் ஏமாற்றத்துடன் திரும்பினார்; CDM மீண்டும் தொடங்கப்பட்டது.',
          },
          {
            en: '3rd RTC (1932): the Congress did not participate.',
            ta: '3வது மாநாடு (1932): காங்கிரஸ் பங்கேற்கவில்லை.',
          },
        ],
      },
      {
        marker: '1932',
        heading: { en: 'Poona Pact', ta: 'பூனா ஒப்பந்தம்' },
        body: {
          en: 'On 16 Aug 1932 British PM Ramsay MacDonald announced the Communal Award - separate electorates for the depressed classes. Gandhi began a fast unto death in Yerawada Jail on 20 Sep. Dr. Ambedkar met Gandhi and the Poona Pact was signed, reserving 148 seats for the depressed classes in the provincial legislature (against the 71 of the Communal Award).',
          ta: '1932 ஆகஸ்ட் 16 அன்று பிரிட்டிஷ் பிரதமர் ராம்சே மெக்டொனால்ட் வகுப்புவாரித் தீர்ப்பை அறிவித்தார் - தாழ்த்தப்பட்ட வகுப்பினருக்குத் தனி வாக்காளர் தொகுதி. செப்டம்பர் 20 அன்று காந்தி எரவாடா சிறையில் சாகும்வரை உண்ணாவிரதம் தொடங்கினார். டாக்டர் அம்பேத்கர் காந்தியைச் சந்தித்தார்; பூனா ஒப்பந்தம் கையெழுத்தானது - மாகாண சட்டமன்றத்தில் தாழ்த்தப்பட்ட வகுப்பினருக்கு 148 இடங்கள் (வகுப்புவாரித் தீர்ப்பின் 71 இடங்களுக்குப் பதிலாக) ஒதுக்கப்பட்டன.',
        },
      },
      {
        marker: '1939',
        heading: { en: 'Deliverance Day', ta: 'விடுதலை நாள்' },
        body: {
          en: 'In the 1937 elections, Congress ministries were formed in 7 provinces. When the British involved India in WWII, Congress ministers resigned on 22 Dec 1939; the Muslim League celebrated this as "Deliverance Day". On 26 March 1940 the League demanded the creation of Pakistan.',
          ta: '1937 தேர்தலில் 7 மாகாணங்களில் காங்கிரஸ் அமைச்சகங்கள் அமைக்கப்பட்டன. ஆங்கிலேயர் இந்தியாவை இரண்டாம் உலகப் போரில் ஈடுபடுத்தியதால் காங்கிரஸ் அமைச்சர்கள் 1939 டிசம்பர் 22 அன்று ராஜினாமா செய்தனர்; முஸ்லிம் லீக் இந்நாளை "விடுதலை நாளாக"க் கொண்டாடியது. 1940 மார்ச் 26 அன்று லீக் பாகிஸ்தான் உருவாக்கம் கோரியது.',
        },
      },
      {
        marker: '1940',
        heading: { en: 'August Offer', ta: 'ஆகஸ்ட் சலுகை' },
        bullets: [
          {
            en: 'Lord Linlithgow announced a representative "Constitution-Making Body" would be set up right after the war.',
            ta: 'போருக்குப் பிறகு உடனடியாக ஒரு பிரதிநிதித்துவ "அரசியலமைப்பு உருவாக்கும் அவை" அமைக்கப்படும் என லின்லித்கோ பிரபு அறிவித்தார்.',
          },
          {
            en: "The number of Indians on the Viceroy's Executive Council would be increased.",
            ta: 'வைஸ்ராயின் நிறைவேற்றுக் குழுவில் இந்தியர்களின் எண்ணிக்கை அதிகரிக்கப்படும்.',
          },
          {
            en: 'A War Advisory Council would be set up.',
            ta: 'ஒரு போர் ஆலோசனைக் குழு அமைக்கப்படும்.',
          },
        ],
        body: {
          en: 'The Congress did not approve the August Offer.',
          ta: 'காங்கிரஸ் ஆகஸ்ட் சலுகையை ஏற்கவில்லை.',
        },
      },
      {
        marker: '1942',
        heading: { en: 'Cripps Mission', ta: 'கிரிப்ஸ் தூதுக்குழு' },
        body: {
          en: 'Sent by the British government in March 1942, headed by Sir Stafford Cripps, to secure Indian cooperation for the war effort. Gandhi called it a "post-dated cheque".',
          ta: 'பிரிட்டிஷ் போர் முயற்சிக்கு இந்தியாவின் ஒத்துழைப்பைப் பெற 1942 மார்ச்சில் சர் ஸ்டாஃபோர்ட் கிரிப்ஸ் தலைமையில் அனுப்பப்பட்டது. காந்தி இதை "பின்தேதியிட்ட காசோலை" என்று விமர்சித்தார்.',
        },
      },
      {
        marker: '1942-44',
        heading: { en: 'Quit India Movement', ta: 'வெள்ளையனே வெளியேறு இயக்கம்' },
        body: {
          en: 'On 8 Aug 1942 the AICC passed the Quit India Resolution. Gandhi gave the call "Do or Die"; all prominent leaders were arrested. 1943: armed attacks on govt buildings in Madras and Bengal. 1944: Gandhi was released.',
          ta: '1942 ஆகஸ்ட் 8 அன்று அகில இந்திய காங்கிரஸ் கமிட்டி வெள்ளையனே வெளியேறு தீர்மானத்தை நிறைவேற்றியது. காந்தி "செய் அல்லது செத்துமடி" அழைப்பு விடுத்தார்; முக்கியத் தலைவர்கள் கைது செய்யப்பட்டனர். 1943: மெட்ராஸ் மற்றும் வங்காளத்தில் அரசுக் கட்டிடங்கள் மீது ஆயுதத் தாக்குதல். 1944: காந்தி விடுதலை செய்யப்பட்டார்.',
        },
      },
      {
        marker: '1946',
        heading: { en: 'Cabinet Mission', ta: 'காபினெட் தூதுக்குழு' },
        body: {
          en: "On 15 March 1946 Lord Attlee announced that India's right to self-determination and to frame its own constitution were conceded. The 3-member committee: Sir Stafford Cripps, Pethick-Lawrence and A.V. Alexander.",
          ta: '1946 மார்ச் 15 அன்று அட்லீ பிரபு, இந்தியாவுக்கான சுயநிர்ணய உரிமையும் சொந்த அரசியலமைப்பை உருவாக்கும் உரிமையும் ஒப்புக்கொள்ளப்பட்டதாக அறிவித்தார். 3 உறுப்பினர் குழு: சர் ஸ்டாஃபோர்ட் கிரிப்ஸ், பெத்திக் லாரன்ஸ், ஏ.வி. அலெக்சாண்டர்.',
        },
      },
      {
        marker: '1947',
        heading: { en: 'Mountbatten Plan & Independence', ta: 'மவுண்ட்பேட்டன் திட்டம் & சுதந்திரம்' },
        body: {
          en: 'Mountbatten became Viceroy in March 1947 and on 3 June 1947 put forth the partition plan; both Congress and the Muslim League approved it. The Radcliffe Boundary Commission drew the India–Pakistan boundary. Per the Independence Act, partition took effect from 15 August 1947 - Pakistan came into existence on 14 Aug, India on 15 Aug.',
          ta: 'மவுண்ட்பேட்டன் 1947 மார்ச்சில் வைஸ்ராய் ஆனார்; 1947 ஜூன் 3 அன்று பிரிவினைத் திட்டத்தை முன்வைத்தார்; காங்கிரஸும் முஸ்லிம் லீக்கும் ஏற்றுக்கொண்டன. ராட்கிளிஃப் எல்லை வரையறை ஆணையம் இந்தியா–பாகிஸ்தான் எல்லையை வரைந்தது. சுதந்திரச் சட்டப்படி 1947 ஆகஸ்ட் 15 முதல் பிரிவினை நடைமுறைக்கு வந்தது - ஆகஸ்ட் 14 அன்று பாகிஸ்தானும், ஆகஸ்ட் 15 அன்று இந்தியாவும் உருவாயின.',
        },
      },
    ],
  },

  // ─── 2. Jyotiba Phule (1827–1890) ───────────────────────────────────────────
  {
    id: 'jyotiba-phule',
    title: { en: 'Jyotiba Phule', ta: 'ஜோதிபா பூலே' },
    subtitle: { en: 'Social reformer', ta: 'சமூகச் சீர்திருத்தவாதி' },
    period: '1827 – 1890',
    layout: 'list',
    entries: [
      {
        marker: '1',
        body: {
          en: 'Jyotiba Govindrao Phule belonged to the Mali (gardener) community, born in 1827 in Maharashtra. He acquainted himself with Western thought and with Christianity and Islam.',
          ta: 'ஜோதிபா கோவிந்த்ராவ் பூலே 1827 ஆம் ஆண்டு மகாராஷ்டிராவில் பிறந்தார்; இவர் மாலி (தோட்டக்காரர்) சமூகத்தைச் சேர்ந்தவர். மேற்கத்திய சிந்தனைகளுடனும், கிறிஸ்தவ மற்றும் இஸ்லாமிய மதங்களுடனும் தன்னை ஈடுபடுத்திக்கொண்டார்.',
        },
      },
      {
        marker: '2',
        body: {
          en: 'He read the Vedas, the Manu Samhita and the Puranas, and studied the thoughts of Buddha, Mahavira and the medieval Bhakti saints extensively.',
          ta: 'வேதங்கள், மனு சம்ஹிதா, புராணங்கள் ஆகியவற்றைப் படித்தார்; புத்தர், மகாவீரர் மற்றும் இடைக்காலப் பக்தித் துறவிகளின் சிந்தனைகளையும் விரிவாகப் படித்தார்.',
        },
      },
      {
        marker: '3',
        body: {
          en: 'He taught reading and writing to his wife Savitribai. In 1851 they started a school for girls at Budhwar Peth, Pune - the first such school for women started by Indians.',
          ta: 'தனது மனைவி சாவித்திரிபாய்க்கு வாசிக்கவும் எழுதவும் கற்றுக்கொடுத்தார். 1851 இல் புனேவின் புத்வார் பேத்தில் பெண்களுக்கான பள்ளியைத் தொடங்கினர் - இந்தியர்களால் பெண்களுக்காகத் தொடங்கப்பட்ட முதல் பள்ளி இதுவே.',
        },
      },
      {
        marker: '4',
        body: {
          en: 'In 1873 he launched the Satyashodhak Samaj (Truth-Seekers’ Society) to stir the non-Brahmin masses to self-respect and ambition. He welcomed British rule and missionary activity because it enabled lower castes to challenge the supremacy of Brahmins.',
          ta: '1873 இல் பிராமணரல்லாத மக்களின் சுயமரியாதையையும் இலட்சியத்தையும் தூண்டுவதற்காகச் சத்யசோதக் சமாஜத்தை (உண்மையைத் தேடும் சமூகம்) தொடங்கினார். பிராமணர்களின் மேலாதிக்கத்தைச் சவால் செய்ய தாழ்த்தப்பட்டோருக்கு உதவியதால் பிரிட்டிஷ் ஆட்சியையும் மிஷனரி நடவடிக்கைகளையும் வரவேற்றார்.',
        },
      },
      {
        marker: '5',
        body: {
          en: 'He started a school for the children of lower castes, advocated widow remarriage and fought against female infanticide. He opened the well at his house to people of all castes and opened a home for widows and infants.',
          ta: 'தாழ்த்தப்பட்ட சாதியினரின் குழந்தைகளுக்காக ஒரு பள்ளியைத் தொடங்கினார்; விதவை மறுமணத்தை ஆதரித்தார்; பெண் சிசுக்கொலைக்கு எதிராகப் போராடினார். தனது வீட்டுக் கிணற்றை அனைத்து சாதியினருக்கும் திறந்துவிட்டார்; விதவைகள் மற்றும் குழந்தைகளுக்கான இல்லத்தையும் தொடங்கினார்.',
        },
      },
      {
        marker: '6',
        body: {
          en: 'He is credited with first using the word "Dalit" for the depressed classes - a Marathi word meaning "broken" or "crushed". Mahatma Phule passed away in Pune at the age of 63.',
          ta: 'தாழ்த்தப்பட்ட வகுப்பினரை "தலித்" என்ற சொல்லால் முதன்முதலில் குறிப்பிட்ட பெருமை இவருக்கு உண்டு - இது "உடைந்த" அல்லது "நொறுக்கப்பட்ட" எனப் பொருள்படும் மராத்திச் சொல். மகாத்மா பூலே புனேவில் தம் 63வது வயதில் காலமானார்.',
        },
      },
      {
        marker: '7',
        body: {
          en: 'His wife Savitribai was an active participant in the movement and continued the work after his death. Phule was also Commissioner of the Poona Municipality from 1876 to 1883.',
          ta: 'அவரது மனைவி சாவித்திரிபாயும் இந்த இயக்கத்தில் தீவிரமாகப் பங்கேற்றார்; கணவரின் மறைவுக்குப் பிறகும் பணியைத் தொடர்ந்தார். பூலே 1876 முதல் 1883 வரை பூனா நகராட்சியின் ஆணையராகவும் இருந்தார்.',
        },
      },
      {
        marker: '8',
        body: {
          en: 'His most important book is "Gulamgiri" (meaning "slavery"). At weddings he would ask the bridegroom to promise the right to education for his bride.',
          ta: 'அவரது மிக முக்கியமான நூல் "குலாம்கிரி" (அடிமைத்தனம் எனப் பொருள்). திருமணங்களில் மணமகனிடம் மணமகளுக்குக் கல்வி உரிமை அளிப்பதாக உறுதியளிக்குமாறு கேட்பார்.',
        },
      },
      {
        marker: '9',
        body: {
          en: 'He started a night school for farmers. He submitted a report on the importance of educating the deprived classes to the Hunter Commission.',
          ta: 'விவசாயிகளுக்காக ஓர் இரவுநேரப் பள்ளியைத் தொடங்கினார். தாழ்த்தப்பட்ட வகுப்பினருக்குக் கல்வி கற்பிப்பதன் முக்கியத்துவம் குறித்த அறிக்கையை ஹண்டர் குழுவிடம் சமர்ப்பித்தார்.',
        },
      },
    ],
  },

  // ─── 3. Rettaimalai Srinivasan (1859–1945) ──────────────────────────────────
  {
    id: 'rettaimalai-srinivasan',
    title: { en: 'Rettaimalai Srinivasan', ta: 'ரெட்டைமலை சீனிவாசன்' },
    subtitle: { en: 'Social-justice leader', ta: 'சமூக நீதித் தலைவர்' },
    period: '1859 – 1945',
    layout: 'list',
    entries: [
      {
        marker: '1',
        body: {
          en: 'Popularly known as "Grandpa (Thatha)", he was born on 7 July 1859 in Kozhiyalam village, Maduranthagam Taluk, Kancheepuram District. He was the brother-in-law of Iyothee Thass Pandithar.',
          ta: '"தாத்தா" என்று அனைவராலும் அறியப்பட்டவர்; 1859 ஜூலை 7 அன்று காஞ்சீபுரம் மாவட்டம் மதுராந்தகம் தாலுகா கோழியாலம் கிராமத்தில் பிறந்தார். இவர் அயோத்தி தாஸ் பண்டிதரின் மைத்துனர் ஆவார்.',
        },
      },
      {
        marker: '2',
        body: {
          en: 'He was honoured with titles such as Rao Sahib (1926), Rao Bahadur (1930) and Diwan Bahadur (1936) for his selfless social service. In 1940 he was honoured as "Dravida Mani" at an event presided over by Rajaji in the presence of Thiru Vi. Ka.',
          ta: 'தன்னலமற்ற சமூகச் சேவைக்காக ராவ் சாஹிப் (1926), ராவ் பகதூர் (1930), திவான் பகதூர் (1936) ஆகிய பட்டங்களால் கௌரவிக்கப்பட்டார். 1940 இல் திரு. வி. க. முன்னிலையில் ராஜாஜி தலைமையில் "திராவிட மணி" என்று கௌரவிக்கப்பட்டார்.',
        },
      },
      {
        marker: '3',
        body: {
          en: 'He established and led the Paraiyar Mahajana Sabha in 1891, which later became the "Adi-Dravida Mahajana Sabha" in 1893. He fought for social justice, equality and the civil rights of the marginalised.',
          ta: '1891 இல் பறையர் மகாஜன சபையை நிறுவி வழிநடத்தினார்; பின்னர் அது 1893 இல் "ஆதி-திராவிட மகாஜன சபை"யாக மாறியது. சமூக நீதி, சமத்துவம் மற்றும் ஒடுக்கப்பட்டோரின் குடியுரிமைகளுக்காகப் போராடினார்.',
        },
      },
      {
        marker: '4',
        body: {
          en: 'In 1906 he met Gandhi in South Africa and was closely associated with him. His autobiography "Jeeviya Saritha Surukkam" (1939) is one of the earliest autobiographies.',
          ta: '1906 இல் தென்னாப்பிரிக்காவில் காந்தியைச் சந்தித்து அவருடன் நெருங்கிய தொடர்பு கொண்டிருந்தார். 1939 இல் வெளியான அவரது சுயசரிதை "ஜீவிய சரிதா சுருக்கம்" ஆரம்பகாலச் சுயசரிதைகளில் ஒன்றாகும்.',
        },
      },
      {
        marker: '5',
        body: {
          en: 'He served as President of the Scheduled Caste Federation and the Madras Provincial Depressed Classes Federation. In October 1893 he founded a Tamil newspaper called "Paraiyan", which highlighted the sufferings of the depressed classes.',
          ta: 'பட்டியல் இனத்தவர் கூட்டமைப்பு மற்றும் மெட்ராஸ் மாகாண தாழ்த்தப்பட்ட வகுப்புகள் கூட்டமைப்பின் தலைவராகப் பணியாற்றினார். 1893 அக்டோபரில் "பறையன்" என்ற தமிழ்ச் செய்தித்தாளை நிறுவினார்; இது தாழ்த்தப்பட்ட வகுப்பினரின் துன்பங்களை எடுத்துரைத்தது.',
        },
      },
      {
        marker: '6',
        body: {
          en: 'He was a member of the Madras Legislative Council from 1923 to 1929 and influenced the Justice Party to take affirmative action to safeguard the interests of the deprived sections of society.',
          ta: '1923 முதல் 1929 வரை சென்னை சட்ட மேலவையில் உறுப்பினராக இருந்தார்; சமூகத்தின் பின்தங்கிய பிரிவினரின் நலனைப் பாதுகாக்க உறுதியான நடவடிக்கை எடுக்கும்படி நீதிக் கட்சியை வலியுறுத்தினார்.',
        },
      },
      {
        marker: '7',
        body: {
          en: 'A close associate of Dr. B.R. Ambedkar, he participated in the 1st and 2nd Round Table Conferences in London (1931 and 1932), representing the Paraiyars.',
          ta: 'டாக்டர் பி. ஆர். அம்பேத்கரின் நெருங்கிய கூட்டாளியான இவர், 1931 மற்றும் 1932 இல் லண்டனில் நடைபெற்ற முதல் மற்றும் இரண்டாம் வட்ட மேசை மாநாடுகளில் பறையர்களின் பிரதிநிதியாகப் பங்கேற்றார்.',
        },
      },
      {
        marker: '8',
        body: {
          en: "He was the president of the first Adi Dravidars Provincial Conference held at Pachaiyappa's College, Chennai, in 1928. He was a signatory to the Poona Pact of 1932.",
          ta: '1928 இல் சென்னை பச்சையப்பன் கல்லூரியில் நடைபெற்ற முதல் ஆதி திராவிடர் மாகாண மாநாட்டின் தலைவராக இருந்தார். 1932 பூனா ஒப்பந்தத்தில் கையெழுத்திட்டவர்களில் ஒருவர்.',
        },
      },
    ],
  },

  // ─── 4. A Brief History of the Justice Party ────────────────────────────────
  {
    id: 'justice-party-history',
    title: { en: 'Justice Party', ta: 'நீதிக் கட்சி' },
    subtitle: { en: 'A brief history', ta: 'சுருக்கமான வரலாறு' },
    period: '1912 – 1944',
    layout: 'timeline',
    entries: [
      {
        heading: { en: 'Founding leaders', ta: 'நிறுவிய தலைவர்கள்' },
        body: {
          en: 'Pitti Theagaraya Chetti, Dr. T.M. Nair, P. Ramarayaningar (Raja of Panagal) and Dr. C. Natesa Mudaliar.',
          ta: 'பிட்டி தியாகராய செட்டி, டாக்டர் டி.எம். நாயர், பி. ராமராயநிங்கார் (பனகல் ராஜா), டாக்டர் சி. நடேச முதலியார்.',
        },
      },
      {
        marker: '1912',
        heading: { en: 'Precursor', ta: 'முன்னோடி' },
        body: {
          en: 'The precursor of the Justice Party was the Madras United League, renamed the Madras Dravidian Association. Dr. C. Natesa Mudaliar played a vital role in nurturing this organisation.',
          ta: 'நீதிக் கட்சியின் முன்னோடி மெட்ராஸ் யுனைடெட் லீக்; இது மெட்ராஸ் திராவிட சங்கம் என மறுபெயரிடப்பட்டது. இந்த அமைப்பை வளர்ப்பதில் டாக்டர் சி. நடேச முதலியார் முக்கியப் பங்கு வகித்தார்.',
        },
      },
      {
        marker: '1916',
        heading: { en: 'Formation of the Justice Party', ta: 'நீதிக் கட்சியின் உருவாக்கம்' },
        body: {
          en: 'On 20 November, 30 prominent non-Brahmin leaders including Natesanar, Theyagarayar, T.M. Nair and Alamelu Mangai Thayarammal formed the South Indian Liberal Federation (SILF) to promote the political interests of non-Brahmin Hindus. SILF published three newspapers - Justice (English), Dravidian (Tamil) and Andhra Prakasika (Telugu) - hence it came to be called the "Justice Party".',
          ta: 'நவம்பர் 20 அன்று, நடேசனார், தியாகராயர், டி.எம். நாயர், அலமேலு மங்கை தாயாரம்மாள் உள்ளிட்ட 30 முக்கியப் பிராமணரல்லாத தலைவர்கள், பிராமணரல்லாத இந்துக்களின் அரசியல் நலனை ஊக்குவிக்கும் நோக்கில் தென்னிந்திய விடுதலைக் கூட்டமைப்பை (SILF) உருவாக்கினர். SILF மூன்று செய்தித்தாள்களை வெளியிட்டது - ஜஸ்டிஸ் (ஆங்கிலம்), திராவிடன் (தமிழ்), ஆந்திர பிரகாசிகா (தெலுங்கு) - எனவே இது "நீதிக் கட்சி" என அழைக்கப்பட்டது.',
        },
      },
      {
        marker: '1920',
        heading: { en: 'First Indian ministry in Madras', ta: 'சென்னையில் முதல் இந்திய அமைச்சரவை' },
        body: {
          en: 'The first election under the Montagu–Chelmsford reforms was held; the Justice Party won and formed the first-ever Indian cabinet in Madras. As Theagaraya Chettiar declined to lead it, A. Subbarayalu Reddiar became Chief Minister of the Madras Presidency.',
          ta: 'மாண்டேகு–செம்ஸ்ஃபோர்டு சீர்திருத்தங்களின் கீழ் முதல் தேர்தல் நடைபெற்றது; நீதிக் கட்சி வென்று சென்னையில் முதல் இந்திய அமைச்சரவையை உருவாக்கியது. தியாகராய செட்டியார் அதை வழிநடத்த மறுத்ததால், ஏ. சுப்பராயலு ரெட்டியார் சென்னை மாகாணத்தின் முதலமைச்சரானார்.',
        },
      },
      {
        marker: '1923',
        heading: { en: "Raja of Panagal's ministry", ta: 'பனகல் ராஜாவின் அமைச்சரவை' },
        body: {
          en: 'In the election the Justice Party fought against the Swarajya Party, won the majority, and the ministry was formed by the Raja of Panagal.',
          ta: 'தேர்தலில் நீதிக் கட்சி சுயராஜ்யக் கட்சிக்கு எதிராகப் போட்டியிட்டுப் பெரும்பான்மையைப் பெற்றது; அமைச்சரவை பனகல் ராஜாவால் அமைக்கப்பட்டது.',
        },
      },
      {
        marker: '1926',
        heading: { en: "Subbarayan's ministry", ta: 'சுப்பராயன் அமைச்சரவை' },
        body: {
          en: 'Independent candidate A. Subbarayan formed the ministry with the help of the Swarajya Party.',
          ta: 'சுயேச்சை வேட்பாளர் ஏ. சுப்பராயன், சுயராஜ்யக் கட்சியின் ஆதரவுடன் அமைச்சரவையை அமைத்தார்.',
        },
      },
      {
        marker: '1930',
        heading: { en: 'Muniswami Naidu', ta: 'முனுசாமி நாயுடு' },
        body: {
          en: 'The Justice Party again won the majority and formed the ministry with B. Muniswami Naidu as leader; in 1932 the Raja of Bobbili replaced him.',
          ta: 'நீதிக் கட்சி மீண்டும் பெரும்பான்மையைப் பெற்று பி. முனுசாமி நாயுடு தலைமையில் அமைச்சரவையை அமைத்தது; 1932 இல் பொப்பிலி ராஜா அவருக்குப் பதிலாக நியமிக்கப்பட்டார்.',
        },
      },
      {
        marker: '1934',
        heading: { en: 'Raja of Bobbili', ta: 'பொப்பிலி ராஜா' },
        body: {
          en: 'The Raja of Bobbili formed his second ministry and continued in power until the 1937 election.',
          ta: 'பொப்பிலி ராஜா இரண்டாவது முறையாக அமைச்சரவையை அமைத்தார்; 1937 தேர்தல் வரை அவரது ஆட்சி தொடர்ந்தது.',
        },
      },
      {
        marker: '1937',
        heading: { en: 'Congress ministry', ta: 'காங்கிரஸ் அமைச்சரவை' },
        body: {
          en: 'The Congress formed its ministry under C. Rajagopalachari.',
          ta: 'சி. ராஜகோபாலாச்சாரியின் தலைமையில் காங்கிரஸ் தனது அமைச்சரவையை அமைத்தது.',
        },
      },
      {
        marker: '1944',
        heading: { en: 'Renamed Dravidar Kazhagam', ta: 'திராவிடர் கழகம் எனப் பெயர் மாற்றம்' },
        body: {
          en: 'At the Justice Party conference held in Salem, a resolution moved by Peraringar Anna changed the name of the Justice Party to "Dravidar Kazhagam".',
          ta: 'சேலத்தில் நடைபெற்ற நீதிக் கட்சி மாநாட்டில், பேரறிஞர் அண்ணா கொண்டுவந்த தீர்மானத்தின்படி "நீதிக் கட்சி" "திராவிடர் கழகம்" என மறுபெயரிடப்பட்டது.',
        },
      },
    ],
  },

  // ─── 5. Achievements of the Justice Party ───────────────────────────────────
  {
    id: 'justice-party-achievements',
    title: { en: 'Achievements of the Justice Party', ta: 'நீதிக் கட்சியின் சாதனைகள்' },
    subtitle: { en: '13 years of social reform in Madras', ta: 'மெட்ராஸில் 13 ஆண்டுச் சமூகச் சீர்திருத்தம்' },
    period: '1920 – 1937',
    layout: 'timeline',
    entries: [
      {
        heading: { en: 'Overview', ta: 'மேலோட்டம்' },
        bullets: [
          {
            en: 'Between 1920 and 1937 the Justice Party was in power for about 13 years; its administration is noted for social justice and social reform.',
            ta: '1920 முதல் 1937 வரை சுமார் 13 ஆண்டுகள் நீதிக் கட்சி ஆட்சியில் இருந்தது; அதன் நிர்வாகம் சமூக நீதி மற்றும் சமூகச் சீர்திருத்தத்திற்காகக் குறிப்பிடத்தக்கது.',
          },
          {
            en: "Free and compulsory education was introduced for the first time in Madras; girls' education was encouraged.",
            ta: 'மெட்ராஸில் முதல் முறையாக இலவச மற்றும் கட்டாயக் கல்வி அறிமுகப்படுத்தப்பட்டது; பெண் கல்வி ஊக்குவிக்கப்பட்டது.',
          },
          {
            en: 'The status of the depressed classes was improved through educational reforms; their education was entrusted to the Labour Department.',
            ta: 'கல்விச் சீர்திருத்தங்கள் மூலம் தாழ்த்தப்பட்ட வகுப்பினரின் நிலை மேம்படுத்தப்பட்டது; அவர்களின் கல்வி தொழிலாளர் துறையிடம் ஒப்படைக்கப்பட்டது.',
          },
        ],
      },
      {
        marker: '1920',
        heading: { en: 'Mid-day meal scheme', ta: 'மதிய உணவுத் திட்டம்' },
        body: {
          en: 'Based on the idea of P. Theagaraya Chetty (then President of the Justice Party), the first Chief Minister A. Subbarayalu Reddiar implemented the mid-day meal scheme in a Corporation school in the Thousand Lights area.',
          ta: 'அப்போதைய நீதிக் கட்சித் தலைவர் பி. தியாகராய செட்டியின் கருத்தின் அடிப்படையில், முதல் முதலமைச்சர் ஏ. சுப்பராயலு ரெட்டியார், ஆயிரம் விளக்குப் பகுதியில் உள்ள ஒரு கார்ப்பரேஷன் பள்ளியில் மதிய உணவுத் திட்டத்தைச் செயல்படுத்தினார்.',
        },
      },
      {
        marker: '1921',
        heading: { en: "Temple reform & women's vote", ta: 'கோயில் சீர்திருத்தம் & பெண்களின் வாக்குரிமை' },
        body: {
          en: 'The Hindu Religious Endowment Act, enacted by the Panagal Ministry, sought to eliminate corruption in temple management. For the first time, women’s participation in electoral politics was approved, with the vote on the same basis as men.',
          ta: 'பனகல் அமைச்சகத்தால் இயற்றப்பட்ட இந்து சமய அறநிலையச் சட்டம் கோயில் நிர்வாகத்தில் ஊழலை ஒழிக்க முயன்றது. முதல் முறையாகப் பெண்கள் தேர்தல் அரசியலில் பங்கேற்பது அங்கீகரிக்கப்பட்டது; ஆண்களைப் போலவே பெண்களும் வாக்களிக்க வழி செய்யப்பட்டது.',
        },
      },
      {
        marker: '1922',
        heading: { en: 'Industries & communal G.O.s', ta: 'தொழில்கள் & வகுப்புவாரி அரசாணைகள்' },
        body: {
          en: 'The Madras State Aid to Industries Act was passed, leading to new industries - sugar factories, engineering works, tanneries, aluminium and cement factories - by providing credit and allotting land and water. Two communal G.O.s (1921 & 1922) reserved appointments in local bodies and educational institutions for non-Brahmins in increased proportion.',
          ta: 'மெட்ராஸ் மாநில தொழில் உதவிச் சட்டம் நிறைவேற்றப்பட்டது; கடன், நிலம் மற்றும் நீர் வழங்கி சர்க்கரை ஆலைகள், பொறியியல் பணிகள், தோல் பதனிடும் தொழிற்சாலைகள், அலுமினியம் மற்றும் சிமெண்ட் தொழிற்சாலைகள் போன்ற புதிய தொழில்களை உருவாக்க வழிவகுத்தது. 1921 & 1922 ஆம் ஆண்டுகளில் இரண்டு வகுப்புவாரி அரசாணைகள், உள்ளாட்சி அமைப்புகள் மற்றும் கல்வி நிறுவனங்களில் பிராமணரல்லாதவர்களுக்கு அதிக விகிதத்தில் நியமனங்களை ஒதுக்கின.',
        },
      },
      {
        marker: '1924',
        heading: { en: 'Staff Selection Board', ta: 'பணியாளர் தேர்வு வாரியம்' },
        body: {
          en: 'The Staff Selection Board (SSB) was established. In 1929 it was renamed the Public Service Commission - the first of its kind in India - giving adequate representation to non-Brahmins in public services.',
          ta: 'பணியாளர் தேர்வு வாரியம் (SSB) நிறுவப்பட்டது. 1929 இல் இது பொதுப் பணியாளர் தேர்வாணையம் என மறுபெயரிடப்பட்டது - இந்தியாவிலேயே இது போன்ற முதல் அமைப்பு - அரசுப் பணிகளில் பிராமணரல்லாதவர்களுக்குப் போதுமான பிரதிநிதித்துவம் வழங்கியது.',
        },
      },
      {
        marker: '1926',
        heading: { en: 'First woman legislator & Andhra University', ta: 'முதல் பெண் சட்டமன்ற உறுப்பினர் & ஆந்திரப் பல்கலைக்கழகம்' },
        body: {
          en: 'Muthulakshmi Ammaiyar became the first woman legislator in 1926. In the same year, Andhra University was established.',
          ta: 'முத்துலட்சுமி அம்மையார் 1926 இல் முதல் பெண் சட்டமன்ற உறுப்பினரானார். அதே ஆண்டில் ஆந்திரப் பல்கலைக்கழகம் நிறுவப்பட்டது.',
        },
      },
      {
        marker: '1929',
        heading: { en: 'Annamalai University', ta: 'அண்ணாமலைப் பல்கலைக்கழகம்' },
        body: {
          en: 'Annamalai University was established.',
          ta: 'அண்ணாமலைப் பல்கலைக்கழகம் நிறுவப்பட்டது.',
        },
      },
      {
        marker: '1930',
        heading: { en: 'Devadasi Abolition Bill', ta: 'தேவதாசி ஒழிப்பு மசோதா' },
        body: {
          en: 'Muthulakshmi Ammaiyar introduced a bill on the "Prevention of the dedication of women to Hindu temples in the Presidency of Madras". After 15 years it became the Devadasi Abolition Act, which declared the "Pottukattu ceremony" unlawful in any place of worship, gave devadasis legal sanction to marry, and prescribed a minimum 5 years’ imprisonment for aiding and abetting the system.',
          ta: 'முத்துலட்சுமி அம்மையார் "மெட்ராஸ் மாகாணத்தில் இந்துக் கோயில்களுக்குப் பெண்கள் அர்ப்பணிக்கப்படுவதைத் தடுப்பது" குறித்த மசோதாவை அறிமுகப்படுத்தினார். 15 ஆண்டுகளுக்குப் பிறகு இது தேவதாசி ஒழிப்புச் சட்டமாக மாறியது - எந்தவொரு வழிபாட்டுத் தலத்திலும் "பொட்டுக்கட்டு" சடங்கைச் சட்டவிரோதமாக அறிவித்தது, தேவதாசிகள் திருமணம் செய்துகொள்ள சட்ட அனுமதி வழங்கியது, மேலும் இம்முறைக்கு உதவி செய்வோருக்குக் குறைந்தபட்சம் 5 ஆண்டு சிறைத் தண்டனை விதித்தது.',
        },
      },
      {
        heading: { en: 'Other reforms', ta: 'பிற சீர்திருத்தங்கள்' },
        bullets: [
          {
            en: 'Nearly 3,000 fisher boys and girls were given free training by the Fisheries Department.',
            ta: 'மீன்வளத் துறையால் ஏறக்குறைய 3,000 மீனவச் சிறுவர்/சிறுமியருக்கு இலவசப் பயிற்சி அளிக்கப்பட்டது.',
          },
          {
            en: 'The government took over the power of appointing District Munsiffs from the High Court.',
            ta: 'மாவட்ட முன்சீப்களை நியமிக்கும் அதிகாரத்தை உயர் நீதிமன்றத்திடமிருந்து அரசு எடுத்துக்கொண்டது.',
          },
          {
            en: 'Poromboke lands were allotted to the poor and depressed classes.',
            ta: 'ஏழை மற்றும் தாழ்த்தப்பட்ட வகுப்பினருக்குப் பொரம்போக்கு நிலங்கள் ஒதுக்கப்பட்டன.',
          },
          {
            en: 'A road scheme was introduced for village improvement.',
            ta: 'கிராம மேம்பாட்டுக்காகச் சாலைத் திட்டம் அறிமுகப்படுத்தப்பட்டது.',
          },
          {
            en: 'The Town Improvement Committee of Madras Corporation introduced slum-clearance and housing schemes.',
            ta: 'மெட்ராஸ் மாநகராட்சியின் நகர மேம்பாட்டுக் குழு குடிசை மாற்று மற்றும் வீட்டுவசதித் திட்டங்களை அறிமுகப்படுத்தியது.',
          },
          {
            en: 'Ayurveda, Siddha and Unani medical education were encouraged.',
            ta: 'ஆயுர்வேதம், சித்தா மற்றும் யுனானி மருத்துவக் கல்வி ஊக்குவிக்கப்பட்டது.',
          },
          {
            en: 'Discrimination against Sudras and Panchamas on public roads, transport, restaurants and public wells was removed.',
            ta: 'பொது சாலைகள், போக்குவரத்து, உணவகங்கள் மற்றும் பொது கிணறுகளில் சூத்திரர்கள் மற்றும் பஞ்சமர்களுக்கு எதிரான பாகுபாடு நீக்கப்பட்டது.',
          },
          {
            en: 'Knowledge of Sanskrit as the basic eligibility for medical education was removed.',
            ta: 'மருத்துவக் கல்விக்கு அடிப்படைத் தகுதியாக இருந்த சமஸ்கிருத அறிவுத் தேவை நீக்கப்பட்டது.',
          },
        ],
      },
    ],
  },
]
