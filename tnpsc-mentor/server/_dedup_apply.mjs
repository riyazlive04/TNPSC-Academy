/**
 * Apply duplicate resolution decided 2026-08-19:
 *  - groundnut answer-conflict pair: delete the India(A) row, keep China(D) row (China is the
 *    real-world largest groundnut producer per FAO data).
 *  - 16 other true-duplicate pairs (15 in 'outer', 1 in 'pyq2'): keep one row untouched, REWRITE
 *    the other into a genuinely different, fact-checked question on the same subject/topic so the
 *    bank doesn't shrink and there's no more literal duplication.
 * Backs up full original rows to JSON before any mutation. Report-only unless --write is passed.
 */
import 'dotenv/config'
import { Client } from 'pg'
import { writeFileSync } from 'node:fs'

const WRITE = process.argv.includes('--write')
const c = new Client({
  host: process.env.SUPABASE_DB_HOST, port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()

const DELETE_ID = '8b9b6720-5bc1-4ac6-910a-b6b161c07ec6' // groundnut, wrong answer (India/A)

const REWRITES = [
  {
    id: '21090a79-5dce-46fd-bb2f-6c1c9c36d582',
    question_text: "Charles's Law states that at constant pressure, the volume of a given mass of gas is directly proportional to its",
    question_text_ta: 'மாறா அழுத்தத்தில், ஒரு குறிப்பிட்ட வாயு நிறையின் கன அளவு அதன் எதற்கு நேர் விகிதமாக மாறும் என்பதைச் சார்லஸ் விதி கூறுகிறது?',
    option_a: 'Temperature (Kelvin)', option_b: 'Pressure', option_c: 'Mass', option_d: 'Density',
    option_a_ta: 'வெப்பநிலை (கெல்வின்)', option_b_ta: 'அழுத்தம்', option_c_ta: 'நிறை', option_d_ta: 'அடர்த்தி',
    correct_answer: 'A',
    explanation: "Charles's Law states that at constant pressure, the volume of a fixed mass of gas is directly proportional to its absolute temperature (in Kelvin): V/T = constant. As the temperature of a gas increases, its volume increases proportionally, provided pressure remains unchanged.",
    explanation_ta: 'மாறா அழுத்தத்தில், ஒரு நிலையான நிறையுள்ள வாயுவின் கன அளவு அதன் தனிமுழு வெப்பநிலைக்கு (கெல்வினில்) நேர் விகிதமாக இருக்கும் என்பதை சார்லஸ் விதி (Charles\'s Law) கூறுகிறது: V/T = மாறிலி. அழுத்தம் மாறாமல் இருக்கும் வரை, வாயுவின் வெப்பநிலை அதிகரிக்கும்போது அதன் கன அளவும் அதற்கேற்ப அதிகரிக்கும்.',
  },
  {
    id: '146415e3-9e91-4fe4-997d-713ad2cdbfb5',
    question_text: 'Deficiency of which vitamin causes the disease Scurvy?',
    question_text_ta: "எந்த வைட்டமின் குறைபாடு 'ஸ்கர்வி' (Scurvy) நோயை ஏற்படுத்துகிறது?",
    option_a: 'Vitamin A', option_b: 'Vitamin C', option_c: 'Vitamin D', option_d: 'Vitamin K',
    option_a_ta: 'வைட்டமின் A', option_b_ta: 'வைட்டமின் C', option_c_ta: 'வைட்டமின் D', option_d_ta: 'வைட்டமின் K',
    correct_answer: 'B',
    explanation: 'Scurvy is caused by a deficiency of Vitamin C (ascorbic acid), essential for collagen synthesis and wound healing. Symptoms include bleeding gums, fatigue, and joint pain. It is prevented by consuming citrus fruits like oranges and lemons.',
    explanation_ta: 'ஸ்கர்வி (Scurvy) நோய் வைட்டமின் C (அஸ்கார்பிக் அமிலம்) குறைபாட்டால் ஏற்படுகிறது; இது கொலாஜன் உற்பத்திக்கும் காயம் ஆறுவதற்கும் இன்றியமையாதது. ஈறுகளில் இரத்தப்போக்கு, சோர்வு, மூட்டு வலி ஆகியவை இதன் அறிகுறிகள். ஆரஞ்சு, எலுமிச்சை போன்ற சிட்ரஸ் பழங்களை உண்பதன் மூலம் இதைத் தடுக்கலாம்.',
  },
  {
    id: '7df31de0-8246-42bd-8290-38ded2645b20',
    question_text: 'The change of a substance directly from the solid state to the gaseous state, without passing through the liquid state, is called',
    question_text_ta: 'ஒரு பொருள் திரவ நிலையைக் கடக்காமல் நேரடியாக திண்ம நிலையிலிருந்து வாயு நிலைக்கு மாறுவது எவ்வாறு அழைக்கப்படுகிறது?',
    option_a: 'Evaporation', option_b: 'Sublimation', option_c: 'Condensation', option_d: 'Deposition',
    option_a_ta: 'ஆவியாதல்', option_b_ta: 'படிகமாதல் (சப்ளிமேஷன்)', option_c_ta: 'உறைதல்', option_d_ta: 'படிவாதல்',
    correct_answer: 'B',
    explanation: 'Sublimation is the process by which a substance changes directly from the solid phase to the gas phase without passing through the intermediate liquid phase. Dry ice (solid carbon dioxide) and naphthalene balls are common examples of substances that sublime at room temperature.',
    explanation_ta: "ஒரு பொருள் இடைநிலை திரவ நிலையைக் கடக்காமல் நேரடியாக திண்ம நிலையிலிருந்து வாயு நிலைக்கு மாறும் செயல்முறை 'சப்ளிமேஷன்' (Sublimation) எனப்படும். உலர் பனிக்கட்டி (திண்ம கார்பன் டைஆக்சைடு) மற்றும் நாப்தலீன் உருண்டைகள் அறை வெப்பநிலையில் சப்ளிமேஷன் அடையும் பொதுவான எடுத்துக்காட்டுகள் ஆகும்.",
  },
  {
    id: 'dabf5ee8-837e-405b-8d59-2c8507efa3bc',
    question_text: 'The Indian economy is best classified as a',
    question_text_ta: 'இந்திய பொருளாதாரம் எந்த வகையைச் சேர்ந்ததாக வகைப்படுத்தப்படுகிறது?',
    option_a: 'Capitalist economy', option_b: 'Socialist economy', option_c: 'Mixed economy', option_d: 'Command economy',
    option_a_ta: 'முதலாளித்துவப் பொருளாதாரம்', option_b_ta: 'சோசலிசப் பொருளாதாரம்', option_c_ta: 'கலவை பொருளாதாரம்', option_d_ta: 'கட்டளைப் பொருளாதாரம்',
    correct_answer: 'C',
    explanation: 'India follows a mixed economy, combining elements of capitalism (private ownership and market forces) with socialism (public sector participation and government planning). This model allows private enterprises and public sector undertakings to coexist and contribute to economic growth.',
    explanation_ta: 'இந்தியா ஒரு கலவை பொருளாதாரத்தை (Mixed Economy) பின்பற்றுகிறது; இது முதலாளித்துவத்தின் கூறுகளையும் (தனியார் உரிமை மற்றும் சந்தை சக்திகள்) சோசலிசத்தின் கூறுகளையும் (பொதுத்துறை பங்களிப்பு மற்றும் அரசு திட்டமிடல்) இணைக்கிறது. தனியார் நிறுவனங்களும் பொதுத்துறை நிறுவனங்களும் இணைந்து பொருளாதார வளர்ச்சிக்குப் பங்களிக்க இது அனுமதிக்கிறது.',
  },
  {
    id: '89f3ca60-f49e-4af7-a3c1-e3c39cc8dee2',
    question_text: 'Which Indian state is currently the largest producer of iron ore?',
    question_text_ta: 'இரும்புத் தாது உற்பத்தியில் தற்போது இந்தியாவின் முதன்மையான மாநிலம் எது?',
    option_a: 'Odisha', option_b: 'Jharkhand', option_c: 'Chhattisgarh', option_d: 'Karnataka',
    option_a_ta: 'ஒடிசா', option_b_ta: 'ஜார்க்கண்ட்', option_c_ta: 'சத்தீஸ்கர்', option_d_ta: 'கர்நாடகா',
    correct_answer: 'A',
    explanation: "Odisha is currently India's largest producer of iron ore, accounting for over half of the country's total production, with major mining regions in Keonjhar, Sundargarh, and Mayurbhanj districts. Chhattisgarh and Jharkhand are also significant producers but rank behind Odisha.",
    explanation_ta: 'இரும்புத் தாது உற்பத்தியில் ஒடிசா தற்போது இந்தியாவின் முதன்மையான மாநிலமாக உள்ளது; நாட்டின் மொத்த உற்பத்தியில் பாதிக்கும் மேற்பட்ட பங்களிப்பை இது வழங்குகிறது. கியோன்ஜார், சுந்தர்கர், மயூர்பஞ்ச் மாவட்டங்கள் முக்கிய சுரங்கப் பகுதிகளாகும். சத்தீஸ்கர் மற்றும் ஜார்க்கண்டும் குறிப்பிடத்தக்க உற்பத்தியாளர்களே, ஆனால் ஒடிசாவிற்குப் பின்னரே வருகின்றன.',
  },
  {
    id: '25afd750-1696-44b6-a651-f8c7294eb3f5',
    question_text: "The tilt of the Earth's axis relative to its orbital plane, which is responsible for the changing seasons, is approximately",
    question_text_ta: 'பருவகாலங்கள் மாறுவதற்குக் காரணமான, பூமியின் அச்சு அதன் சுற்றுப்பாதை தளத்துடன் சாய்ந்திருக்கும் கோணம் தோராயமாக என்ன?',
    option_a: '23.5°', option_b: '45°', option_c: '66.5°', option_d: '90°',
    option_a_ta: '23.5°', option_b_ta: '45°', option_c_ta: '66.5°', option_d_ta: '90°',
    correct_answer: 'A',
    explanation: "The Earth's axis is tilted at approximately 23.5° relative to the plane of its orbit around the Sun. This axial tilt causes different parts of the Earth to receive varying amounts of sunlight throughout the year, resulting in the changing seasons.",
    explanation_ta: 'பூமியின் அச்சு, சூரியனைச் சுற்றியுள்ள அதன் சுற்றுப்பாதை தளத்துடன் தோராயமாக 23.5° கோணத்தில் சாய்ந்துள்ளது. இந்த அச்சுச் சாய்வு காரணமாக, ஆண்டு முழுவதும் பூமியின் வெவ்வேறு பகுதிகள் வெவ்வேறு அளவு சூரிய ஒளியைப் பெறுகின்றன; இதனால் பருவகாலங்கள் மாறுகின்றன.',
  },
  {
    id: '42b3eb54-4078-4305-a033-167ad2a3c858',
    question_text: 'Who is the constitutional (ceremonial) head of the Union Executive in India?',
    question_text_ta: 'இந்தியாவின் ஒன்றியத் தலைமை நிர்வாகத்தின் அரசியலமைப்பு (சம்பிரதாய) தலைவர் யார்?',
    option_a: 'Prime Minister', option_b: 'President', option_c: 'Chief Justice of India', option_d: 'Speaker of Lok Sabha',
    option_a_ta: 'பிரதமர்', option_b_ta: 'குடியரசுத் தலைவர்', option_c_ta: 'இந்திய தலைமை நீதிபதி', option_d_ta: 'மக்களவை சபாநாயகர்',
    correct_answer: 'B',
    explanation: 'The President of India is the constitutional and ceremonial head of the Union Executive, under Article 53 of the Constitution. Real executive power is exercised by the Prime Minister and the Council of Ministers, who are collectively responsible to the Lok Sabha.',
    explanation_ta: 'அரசியலமைப்பின் 53வது பிரிவின்படி, இந்தியக் குடியரசுத் தலைவர் ஒன்றியத் தலைமை நிர்வாகத்தின் அரசியலமைப்பு மற்றும் சம்பிரதாயத் தலைவராவார். உண்மையான நிர்வாக அதிகாரம் பிரதமர் மற்றும் அமைச்சரவையால் செயல்படுத்தப்படுகிறது; இவர்கள் கூட்டாக மக்களவைக்குப் பொறுப்பாளிகள் ஆவர்.',
  },
  {
    id: '30777373-dcc7-4858-a6b5-d966bcbc0978',
    question_text: 'Match List-I with List-II and select the correct answer using the code given below the lists.\n\nList-I\tList-II\n(a) Central Assembly Bomb Case (1929)\t1. Bhagat Singh\n(b) Muzaffarpur Bomb Case (1908)\t2. Khudiram Bose\n(c) Assassination of Curzon Wyllie (1909)\t3. Madan Lal Dhingra\n(d) Delhi Conspiracy Case (1912)\t4. Rash Behari Bose\n\nCode:',
    question_text_ta: 'பட்டியல்-I ஐ பட்டியல்-II உடன் பொருத்தி கீழே கொடுக்கப்பட்ட குறியீட்டைப் பயன்படுத்தி சரியான விடையைத் தேர்ந்தெடுக்கவும்.\n\nபட்டியல்-I\tபட்டியல்-II\n(a) மத்திய சட்டமன்ற குண்டு வெடிப்பு வழக்கு (1929)\t1. பகத் சிங்\n(b) முசாபர்பூர் குண்டு வெடிப்பு வழக்கு (1908)\t2. குதிராம் போஸ்\n(c) கர்சன் வைலி படுகொலை (1909)\t3. மதன்லால் திங்ரா\n(d) டெல்லி சதி வழக்கு (1912)\t4. ராஷ் பிஹாரி போஸ்\n\nகுறியீடு:',
    option_a: '1 2 3 4', option_b: '2 1 4 3', option_c: '4 3 2 1', option_d: '3 4 1 2',
    option_a_ta: '1 2 3 4', option_b_ta: '2 1 4 3', option_c_ta: '4 3 2 1', option_d_ta: '3 4 1 2',
    correct_answer: 'A',
    explanation: "Bhagat Singh (with Batukeshwar Dutt) threw a bomb in the Central Legislative Assembly in 1929. Khudiram Bose was involved in the Muzaffarpur Bomb Case of 1908. Madan Lal Dhingra assassinated Curzon Wyllie in London in 1909. Rash Behari Bose was the mastermind behind the 1912 Delhi Conspiracy Case, in which a bomb was thrown at Viceroy Lord Hardinge's procession.",
    explanation_ta: 'பகத் சிங் (பதுகேஷ்வர் தத்துடன் சேர்ந்து) 1929ல் மத்திய சட்டமன்றத்தில் குண்டு வீசினார். குதிராம் போஸ் 1908ஆம் ஆண்டு முசாபர்பூர் குண்டுவெடிப்பு வழக்கில் தொடர்புடையவர். மதன்லால் திங்ரா 1909ல் லண்டனில் கர்சன் வைலியைப் படுகொலை செய்தார். ராஷ் பிஹாரி போஸ், 1912ஆம் ஆண்டு வைசிராய் லார்டு ஹார்டிங்கின் ஊர்வலத்தின் மீது குண்டு வீசப்பட்ட டெல்லி சதி வழக்கின் முக்கிய சூத்திரதாரி ஆவார்.',
  },
  {
    id: '4462c798-9713-498f-be93-5e9829bd637e',
    question_text: 'Given below is a list of some revolutionary events. Select their correct chronological order by using the codes given at the end.\n\n1. Kakori Conspiracy Case\n2. Muzaffarpur Bomb Case\n3. Chittagong Armoury Raid\n4. Central Assembly Bomb Case',
    question_text_ta: 'கீழே சில புரட்சிகர நிகழ்வுகளின் பட்டியல் கொடுக்கப்பட்டுள்ளது. இறுதியில் கொடுக்கப்பட்ட குறியீடுகளைப் பயன்படுத்தி அவற்றின் சரியான காலமுறை வரிசையைத் தேர்ந்தெடுக்கவும்.\n\n1. காக்கோரி சதி வழக்கு\n2. முசாபர்பூர் குண்டு வெடிப்பு வழக்கு\n3. சிட்டகாங் ஆயுதக் கிடங்கு தாக்குதல்\n4. மத்திய சட்டமன்ற குண்டு வெடிப்பு வழக்கு',
    option_a: '2, 1, 4, 3', option_b: '1, 2, 3, 4', option_c: '3, 4, 1, 2', option_d: '4, 3, 2, 1',
    option_a_ta: '2, 1, 4, 3', option_b_ta: '1, 2, 3, 4', option_c_ta: '3, 4, 1, 2', option_d_ta: '4, 3, 2, 1',
    correct_answer: 'A',
    explanation: 'The correct chronological order is: Muzaffarpur Bomb Case (1908) → Kakori Conspiracy Case (1925) → Central Assembly Bomb Case (1929) → Chittagong Armoury Raid (1930). This corresponds to the sequence 2, 1, 4, 3 in the given list.',
    explanation_ta: 'சரியான காலமுறை வரிசை: முசாபர்பூர் குண்டு வெடிப்பு வழக்கு (1908) → காக்கோரி சதி வழக்கு (1925) → மத்திய சட்டமன்ற குண்டு வெடிப்பு வழக்கு (1929) → சிட்டகாங் ஆயுதக் கிடங்கு தாக்குதல் (1930). இது கொடுக்கப்பட்ட பட்டியலில் 2, 1, 4, 3 என்ற வரிசைக்கு ஒத்திருக்கிறது.',
  },
  {
    id: '618b6b7c-561f-4fed-9118-4017360baa86',
    question_text: 'The SI unit of heat energy is',
    question_text_ta: 'வெப்ப ஆற்றலின் SI அலகு எது?',
    option_a: 'Joule', option_b: 'Watt', option_c: 'Kelvin', option_d: 'Calorie',
    option_a_ta: 'ஜூல்', option_b_ta: 'வாட்', option_c_ta: 'கெல்வின்', option_d_ta: 'கலோரி',
    correct_answer: 'A',
    explanation: 'The SI unit of heat energy is the Joule (J), named after the physicist James Prescott Joule. Although calorie is a commonly used unit for heat energy, it is not an SI unit; 1 calorie is equal to approximately 4.184 joules.',
    explanation_ta: 'வெப்ப ஆற்றலின் SI அலகு ஜூல் (J) ஆகும்; இது இயற்பியலாளர் ஜேம்ஸ் ப்ரெஸ்காட் ஜூல் என்பவரின் பெயரால் அழைக்கப்படுகிறது. கலோரி வெப்ப ஆற்றலுக்குப் பொதுவாகப் பயன்படுத்தப்படும் அலகு என்றாலும், அது SI அலகு அல்ல; 1 கலோரி தோராயமாக 4.184 ஜூலுக்குச் சமமாகும்.',
  },
  {
    id: '81a78d84-e231-4b6b-af43-b4f15f42779a',
    question_text: 'The Constitution of India was adopted by the Constituent Assembly on',
    question_text_ta: 'இந்திய அரசியலமைப்பு அமைப்புச் சட்டமன்றத்தால் எந்த நாளில் ஏற்றுக்கொள்ளப்பட்டது?',
    option_a: '26 January 1950', option_b: '26 November 1949', option_c: '15 August 1947', option_d: '26 January 1949',
    option_a_ta: '1950 ஜனவரி 26', option_b_ta: '1949 நவம்பர் 26', option_c_ta: '1947 ஆகஸ்ட் 15', option_d_ta: '1949 ஜனவரி 26',
    correct_answer: 'B',
    explanation: 'The Constitution of India was adopted by the Constituent Assembly on 26 November 1949, though it came into force on 26 January 1950, celebrated as Republic Day. 26 November is observed as Constitution Day (Samvidhan Divas).',
    explanation_ta: 'இந்திய அரசியலமைப்பு 1949 நவம்பர் 26 அன்று அமைப்புச் சட்டமன்றத்தால் ஏற்றுக்கொள்ளப்பட்டது; எனினும் இது 1950 ஜனவரி 26 அன்று நடைமுறைக்கு வந்தது, இந்நாள் குடியரசு தினமாகக் கொண்டாடப்படுகிறது. நவம்பர் 26 அரசியலமைப்பு தினமாக (சம்விதான் திவாஸ்) அனுசரிக்கப்படுகிறது.',
  },
  {
    id: '303a8e37-f96c-4814-aa3e-df530752d494',
    question_text: 'Which of the following Union Territories has its own Legislative Assembly?',
    question_text_ta: 'பின்வரும் ஒன்றியப் பிரதேசங்களில் எது தனது சொந்த சட்டமன்றத்தைக் கொண்டுள்ளது?',
    option_a: 'Chandigarh', option_b: 'Lakshadweep', option_c: 'Puducherry', option_d: 'Andaman and Nicobar Islands',
    option_a_ta: 'சண்டிகர்', option_b_ta: 'லட்சத்தீவுகள்', option_c_ta: 'புதுச்சேரி', option_d_ta: 'அந்தமான் நிக்கோபார் தீவுகள்',
    correct_answer: 'C',
    explanation: 'Among Union Territories, Puducherry has its own elected Legislative Assembly and Council of Ministers, similar to a state, though it remains under the administrative control of the Union Government. Chandigarh, Lakshadweep, and the Andaman and Nicobar Islands do not have legislative assemblies.',
    explanation_ta: 'ஒன்றியப் பிரதேசங்களில், புதுச்சேரி ஒரு மாநிலத்தைப் போலவே தேர்ந்தெடுக்கப்பட்ட சொந்த சட்டமன்றத்தையும் அமைச்சரவையையும் கொண்டுள்ளது; எனினும் இது ஒன்றிய அரசின் நிர்வாகக் கட்டுப்பாட்டின் கீழேயே உள்ளது. சண்டிகர், லட்சத்தீவுகள், அந்தமான் நிக்கோபார் தீவுகள் ஆகியவற்றிற்கு சட்டமன்றங்கள் இல்லை.',
  },
  {
    id: '04571cba-1f8e-4649-9d7b-96eb2f894481',
    question_text: 'தமிழ் மொழியில் உயிர் எழுத்துக்கள் எத்தனை?',
    question_text_ta: 'தமிழ் மொழியில் உயிர் எழுத்துக்கள் எத்தனை?',
    option_a: '12', option_b: '18', option_c: '216', option_d: '247',
    option_a_ta: '12', option_b_ta: '18', option_c_ta: '216', option_d_ta: '247',
    correct_answer: 'A',
    explanation: 'தமிழ் மொழியில் உயிர் எழுத்துக்கள் ஆறு நெடிலும் ஆறு குறிலும் என மொத்தம் 12 ஆகும் (அ, ஆ, இ, ஈ, உ, ஊ, எ, ஏ, ஐ, ஒ, ஓ, ஔ). இவை தமிழ் எழுத்துக்களின் அடிப்படை வகைகளில் ஒன்றாகும்; மற்ற இரண்டு வகைகள் மெய் எழுத்து (18) மற்றும் உயிர்மெய் எழுத்து (216) ஆகும்.',
    explanation_ta: 'தமிழ் மொழியில் உயிர் எழுத்துக்கள் ஆறு நெடிலும் ஆறு குறிலும் என மொத்தம் 12 ஆகும் (அ, ஆ, இ, ஈ, உ, ஊ, எ, ஏ, ஐ, ஒ, ஓ, ஔ). இவை தமிழ் எழுத்துக்களின் அடிப்படை வகைகளில் ஒன்றாகும்; மற்ற இரண்டு வகைகள் மெய் எழுத்து (18) மற்றும் உயிர்மெய் எழுத்து (216) ஆகும்.',
  },
  {
    id: '2bb93bc4-9aff-4759-99ee-f9808357ea03',
    question_text: 'Which of the following diseases is caused by a virus?',
    question_text_ta: 'பின்வரும் நோய்களில் எது ஒரு வைரஸால் ஏற்படுகிறது?',
    option_a: 'Typhoid', option_b: 'Cholera', option_c: 'Chickenpox', option_d: 'Tuberculosis',
    option_a_ta: 'டைபாய்டு', option_b_ta: 'காலரா', option_c_ta: 'நீர்க்கொப்புளம் (சிக்கன்பாக்ஸ்)', option_d_ta: 'காசநோய்',
    correct_answer: 'C',
    explanation: 'Chickenpox is caused by the Varicella-Zoster virus, characterised by itchy, fluid-filled blisters on the skin. Typhoid and Cholera are caused by bacteria (Salmonella typhi and Vibrio cholerae respectively), and Tuberculosis is caused by the bacterium Mycobacterium tuberculosis.',
    explanation_ta: 'நீர்க்கொப்புளம் (சிக்கன்பாக்ஸ்) வெரிசெல்லா-ஸோஸ்டர் (Varicella-Zoster) வைரஸால் ஏற்படுகிறது; இது தோலில் அரிப்புடன் கூடிய திரவம் நிறைந்த கொப்புளங்களை உண்டாக்கும். மாறாக, டைபாய்டு மற்றும் காலரா முறையே சால்மோனெல்லா டைபி மற்றும் விப்ரியோ காலரே எனும் பாக்டீரியாக்களால் ஏற்படுகின்றன; காசநோய் மைக்கோபாக்டீரியம் டியூபர்குலோசிஸ் எனும் பாக்டீரியத்தால் ஏற்படுகிறது.',
  },
  {
    id: '0122a25e-1610-435c-9676-a37a165e68e4',
    question_text: 'Match List-I with List-II and select the correct answer using the code given below the lists.\n\nList-I\tList-II\n(a) Anushilan Samiti\t1. Pramatha Nath Mitra\n(b) India House, London\t2. Shyamji Krishna Varma\n(c) Ghadar Party\t3. Lala Har Dayal\n(d) Hindustan Socialist Republican Association\t4. Chandra Shekhar Azad\n\nCode:',
    question_text_ta: 'பட்டியல்-I ஐ பட்டியல்-II உடன் பொருத்தி கீழே கொடுக்கப்பட்ட குறியீட்டைப் பயன்படுத்தி சரியான விடையைத் தேர்ந்தெடுக்கவும்.\n\nபட்டியல்-I\tபட்டியல்-II\n(a) அனுஷீலன் சமிதி\t1. பிரமத நாத் மித்ரா\n(b) இந்தியா ஹவுஸ், லண்டன்\t2. ஷியாம்ஜி கிருஷ்ண வர்மா\n(c) கதர் கட்சி\t3. லாலா ஹர் தயாள்\n(d) இந்துஸ்தான் சோசலிச குடியரசு சங்கம்\t4. சந்திரசேகர் ஆசாத்\n\nகுறியீடு:',
    option_a: '1 2 3 4', option_b: '4 3 2 1', option_c: '2 1 4 3', option_d: '3 4 1 2',
    option_a_ta: '1 2 3 4', option_b_ta: '4 3 2 1', option_c_ta: '2 1 4 3', option_d_ta: '3 4 1 2',
    correct_answer: 'A',
    explanation: 'Anushilan Samiti was founded by Pramatha Nath (Barrister P.) Mitra in Calcutta in 1902. India House in London was established by Shyamji Krishna Varma in 1905 as a hub for Indian revolutionaries abroad. The Ghadar Party, founded in San Francisco in 1913, was closely associated with Lala Har Dayal. The Hindustan Socialist Republican Association was led by Chandra Shekhar Azad following its reorganization in 1928.',
    explanation_ta: 'அனுஷீலன் சமிதியை பிரமத நாத் (பாரிஸ்டர் பி.) மித்ரா 1902ல் கல்கத்தாவில் நிறுவினார். லண்டனில் உள்ள இந்தியா ஹவுஸை ஷியாம்ஜி கிருஷ்ண வர்மா 1905ல் நிறுவினார்; இது வெளிநாட்டில் இந்தியப் புரட்சியாளர்களின் மையமாக இருந்தது. 1913ல் சான் பிரான்சிஸ்கோவில் நிறுவப்பட்ட கதர் கட்சி, லாலா ஹர் தயாளுடன் நெருங்கிய தொடர்புடையது. இந்துஸ்தான் சோசலிச குடியரசு சங்கம் 1928ல் மறுசீரமைக்கப்பட்ட பின்னர் சந்திரசேகர் ஆசாத் தலைமையில் இயங்கியது.',
  },
  {
    id: '9d5e594c-b109-4cb2-b576-70eb82e10d29',
    question_text: "Who is the author of the autobiography 'Wings of Fire'?",
    question_text_ta: null,
    option_a: 'A.P.J. Abdul Kalam', option_b: 'R.K. Narayan', option_c: 'Vikram Seth', option_d: 'Ruskin Bond',
    option_a_ta: null, option_b_ta: null, option_c_ta: null, option_d_ta: null,
    correct_answer: 'A',
    explanation: "'Wings of Fire: An Autobiography' (1999) was written by Dr. A.P.J. Abdul Kalam, in collaboration with Arun Tiwari. The book traces Kalam's journey from a humble background in Rameswaram to becoming one of India's foremost aerospace scientists and later the President of India.",
    explanation_ta: null,
  },
]

console.log(`=== DEDUP APPLY ${WRITE ? '(WRITE)' : '(DRY RUN)'} ===`)
console.log(`rewrites planned: ${REWRITES.length}, delete planned: 1 (groundnut/India row)`)

const allIds = [...REWRITES.map((r) => r.id), DELETE_ID]
const { rows: backupRows } = await c.query('select * from questions where id = any($1::uuid[])', [allIds])
if (backupRows.length !== allIds.length) {
  console.error(`WARNING: expected ${allIds.length} rows, found ${backupRows.length}. Aborting.`)
  await c.end()
  process.exit(1)
}
writeFileSync('_dedup_apply_backup.json', JSON.stringify(backupRows, null, 1))
console.log(`backed up ${backupRows.length} original rows to server/_dedup_apply_backup.json`)

if (!WRITE) {
  console.log('DRY RUN — no changes made. Re-run with --write to apply.')
  await c.end()
  process.exit(0)
}

let updated = 0
for (const r of REWRITES) {
  const res = await c.query(
    `update questions set question_text=$1, question_text_ta=$2,
       option_a=$3, option_b=$4, option_c=$5, option_d=$6,
       option_a_ta=$7, option_b_ta=$8, option_c_ta=$9, option_d_ta=$10,
       correct_answer=$11, explanation=$12, explanation_ta=$13
     where id=$14`,
    [r.question_text, r.question_text_ta, r.option_a, r.option_b, r.option_c, r.option_d,
      r.option_a_ta, r.option_b_ta, r.option_c_ta, r.option_d_ta,
      r.correct_answer, r.explanation, r.explanation_ta, r.id]
  )
  updated += res.rowCount
}
console.log(`rewritten rows: ${updated}`)

const del = await c.query('delete from questions where id=$1', [DELETE_ID])
console.log(`deleted rows: ${del.rowCount} (groundnut India/A row)`)

await c.end()
