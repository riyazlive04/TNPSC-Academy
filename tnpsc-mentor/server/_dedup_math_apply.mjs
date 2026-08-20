/**
 * Resolve 27 near-duplicate 'LCM and HCF' / 'Percentage' aptitude questions found 2026-08-19.
 * These were NOT byte-identical (missed by the earlier full-content dedup) but are the same
 * underlying math problem restated with reordered options. All were independently re-verified;
 * no answer-key conflicts existed (every copy already had the mathematically correct value under
 * a different option letter). Policy: keep the row with more student history (seen/attempts),
 * rewrite the other into a genuinely different problem of the same type, following this bank's
 * established Given/Working/Formula/Asked/Option explanation template in EN + TA.
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

const REWRITES = [
  // ===== LCM and HCF (11) =====
  { id: '5634d14a-b556-4863-98f7-8517b36b5dc8',
    question_text: 'Find the least number that should be added to 89 so that the sum is exactly divisible by 3, 4 and 5.',
    question_text_ta: '3, 4 மற்றும் 5 ஆல் மொத்தம் சரியாக வகுபடும்படி 89 உடன் கூட்டப்பட வேண்டிய மீச்சிறு எண்ணைக் காண்க.',
    option_a: '31', option_b: '29', option_c: '11', option_d: '20', correct_answer: 'A',
    explanation: 'Given:\nNumber \\(= 89\\)\nWorking:\nFormula: L.C.M of 3, 4 and 5 gives the divisor needed\n\\(\\text{L.C.M}(3,4,5) = 60\\)\nNext multiple of 60 after 89 \\(= 120\\)\nNumber to be added \\(= 120 - 89 = 31\\)\nAsked:\nLeast number to be added \\(= 31\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nஎண் \\(= 89\\)\nசெயல்முறை:\nசூத்திரம்: 3, 4, 5 இன் மீ.சி.ம தேவையான வகுத்தியைத் தரும்\n\\(\\text{மீ.சி.ம}(3,4,5) = 60\\)\n89-க்குப் பிறகு வரும் 60-இன் அடுத்த மடங்கு \\(= 120\\)\nகூட்ட வேண்டிய எண் \\(= 120 - 89 = 31\\)\nகேட்டது:\nகூட்ட வேண்டிய குறைந்தபட்ச எண் \\(= 31\\)\nவிடை (A)' },
  { id: '03867245-4bd6-4100-9c99-40d6a689c023',
    question_text: 'Find the smallest number that, when divided by 15 and 20, leaves remainder 3 in each case.',
    question_text_ta: '15 மற்றும் 20 ஆல் வகுக்கும்போது ஒவ்வொரு முறையும் மீதம் 3 வரக்கூடிய மீச்சிறு எண்ணைக் காண்க.',
    option_a: '63', option_b: '60', option_c: '57', option_d: '66', correct_answer: 'A',
    explanation: 'Given:\nDivisors: \\(15, 20\\); remainder \\(= 3\\) in each case\nWorking:\nFormula: Required number \\(= \\text{L.C.M} + \\text{remainder}\\)\n\\(\\text{L.C.M}(15, 20) = 60\\)\nRequired number \\(= 60 + 3 = 63\\)\nAsked:\nSmallest such number \\(= 63\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nவகுத்திகள்: \\(15, 20\\); ஒவ்வொரு முறையும் மீதம் \\(= 3\\)\nசெயல்முறை:\nசூத்திரம்: தேவையான எண் \\(= \\text{மீ.சி.ம} + \\text{மீதம்}\\)\n\\(\\text{மீ.சி.ம}(15, 20) = 60\\)\nதேவையான எண் \\(= 60 + 3 = 63\\)\nகேட்டது:\nமீச்சிறு எண் \\(= 63\\)\nவிடை (A)' },
  { id: '76f74247-9556-471b-aff3-b1212def02c1',
    question_text: 'Find the HCF of 36, 48 and 60.',
    question_text_ta: '36, 48 மற்றும் 60 இன் மீ.பொ.வ (HCF) காண்க.',
    option_a: '12', option_b: '6', option_c: '24', option_d: '4', correct_answer: 'A',
    explanation: 'Given:\nNumbers: \\(36, 48, 60\\)\nWorking:\nFormula: H.C.F = product of the common prime factors\n\\(36 = 2 \\times 2 \\times 3 \\times 3\\)\n\\(48 = 2 \\times 2 \\times 2 \\times 2 \\times 3\\)\n\\(60 = 2 \\times 2 \\times 3 \\times 5\\)\nCommon prime factors \\(= 2 \\times 2 \\times 3\\)\n\\(\\text{H.C.F} = 4 \\times 3 = 12\\)\nAsked:\nH.C.F of 36, 48 and 60 = ?\n\\(= 12\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nஎண்கள்: \\(36, 48, 60\\)\nசெயல்முறை:\nசூத்திரம்: மீ.பொ.வ = பொதுவான பகா காரணிகளின் பெருக்கம்\n\\(36 = 2 \\times 2 \\times 3 \\times 3\\)\n\\(48 = 2 \\times 2 \\times 2 \\times 2 \\times 3\\)\n\\(60 = 2 \\times 2 \\times 3 \\times 5\\)\nபொதுவான பகா காரணிகள் \\(= 2 \\times 2 \\times 3\\)\nமீ.பொ.வ \\(= 4 \\times 3 = 12\\)\nகேட்டது:\n36, 48 மற்றும் 60 இன் மீ.பொ.வ = ?\n\\(= 12\\)\nவிடை (A)' },
  { id: 'c1c652ac-dff7-4e24-a161-0daabd45a3f2',
    question_text: 'The LCM of two numbers is 6 times their HCF. If the HCF is 15 and one of the numbers is 45, find the other number.',
    question_text_ta: 'இரு எண்களின் மீ.சி.ம அவற்றின் மீ.பொ.வ இன் 6 மடங்கு. மீ.பொ.வ 15 மற்றும் ஒரு எண் 45 எனில், மற்றொரு எண்ணைக் காண்க.',
    option_a: '30', option_b: '45', option_c: '60', option_d: '15', correct_answer: 'A',
    explanation: 'Given:\n\\(\\text{H.C.F} = 15\\)\n\\(\\text{L.C.M} = 6 \\times \\text{H.C.F}\\)\nOne number \\(= 45\\)\nWorking:\n\\(\\text{L.C.M} = 6 \\times 15 = 90\\)\nProduct of the two numbers \\(= \\text{L.C.M} \\times \\text{H.C.F}\\)\n\\(45 \\times x = 90 \\times 15\\)\n\\(x = \\dfrac{90 \\times 15}{45} = 30\\)\nAsked:\nOther number \\(x = 30\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\n\\(\\text{மீ.பொ.வ} = 15\\)\n\\(\\text{மீ.சி.ம} = 6 \\times \\text{மீ.பொ.வ}\\)\nஒரு எண் \\(= 45\\)\nசெயல்முறை:\n\\(\\text{மீ.சி.ம} = 6 \\times 15 = 90\\)\nஇரு எண்களின் பெருக்கல்தொகை \\(= \\text{மீ.சி.ம} \\times \\text{மீ.பொ.வ}\\)\n\\(45 \\times x = 90 \\times 15\\)\n\\(x = \\dfrac{90 \\times 15}{45} = 30\\)\nகேட்டது:\nமற்றொரு எண்\n\\(x = 30\\)\nவிடை (A)' },
  { id: 'a11155e0-8d4e-46f0-967b-0ae3a9d70523',
    question_text: 'The LCM of two co-prime numbers is 3599. If one of the numbers is 59, find the other number.',
    question_text_ta: 'இரு இணைப்பகா (co-prime) எண்களின் மீ.சி.ம 3599. அவற்றுள் ஒரு எண் 59 எனில், மற்றொரு எண்ணைக் காண்க.',
    option_a: '61', option_b: '57', option_c: '63', option_d: '55', correct_answer: 'A',
    explanation: 'Given:\nL.C.M of two co-prime numbers \\(= 3599\\)\nOne number \\(= 59\\)\nWorking:\nFormula: for co-prime numbers, L.C.M \\(=\\) product of the numbers\n\\(x = \\dfrac{3599}{59} = 61\\)\nAsked:\nOther number \\(= 61\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nஇரு இணைப்பகா எண்களின் மீ.சி.ம \\(= 3599\\)\nஒரு எண் \\(= 59\\)\nசெயல்முறை:\nசூத்திரம்: இணைப்பகா எண்களுக்கு, மீ.சி.ம \\(=\\) எண்களின் பெருக்கல்தொகை\n\\(x = \\dfrac{3599}{59} = 61\\)\nகேட்டது:\nமற்றொரு எண் \\(= 61\\)\nவிடை (A)' },
  { id: '36e0db2b-3a12-4aac-95a7-17739a6f6b70',
    question_text: 'Find the HCF and LCM of the numbers 84, 108 and 120.',
    question_text_ta: '84, 108 மற்றும் 120 ஆகிய எண்களின் மீ.பொ.வ மற்றும் மீ.சி.ம காண்க.',
    option_a: 'HCF = 12, LCM = 7560', option_b: 'HCF = 7560, LCM = 12', option_c: 'HCF = 6, LCM = 7560', option_d: 'HCF = 12, LCM = 3780', correct_answer: 'A',
    explanation: 'Given:\nNumbers: \\(84, 108, 120\\)\nWorking:\n\\(84 = 2^2 \\times 3 \\times 7\\)\n\\(108 = 2^2 \\times 3^3\\)\n\\(120 = 2^3 \\times 3 \\times 5\\)\n\\(\\text{H.C.F} = 2^2 \\times 3 = 12\\)\n\\(\\text{L.C.M} = 2^3 \\times 3^3 \\times 5 \\times 7 = 7560\\)\nAsked:\nH.C.F and L.C.M of 84, 108 and 120\n\\(= 12, 7560\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nஎண்கள்: \\(84, 108, 120\\)\nசெயல்முறை:\n\\(84 = 2^2 \\times 3 \\times 7\\)\n\\(108 = 2^2 \\times 3^3\\)\n\\(120 = 2^3 \\times 3 \\times 5\\)\nமீ.பொ.வ \\(= 2^2 \\times 3 = 12\\)\nமீ.சி.ம \\(= 2^3 \\times 3^3 \\times 5 \\times 7 = 7560\\)\nகேட்டது:\n84, 108 மற்றும் 120 இன் மீ.பொ.வ மற்றும் மீ.சி.ம\n\\(= 12, 7560\\)\nவிடை (A)' },
  { id: '46d8afb4-f3ba-42dc-92c1-ae118fb2cc2a',
    question_text: 'The LCM of two numbers is 180 and their HCF is 15. How many such pairs of numbers are possible?',
    question_text_ta: 'இரு எண்களின் மீ.சி.ம 180 மற்றும் அவற்றின் மீ.பொ.வ 15. இவ்வாறு எத்தனை ஜோடி எண்கள் இருக்க முடியும்?',
    option_a: '2 pairs', option_b: '1 pair', option_c: '3 pairs', option_d: '4 pairs', correct_answer: 'A',
    explanation: 'Given:\nL.C.M \\(= 180\\), H.C.F \\(= 15\\)\nLet the numbers be \\(15a\\) and \\(15b\\) with \\(a, b\\) co-prime\nWorking:\nFormula: \\(a \\times b = \\dfrac{\\text{L.C.M}}{\\text{H.C.F}}\\)\n\\(ab = \\dfrac{180}{15} = 12\\)\nCo-prime factor pairs of 12: \\((1, 12)\\) and \\((3, 4)\\)\nNumber of such pairs \\(= 2\\)\nAsked:\nNumber of possible pairs = ?\n\\(= 2\\) pairs\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nமீ.சி.ம \\(= 180\\), மீ.பொ.வ \\(= 15\\)\nஎண்களை \\(15a\\), \\(15b\\) என்க; \\(a, b\\) இணைப்பகா\nசெயல்முறை:\nசூத்திரம்: \\(a \\times b = \\dfrac{\\text{மீ.சி.ம}}{\\text{மீ.பொ.வ}}\\)\n\\(ab = \\dfrac{180}{15} = 12\\)\n12-இன் இணைப்பகா காரணி ஜோடிகள்: \\((1, 12)\\) மற்றும் \\((3, 4)\\)\nஇவ்வாறான ஜோடிகளின் எண்ணிக்கை \\(= 2\\)\nகேட்டது:\nசாத்தியமான ஜோடிகளின் எண்ணிக்கை = ?\n\\(= 2\\) ஜோடிகள்\nவிடை (A)' },
  { id: '4911f244-81b5-417a-9709-c52116ae21b3',
    question_text: 'The HCF of two numbers is 3 and their LCM is 120. If the difference between the numbers is 9, find their sum.',
    question_text_ta: 'இரு எண்களின் மீ.பொ.வ 3 மற்றும் மீ.சி.ம 120. அவற்றின் வேறுபாடு 9 எனில், அவற்றின் கூட்டுத்தொகையைக் காண்க.',
    option_a: '39', option_b: '9', option_c: '69', option_d: '45', correct_answer: 'A',
    explanation: 'Given:\nH.C.F \\(= 3\\), L.C.M \\(= 120\\), difference \\(= 9\\)\nLet the numbers be \\(3a\\) and \\(3b\\) with \\(a, b\\) co-prime, \\(a > b\\)\nWorking:\n\\(ab = \\dfrac{\\text{L.C.M}}{\\text{H.C.F}} = \\dfrac{120}{3} = 40\\); \\(3a - 3b = 9 \\Rightarrow a - b = 3\\)\nCo-prime \\(a, b\\) with \\(ab = 40\\), \\(a-b=3\\): \\(a = 8, b = 5\\)\nNumbers \\(= 3 \\times 8 = 24\\) and \\(3 \\times 5 = 15\\)\nSum \\(= 24 + 15 = 39\\)\nAsked:\nSum of the numbers \\(= 39\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nமீ.பொ.வ \\(= 3\\), மீ.சி.ம \\(= 120\\), வேறுபாடு \\(= 9\\)\nஎண்களை \\(3a\\), \\(3b\\) என்க; \\(a, b\\) இணைப்பகா, \\(a > b\\)\nசெயல்முறை:\n\\(ab = \\dfrac{\\text{மீ.சி.ம}}{\\text{மீ.பொ.வ}} = \\dfrac{120}{3} = 40\\); \\(3a - 3b = 9 \\Rightarrow a - b = 3\\)\n\\(ab=40, a-b=3\\) ஆக இணைப்பகா \\(a, b\\): \\(a = 8, b = 5\\)\nஎண்கள் \\(= 3 \\times 8 = 24\\) மற்றும் \\(3 \\times 5 = 15\\)\nகூட்டுத்தொகை \\(= 24 + 15 = 39\\)\nகேட்டது:\nஎண்களின் கூட்டுத்தொகை \\(= 39\\)\nவிடை (A)' },
  { id: '650ee18c-5b46-4248-9615-bbe540d7b649',
    question_text: 'Find the smallest number that is exactly divisible by all the numbers from 1 to 6.',
    question_text_ta: '1 முதல் 6 வரையிலான அனைத்து எண்களாலும் சரியாக வகுபடும் மீச்சிறு எண்ணைக் காண்க.',
    option_a: '60', option_b: '30', option_c: '120', option_d: '90', correct_answer: 'A',
    explanation: 'Given:\nNumbers from 1 to 6\nWorking:\nFormula: required number \\(= \\text{L.C.M}(1,2,3,4,5,6)\\)\n\\(\\text{L.C.M} = 2^2 \\times 3 \\times 5 = 60\\)\nAsked:\nSmallest number divisible by 1 to 6 \\(= 60\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\n1 முதல் 6 வரையிலான எண்கள்\nசெயல்முறை:\nசூத்திரம்: தேவையான எண் \\(= \\text{மீ.சி.ம}(1,2,3,4,5,6)\\)\n\\(\\text{மீ.சி.ம} = 2^2 \\times 3 \\times 5 = 60\\)\nகேட்டது:\n1 முதல் 6 வரை வகுபடும் மீச்சிறு எண் \\(= 60\\)\nவிடை (A)' },
  { id: 'ec78ceed-44fe-4ed6-b60f-c64eb76d84e8',
    question_text: 'Find the HCF of 63 and 84.',
    question_text_ta: '63 மற்றும் 84 இன் மீ.பொ.வ காண்க.',
    option_a: '21', option_b: '7', option_c: '3', option_d: '42', correct_answer: 'A',
    explanation: 'Given:\nNumbers: \\(63, 84\\)\nWorking:\n\\(63 = 3 \\times 3 \\times 7\\)\n\\(84 = 2 \\times 2 \\times 3 \\times 7\\)\nCommon prime factors \\(= 3 \\times 7\\)\n\\(\\text{H.C.F} = 21\\)\nAsked:\nH.C.F of 63 and 84 = ?\n\\(= 21\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nஎண்கள்: \\(63, 84\\)\nசெயல்முறை:\n\\(63 = 3 \\times 3 \\times 7\\)\n\\(84 = 2 \\times 2 \\times 3 \\times 7\\)\nபொதுவான பகா காரணிகள் \\(= 3 \\times 7\\)\nமீ.பொ.வ \\(= 21\\)\nகேட்டது:\n63 மற்றும் 84 இன் மீ.பொ.வ = ?\n\\(= 21\\)\nவிடை (A)' },
  { id: '8d0d3d18-0629-434f-b9a4-47b538d6eb6a',
    question_text: 'What is the greatest number that will divide 25, 43 and 61 leaving remainders 1, 3 and 5 respectively?',
    question_text_ta: '25, 43 மற்றும் 61 ஆகியவற்றை முறையே 1, 3 மற்றும் 5 மீதம் வரும்படி வகுக்கும் மீப்பெரு எண் யாது?',
    option_a: '8', option_b: '4', option_c: '16', option_d: '12', correct_answer: 'A',
    explanation: 'Given:\nDividends: \\(25, 43, 61\\); remainders: \\(1, 3, 5\\)\nWorking:\nFormula: subtract the remainders, then find the H.C.F\n\\(25 - 1 = 24\\), \\(43 - 3 = 40\\), \\(61 - 5 = 56\\)\n\\(\\text{H.C.F}(24, 40, 56) = 8\\)\nAsked:\nGreatest such number \\(= 8\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nவகுபடு எண்கள்: \\(25, 43, 61\\); மீதங்கள்: \\(1, 3, 5\\)\nசெயல்முறை:\nசூத்திரம்: மீதங்களைக் கழித்து, பின் மீ.பொ.வ காண்க\n\\(25 - 1 = 24\\), \\(43 - 3 = 40\\), \\(61 - 5 = 56\\)\n\\(\\text{மீ.பொ.வ}(24, 40, 56) = 8\\)\nகேட்டது:\nமீப்பெரு எண் \\(= 8\\)\nவிடை (A)' },
  // ===== Percentage (16) =====
  { id: '00cc0e01-6c03-42ad-b45e-9b35640db840',
    question_text: '20% of the total number of oranges in a basket is 45. What is the total number of oranges?',
    question_text_ta: 'ஒரு கூடையில் உள்ள மொத்த ஆரஞ்சுகளின் 20% என்பது 45. மொத்த ஆரஞ்சுகளின் எண்ணிக்கை என்ன?',
    option_a: '225', option_b: '180', option_c: '90', option_d: '250', correct_answer: 'A',
    explanation: 'Given:\n20% of total \\(= 45\\) oranges\nWorking:\nFormula: \\(\\dfrac{20}{100} \\times x = 45\\)\n\\(x = 45 \\times \\dfrac{100}{20} = 225\\)\nAsked:\nTotal number of oranges \\(= 225\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nமொத்தத்தின் 20% \\(= 45\\) ஆரஞ்சுகள்\nசெயல்முறை:\nசூத்திரம்: \\(\\dfrac{20}{100} \\times x = 45\\)\n\\(x = 45 \\times \\dfrac{100}{20} = 225\\)\nகேட்டது:\nமொத்த ஆரஞ்சுகளின் எண்ணிக்கை \\(= 225\\)\nவிடை (A)' },
  { id: '13450074-5ede-4031-b124-611f10c78c1f',
    question_text: 'Kumar bought 48 oranges; 6 of them were rotten. What is the percentage of oranges that were rotten? (rounded to two decimals)',
    question_text_ta: 'குமார் 48 ஆரஞ்சுகள் வாங்கினார்; அவற்றுள் 6 அழுகிப்போயின. அழுகிய ஆரஞ்சுகளின் சதவீதம் என்ன? (இரண்டு தசம இடங்களுக்கு)',
    option_a: '12.5%', option_b: '15%', option_c: '8.33%', option_d: '6.25%', correct_answer: 'A',
    explanation: 'Given:\nTotal oranges \\(= 48\\); rotten \\(= 6\\)\nWorking:\nFormula: \\(\\dfrac{\\text{rotten}}{\\text{total}} \\times 100\\)\n\\(\\dfrac{6}{48} \\times 100 = 12.5\\%\\)\nAsked:\nPercentage rotten \\(= 12.5\\%\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nமொத்த ஆரஞ்சுகள் \\(= 48\\); அழுகியவை \\(= 6\\)\nசெயல்முறை:\nசூத்திரம்: \\(\\dfrac{\\text{அழுகியவை}}{\\text{மொத்தம்}} \\times 100\\)\n\\(\\dfrac{6}{48} \\times 100 = 12.5\\%\\)\nகேட்டது:\nஅழுகிய சதவீதம் \\(= 12.5\\%\\)\nவிடை (A)' },
  { id: '68821949-3fa2-4770-9725-acbcfc9a7449',
    question_text: 'In an election between two candidates, Kavi got 65% of the total valid votes. If the total votes were 12,000 and 5% of the votes were invalid, find the number of valid votes Kavi got.',
    question_text_ta: 'இரு வேட்பாளர்களுக்கு இடையேயான தேர்தலில், காவி மொத்த செல்லுபடியான வாக்குகளில் 65% பெற்றார். மொத்த வாக்குகள் 12,000 மற்றும் 5% வாக்குகள் செல்லாதவை எனில், காவி பெற்ற செல்லுபடியான வாக்குகளின் எண்ணிக்கையைக் காண்க.',
    option_a: '7,410', option_b: '7,800', option_c: '6,900', option_d: '7,200', correct_answer: 'A',
    explanation: "Given:\nTotal votes \\(= 12{,}000\\); invalid \\(= 5\\%\\); Kavi's share of valid votes \\(= 65\\%\\)\nWorking:\nValid votes \\(= 95\\% \\times 12{,}000 = 11{,}400\\)\nKavi's votes \\(= 65\\% \\times 11{,}400 = 7{,}410\\)\nAsked:\nValid votes Kavi got \\(= 7{,}410\\)\n→ Option (A)",
    explanation_ta: 'தரவுகள்:\nமொத்த வாக்குகள் \\(= 12{,}000\\); செல்லாதவை \\(= 5\\%\\); காவியின் பங்கு \\(= 65\\%\\)\nசெயல்முறை:\nசெல்லுபடியான வாக்குகள் \\(= 95\\% \\times 12{,}000 = 11{,}400\\)\nகாவி பெற்றவை \\(= 65\\% \\times 11{,}400 = 7{,}410\\)\nகேட்டது:\nகாவி பெற்ற செல்லுபடியான வாக்குகள் \\(= 7{,}410\\)\nவிடை (A)' },
  { id: '32fc7eee-e9aa-4e89-969c-72a3c94483ed',
    question_text: 'A cricket team played 40 matches in a season and won 45% of them. Find the number of matches won by the team.',
    question_text_ta: 'ஒரு கிரிக்கெட் அணி ஒரு பருவத்தில் 40 போட்டிகள் விளையாடி, அவற்றில் 45% வென்றது. அணி வென்ற போட்டிகளின் எண்ணிக்கையைக் காண்க.',
    option_a: '18', option_b: '16', option_c: '20', option_d: '22', correct_answer: 'A',
    explanation: 'Given:\nMatches played \\(= 40\\); won \\(= 45\\%\\)\nWorking:\n\\(45\\% \\times 40 = 18\\)\nAsked:\nMatches won \\(= 18\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nவிளையாடிய போட்டிகள் \\(= 40\\); வென்றவை \\(= 45\\%\\)\nசெயல்முறை:\n\\(45\\% \\times 40 = 18\\)\nகேட்டது:\nவென்ற போட்டிகள் \\(= 18\\)\nவிடை (A)' },
  { id: 'd9210e57-8019-4fe2-a384-d8ed861cf608',
    question_text: 'An employee receives Rs. 18,000 as bonus, which is 12% of his annual salary. What is his monthly salary?',
    question_text_ta: 'ஒரு பணியாளர் தனது ஆண்டு சம்பளத்தில் 12% ஆக ரூ. 18,000 போனஸ் பெறுகிறார். அவரது மாத சம்பளம் என்ன?',
    option_a: 'Rs. 12,500', option_b: 'Rs. 15,000', option_c: 'Rs. 1,500', option_d: 'Rs. 18,750', correct_answer: 'A',
    explanation: 'Given:\nBonus \\(= 12\\%\\) of annual salary \\(=\\) Rs. \\(18{,}000\\)\nWorking:\nAnnual salary \\(= 18{,}000 \\times \\dfrac{100}{12} = 1{,}50{,}000\\)\nMonthly salary \\(= \\dfrac{1{,}50{,}000}{12} = 12{,}500\\)\nAsked:\nMonthly salary \\(=\\) Rs. \\(12{,}500\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nபோனஸ் \\(=\\) ஆண்டு சம்பளத்தின் \\(12\\%\\) \\(=\\) ரூ. \\(18{,}000\\)\nசெயல்முறை:\nஆண்டு சம்பளம் \\(= 18{,}000 \\times \\dfrac{100}{12} = 1{,}50{,}000\\)\nமாத சம்பளம் \\(= \\dfrac{1{,}50{,}000}{12} = 12{,}500\\)\nகேட்டது:\nமாத சம்பளம் \\(=\\) ரூ. \\(12{,}500\\)\nவிடை (A)' },
  { id: 'ada3731d-cfa4-4cd4-a8be-ca5727406b98',
    question_text: 'A woman saves Rs. 2,800 per month from her total salary of Rs. 16,000. What is the percentage of her savings?',
    question_text_ta: 'ஒரு பெண் தனது மொத்த சம்பளம் ரூ. 16,000-இல் இருந்து மாதம் ரூ. 2,800 சேமிக்கிறார். அவரது சேமிப்பின் சதவீதம் என்ன?',
    option_a: '17.5%', option_b: '14%', option_c: '20%', option_d: '12.5%', correct_answer: 'A',
    explanation: 'Given:\nSalary \\(=\\) Rs. \\(16{,}000\\); savings \\(=\\) Rs. \\(2{,}800\\)\nWorking:\n\\(\\dfrac{2{,}800}{16{,}000} \\times 100 = 17.5\\%\\)\nAsked:\nPercentage of savings \\(= 17.5\\%\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nசம்பளம் \\(=\\) ரூ. \\(16{,}000\\); சேமிப்பு \\(=\\) ரூ. \\(2{,}800\\)\nசெயல்முறை:\n\\(\\dfrac{2{,}800}{16{,}000} \\times 100 = 17.5\\%\\)\nகேட்டது:\nசேமிப்பு சதவீதம் \\(= 17.5\\%\\)\nவிடை (A)' },
  { id: '48f57a7d-0456-4948-b29f-cae1f68450a8',
    question_text: "Meena's monthly income is Rs. 9,000. She saves Rs. 1,800. Find the percentage of her savings.",
    question_text_ta: 'மீனாவின் மாத வருமானம் ரூ. 9,000. அவர் ரூ. 1,800 சேமிக்கிறார். அவரது சேமிப்பின் சதவீதத்தைக் காண்க.',
    option_a: '20%', option_b: '18%', option_c: '15%', option_d: '25%', correct_answer: 'A',
    explanation: 'Given:\nIncome \\(=\\) Rs. \\(9{,}000\\); savings \\(=\\) Rs. \\(1{,}800\\)\nWorking:\n\\(\\dfrac{1{,}800}{9{,}000} \\times 100 = 20\\%\\)\nAsked:\nPercentage of savings \\(= 20\\%\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nவருமானம் \\(=\\) ரூ. \\(9{,}000\\); சேமிப்பு \\(=\\) ரூ. \\(1{,}800\\)\nசெயல்முறை:\n\\(\\dfrac{1{,}800}{9{,}000} \\times 100 = 20\\%\\)\nகேட்டது:\nசேமிப்பு சதவீதம் \\(= 20\\%\\)\nவிடை (A)' },
  { id: '496c95e8-9332-4987-86d3-6cc1930d7ebb',
    question_text: 'In 2015, the population of a town was 2,00,000. If it increased by 8% in the next year, find the population in 2016.',
    question_text_ta: '2015-இல், ஒரு நகரத்தின் மக்கள்தொகை 2,00,000. அடுத்த ஆண்டில் அது 8% அதிகரித்தால், 2016-இல் உள்ள மக்கள்தொகையைக் காண்க.',
    option_a: '2,16,000', option_b: '2,08,000', option_c: '1,84,000', option_d: '2,20,000', correct_answer: 'A',
    explanation: 'Given:\nPopulation in 2015 \\(= 2{,}00{,}000\\); increase \\(= 8\\%\\)\nWorking:\nPopulation in 2016 \\(= 2{,}00{,}000 \\times 1.08 = 2{,}16{,}000\\)\nAsked:\nPopulation in 2016 \\(= 2{,}16{,}000\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\n2015 மக்கள்தொகை \\(= 2{,}00{,}000\\); அதிகரிப்பு \\(= 8\\%\\)\nசெயல்முறை:\n2016 மக்கள்தொகை \\(= 2{,}00{,}000 \\times 1.08 = 2{,}16{,}000\\)\nகேட்டது:\n2016 மக்கள்தொகை \\(= 2{,}16{,}000\\)\nவிடை (A)' },
  { id: '525f6af1-f9ce-454e-9cf4-e12b4dabc5c6',
    question_text: 'In a class of 60 students, 27 were girls and the rest were boys. What is the percentage of boys?',
    question_text_ta: '60 மாணவர்கள் கொண்ட வகுப்பில், 27 பேர் பெண்கள், மீதமுள்ளோர் ஆண்கள். ஆண்களின் சதவீதம் என்ன?',
    option_a: '55%', option_b: '45%', option_c: '50%', option_d: '27%', correct_answer: 'A',
    explanation: 'Given:\nTotal students \\(= 60\\); girls \\(= 27\\)\nWorking:\nBoys \\(= 60 - 27 = 33\\)\nPercentage of boys \\(= \\dfrac{33}{60} \\times 100 = 55\\%\\)\nAsked:\nPercentage of boys \\(= 55\\%\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nமொத்த மாணவர்கள் \\(= 60\\); பெண்கள் \\(= 27\\)\nசெயல்முறை:\nஆண்கள் \\(= 60 - 27 = 33\\)\nஆண்களின் சதவீதம் \\(= \\dfrac{33}{60} \\times 100 = 55\\%\\)\nகேட்டது:\nஆண்களின் சதவீதம் \\(= 55\\%\\)\nவிடை (A)' },
  { id: '58649618-a651-4b48-a1d8-d4bf2b09799d',
    question_text: 'In a class of 80 students, 65% are boys. Find the number of boys.',
    question_text_ta: '80 மாணவர்கள் கொண்ட வகுப்பில், 65% ஆண்கள். ஆண்களின் எண்ணிக்கையைக் காண்க.',
    option_a: '52', option_b: '28', option_c: '48', option_d: '56', correct_answer: 'A',
    explanation: 'Given:\nTotal students \\(= 80\\); boys \\(= 65\\%\\)\nWorking:\n\\(65\\% \\times 80 = 52\\)\nAsked:\nNumber of boys \\(= 52\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nமொத்த மாணவர்கள் \\(= 80\\); ஆண்கள் \\(= 65\\%\\)\nசெயல்முறை:\n\\(65\\% \\times 80 = 52\\)\nகேட்டது:\nஆண்களின் எண்ணிக்கை \\(= 52\\)\nவிடை (A)' },
  { id: '7dcafa47-1f6f-4b4d-a8c5-9bc07825dcbe',
    question_text: '80% of 40 students passed in Science. How many students did NOT pass?',
    question_text_ta: '40 மாணவர்களில் 80% பேர் அறிவியலில் தேர்ச்சி பெற்றனர். எத்தனை மாணவர்கள் தேர்ச்சி பெறவில்லை?',
    option_a: '8', option_b: '32', option_c: '10', option_d: '12', correct_answer: 'A',
    explanation: 'Given:\nTotal students \\(= 40\\); passed \\(= 80\\%\\)\nWorking:\nPassed \\(= 80\\% \\times 40 = 32\\)\nNot passed \\(= 40 - 32 = 8\\)\nAsked:\nStudents who did not pass \\(= 8\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nமொத்த மாணவர்கள் \\(= 40\\); தேர்ச்சி பெற்றவர் \\(= 80\\%\\)\nசெயல்முறை:\nதேர்ச்சி பெற்றவர் \\(= 80\\% \\times 40 = 32\\)\nதேர்ச்சி பெறாதவர் \\(= 40 - 32 = 8\\)\nகேட்டது:\nதேர்ச்சி பெறாத மாணவர்கள் \\(= 8\\)\nவிடை (A)' },
  { id: 'c91b8a77-ffbe-4e5e-853d-5d87b60bed30',
    question_text: '65% of 60 workers in a factory are skilled. How many workers are NOT skilled?',
    question_text_ta: 'ஒரு தொழிற்சாலையில் 60 தொழிலாளர்களில் 65% பேர் திறமையானவர்கள். எத்தனை தொழிலாளர்கள் திறமையற்றவர்கள்?',
    option_a: '21', option_b: '39', option_c: '25', option_d: '15', correct_answer: 'A',
    explanation: 'Given:\nTotal workers \\(= 60\\); skilled \\(= 65\\%\\)\nWorking:\nSkilled \\(= 65\\% \\times 60 = 39\\)\nNot skilled \\(= 60 - 39 = 21\\)\nAsked:\nWorkers not skilled \\(= 21\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nமொத்த தொழிலாளர்கள் \\(= 60\\); திறமையானவர் \\(= 65\\%\\)\nசெயல்முறை:\nதிறமையானவர் \\(= 65\\% \\times 60 = 39\\)\nதிறமையற்றவர் \\(= 60 - 39 = 21\\)\nகேட்டது:\nதிறமையற்ற தொழிலாளர்கள் \\(= 21\\)\nவிடை (A)' },
  { id: 'c8737714-ad68-48aa-8b41-a3138448a128',
    question_text: 'The price of a refrigerator was Rs. 22,000 last year. It has increased by 15% this year. What is the increase in price?',
    question_text_ta: 'ஒரு குளிர்சாதனப் பெட்டியின் விலை கடந்த ஆண்டு ரூ. 22,000 ஆக இருந்தது. இந்த ஆண்டு அது 15% அதிகரித்துள்ளது. விலையில் ஏற்பட்ட அதிகரிப்பு எவ்வளவு?',
    option_a: 'Rs. 3,300', option_b: 'Rs. 25,300', option_c: 'Rs. 18,700', option_d: 'Rs. 3,850', correct_answer: 'A',
    explanation: "Given:\nLast year's price \\(=\\) Rs. \\(22{,}000\\); increase \\(= 15\\%\\)\nWorking:\nIncrease \\(= 15\\% \\times 22{,}000 = 3{,}300\\)\nAsked:\nIncrease in price \\(=\\) Rs. \\(3{,}300\\)\n→ Option (A)",
    explanation_ta: 'தரவுகள்:\nகடந்த ஆண்டு விலை \\(=\\) ரூ. \\(22{,}000\\); அதிகரிப்பு \\(= 15\\%\\)\nசெயல்முறை:\nஅதிகரிப்பு \\(= 15\\% \\times 22{,}000 = 3{,}300\\)\nகேட்டது:\nவிலை அதிகரிப்பு \\(=\\) ரூ. \\(3{,}300\\)\nவிடை (A)' },
  { id: 'bfc745e1-bab0-41fa-8ad8-8a4f8f766091',
    question_text: 'The population of a town is 45,000. 50% of them are men, 30% are women and the rest are children. Find the number of men and children.',
    question_text_ta: 'ஒரு நகரத்தின் மக்கள்தொகை 45,000. அதில் 50% ஆண்கள், 30% பெண்கள், மீதமுள்ளோர் குழந்தைகள். ஆண்கள் மற்றும் குழந்தைகளின் எண்ணிக்கையைக் காண்க.',
    option_a: 'Men 22,500, Children 9,000', option_b: 'Men 13,500, Children 22,500', option_c: 'Men 22,500, Children 13,500', option_d: 'Men 9,000, Children 22,500', correct_answer: 'A',
    explanation: 'Given:\nPopulation \\(= 45{,}000\\); men \\(= 50\\%\\), women \\(= 30\\%\\)\nWorking:\nMen \\(= 50\\% \\times 45{,}000 = 22{,}500\\)\nWomen \\(= 30\\% \\times 45{,}000 = 13{,}500\\)\nChildren \\(= 45{,}000 - 22{,}500 - 13{,}500 = 9{,}000\\)\nAsked:\nMen and children \\(= 22{,}500, 9{,}000\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nமக்கள்தொகை \\(= 45{,}000\\); ஆண்கள் \\(= 50\\%\\), பெண்கள் \\(= 30\\%\\)\nசெயல்முறை:\nஆண்கள் \\(= 50\\% \\times 45{,}000 = 22{,}500\\)\nபெண்கள் \\(= 30\\% \\times 45{,}000 = 13{,}500\\)\nகுழந்தைகள் \\(= 45{,}000 - 22{,}500 - 13{,}500 = 9{,}000\\)\nகேட்டது:\nஆண்கள் மற்றும் குழந்தைகள் \\(= 22{,}500, 9{,}000\\)\nவிடை (A)' },
  { id: 'd3b6c5bb-c246-4c08-8d78-41dad7282898',
    question_text: 'A woman spends 35% of her income on food, 20% on rent and 10% on transport, and saves the rest. If her income is Rs. 28,000, find the amount of her savings.',
    question_text_ta: 'ஒரு பெண் தனது வருமானத்தில் 35% உணவுக்கும், 20% வாடகைக்கும், 10% போக்குவரத்துக்கும் செலவிட்டு, மீதியை சேமிக்கிறார். அவரது வருமானம் ரூ. 28,000 எனில், அவரது சேமிப்பின் அளவைக் காண்க.',
    option_a: 'Rs. 9,800', option_b: 'Rs. 8,400', option_c: 'Rs. 9,100', option_d: 'Rs. 10,500', correct_answer: 'A',
    explanation: 'Given:\nIncome \\(=\\) Rs. \\(28{,}000\\); food \\(= 35\\%\\), rent \\(= 20\\%\\), transport \\(= 10\\%\\)\nWorking:\nSavings \\(\\% = 100 - 35 - 20 - 10 = 35\\%\\)\nSavings \\(= 35\\% \\times 28{,}000 = 9{,}800\\)\nAsked:\nAmount of savings \\(=\\) Rs. \\(9{,}800\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nவருமானம் \\(=\\) ரூ. \\(28{,}000\\); உணவு \\(= 35\\%\\), வாடகை \\(= 20\\%\\), போக்குவரத்து \\(= 10\\%\\)\nசெயல்முறை:\nசேமிப்பு \\(\\% = 100 - 35 - 20 - 10 = 35\\%\\)\nசேமிப்பு \\(= 35\\% \\times 28{,}000 = 9{,}800\\)\nகேட்டது:\nசேமிப்பின் அளவு \\(=\\) ரூ. \\(9{,}800\\)\nவிடை (A)' },
  { id: 'cd048abd-6b69-48a0-990d-d3878f94d00e',
    question_text: '20% of the total number of eggs in a tray, which are broken, is 18. Find the total number of eggs and the number of good eggs.',
    question_text_ta: 'ஒரு தட்டில் உள்ள மொத்த முட்டைகளில் உடைந்தவை 20%, அது 18. மொத்த முட்டைகளின் எண்ணிக்கை மற்றும் நல்ல முட்டைகளின் எண்ணிக்கையைக் காண்க.',
    option_a: 'Total 90, Good 72', option_b: 'Total 90, Good 18', option_c: 'Total 72, Good 90', option_d: 'Total 108, Good 90', correct_answer: 'A',
    explanation: 'Given:\n20% of total eggs (broken) \\(= 18\\)\nWorking:\nTotal \\(= 18 \\times \\dfrac{100}{20} = 90\\)\nGood eggs \\(= 90 - 18 = 72\\)\nAsked:\nTotal and good eggs \\(= 90, 72\\)\n→ Option (A)',
    explanation_ta: 'தரவுகள்:\nமொத்த முட்டைகளின் 20% (உடைந்தவை) \\(= 18\\)\nசெயல்முறை:\nமொத்தம் \\(= 18 \\times \\dfrac{100}{20} = 90\\)\nநல்ல முட்டைகள் \\(= 90 - 18 = 72\\)\nகேட்டது:\nமொத்தம் மற்றும் நல்ல முட்டைகள் \\(= 90, 72\\)\nவிடை (A)' },
]

console.log(`=== MATH DEDUP APPLY ${WRITE ? '(WRITE)' : '(DRY RUN)'} ===`)
console.log(`rewrites planned: ${REWRITES.length}`)

const ids = REWRITES.map((r) => r.id)
const { rows: backupRows } = await c.query('select * from questions where id = any($1::uuid[])', [ids])
if (backupRows.length !== ids.length) {
  console.error(`WARNING: expected ${ids.length} rows, found ${backupRows.length}. Aborting.`)
  await c.end()
  process.exit(1)
}
writeFileSync('_dedup_math_apply_backup.json', JSON.stringify(backupRows, null, 1))
console.log(`backed up ${backupRows.length} original rows to server/_dedup_math_apply_backup.json`)

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
       correct_answer=$7, explanation=$8, explanation_ta=$9
     where id=$10`,
    [r.question_text, r.question_text_ta, r.option_a, r.option_b, r.option_c, r.option_d,
      r.correct_answer, r.explanation, r.explanation_ta, r.id]
  )
  updated += res.rowCount
}
console.log(`rewritten rows: ${updated}`)
await c.end()
