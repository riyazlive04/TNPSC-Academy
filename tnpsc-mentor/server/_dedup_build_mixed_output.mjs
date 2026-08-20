import { writeFileSync } from 'node:fs'

const OUT = []

// ===================== 3D - Volume & Surface Area =====================

OUT.push({
  topic: '3D - Volume & Surface Area',
  group_nums: '12,16,18',
  classification: 'true_duplicate',
  notes: 'Same problem: metallic cube side 12cm melted & recast into cuboid l=18,b=16, find h. Verified: Volume conserved, 18*16*h=12^3=1728 -> h=1728/288=6 cm. Row1 (32234a4c) option B=6cm matches; Row2 (c6705eb3) option A=6cm matches. No conflict — both keys point to the correct value 6cm, just different option-letter positions (classic reordered-options duplicate). Row1 has more/equal history and already carries full EN+TA explanation content in the DB; kept as-is. Row2 rewritten to a different cube->cuboid melt problem (side 10, l=25,b=8 -> h=5, verified 10^3=1000, 25*8=200, 1000/200=5).',
  keep_id: '32234a4c-bc94-4f41-97d0-435b8563917c',
  rewrites: [
    {
      id: 'c6705eb3-2c75-402e-ae9d-0e1f0474c4db',
      question_text: 'A metallic cube of side 10 cm is melted and recast into a cuboid of length 25 cm and breadth 8 cm. Find the height of the cuboid.',
      question_text_ta: 'பக்க அளவு 10 cm உள்ள ஒரு உலோகக் கனசதுரம் உருக்கப்பட்டு, நீளம் 25 cm மற்றும் அகலம் 8 cm உள்ள ஒரு கனசெவ்வகமாக மாற்றப்படுகிறது. கனசெவ்வகத்தின் உயரத்தைக் காண்க.',
      option_a: '5 cm', option_b: '4 cm', option_c: '8 cm', option_d: '10 cm', correct_answer: 'A',
      explanation: 'Given:\nCube side \\( a = 10 \\) cm; cuboid \\( l = 25 \\) cm, \\( b = 8 \\) cm\nMelting conserves volume, so volume of cuboid = volume of cube.\nFormula: \\( l \\times b \\times h = a^{3} \\)\nWorking:\n\\( 25 \\times 8 \\times h = 10 \\times 10 \\times 10 \\)\n\\( h = \\dfrac{10 \\times 10 \\times 10}{25 \\times 8} = \\dfrac{1000}{200} = 5 \\) cm\nAsked:\nHeight of the cuboid \\( = 5 \\) cm\n→ Option (A)',
      explanation_ta: 'தரவுகள்:\nகனசதுரப் பக்கம் \\( a = 10 \\) cm; கனசெவ்வகம் \\( l = 25 \\) cm, \\( b = 8 \\) cm\nஉருக்குதலில் கனஅளவு மாறாது, எனவே கனசெவ்வகத்தின் கனஅளவு = கனசதுரத்தின் கனஅளவு.\nசூத்திரம்: \\( l \\times b \\times h = a^{3} \\)\nசெயல்முறை:\n\\( 25 \\times 8 \\times h = 10 \\times 10 \\times 10 \\)\n\\( h = \\dfrac{10 \\times 10 \\times 10}{25 \\times 8} = \\dfrac{1000}{200} = 5 \\) cm\nகேட்டது:\nகனசெவ்வகத்தின் உயரம் \\( = 5 \\) cm\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

OUT.push({
  topic: '3D - Volume & Surface Area',
  group_nums: '3,5',
  classification: 'false_positive',
  notes: 'Row1 (6f4c57f6) asks for the RATIO of curved surface area of two separate solid hemispheres whose radii are in ratio 3:5 (pure ratio question, CSA ratio = r1²:r2² = 9:25, matches option C — verified correct). Row2 (a29492d6) is a completely different problem: ONE hollow hemispherical shell with internal radius 3m and external radius 5m, asking for its actual CSA and TSA values. Verified independently: CSA = 2π(R²+r²) = 2π(25+9) = 68π ≈ 213.71 m²; TSA = π(3R²+r²) = π(75+9) = 84π = 264 m² (using π=22/7) — matches option C exactly, and is itself internally correct. These are unrelated problem types (abstract ratio vs. concrete hollow-shell surface area) that only coincidentally both use the numbers 3 and 5 as hemisphere radii. No change needed to either row.',
  keep_id: null,
  rewrites: [],
  conflict_details: null,
})

OUT.push({
  topic: '3D - Volume & Surface Area',
  group_nums: '7',
  classification: 'true_duplicate',
  notes: 'Two identical cubes of side 7cm joined end to end -> cuboid l=14,b=7,h=7. Verified: TSA=2(lb+bh+hl)=2(98+49+98)=490 cm²; LSA=2h(l+b)=2*7*21=294 cm². Row1 (7132c9c8) asks for both LSA & TSA, correct option C = "LSA=294;TSA=490" matches. Row2 (e05d7cce) asks TSA only, correct option D=490 matches. Same scenario/data, Row2 is a subset question of Row1 — true duplicate, no conflict. Row2 has substantially more student history (n_seen=1,n_ans=3 vs n_seen=1,n_ans=1) so it is kept; Row1 rewritten to a different two-cubes-joined problem with side 6cm (l=12,b=6,h=6 -> LSA=216, TSA=360, verified).',
  keep_id: 'e05d7cce-f8b4-42bb-a9aa-c6d0bd4736ad',
  rewrites: [
    {
      id: '7132c9c8-763c-42e2-bbbc-d3f5f2e9b8f3',
      question_text: 'Two identical cubes of side 6 cm are joined end to end. Find the total surface area (TSA) and lateral surface area (LSA) of the resulting cuboid.',
      question_text_ta: 'பக்கம் 6 cm உள்ள இரு ஒரே மாதிரியான கனசதுரங்கள் முனைக்கு முனை இணைக்கப்படுகின்றன. உருவாகும் கனசெவ்வகத்தின் மொத்த பரப்பளவு (TSA) மற்றும் பக்கப் பரப்பளவை (LSA) காண்க.',
      option_a: 'LSA = 216 cm²; TSA = 360 cm²', option_b: 'LSA = 360 cm²; TSA = 216 cm²', option_c: 'LSA = 288 cm²; TSA = 432 cm²', option_d: 'LSA = 144 cm²; TSA = 216 cm²', correct_answer: 'A',
      explanation: 'Given:\nCube side \\( a = 6 \\) cm; two cubes joined end to end\nWorking:\nFormula: resulting cuboid \\( l = 2a = 12 \\) cm, \\( b = a = 6 \\) cm, \\( h = a = 6 \\) cm\n\\( \\text{LSA} = 2(l+b)h = 2(12+6) \\times 6 = 2 \\times 18 \\times 6 = 216 \\) cm²\n\\( \\text{TSA} = 2(lb+bh+hl) = 2(12\\times6 + 6\\times6 + 6\\times12) = 2(72+36+72) = 2 \\times 180 = 360 \\) cm²\nAsked:\nLSA and TSA of the resulting cuboid\n\\( = 216 \\) cm², \\( 360 \\) cm²\n→ Option (A)',
      explanation_ta: 'தரவுகள்:\nகனசதுரப் பக்கம் \\( a = 6 \\) cm; இரு கனசதுரங்கள் முனைக்கு முனை இணைக்கப்படுகின்றன\nசெயல்முறை:\nசூத்திரம்: உருவாகும் கனசெவ்வகம் \\( l = 2a = 12 \\) cm, \\( b = a = 6 \\) cm, \\( h = a = 6 \\) cm\n\\( \\text{LSA} = 2(l+b)h = 2(12+6) \\times 6 = 2 \\times 18 \\times 6 = 216 \\) cm²\n\\( \\text{TSA} = 2(lb+bh+hl) = 2(12\\times6 + 6\\times6 + 6\\times12) = 2(72+36+72) = 2 \\times 180 = 360 \\) cm²\nகேட்டது:\nஉருவாகும் கனசெவ்வகத்தின் LSA மற்றும் TSA\n\\( = 216 \\) cm², \\( 360 \\) cm²\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

// ===================== 2D - Area =====================

OUT.push({
  topic: '2D - Area',
  group_nums: '120,14,35',
  classification: 'true_duplicate',
  notes: 'Same athletic track: two straight sections 120m long, semicircular ends inner radius 35m, track width 14m -> outer radius 49m. Verified independently: rectangular strips = 2*(120*14) = 3360 m²; ring area (two semicircular ends = one full annulus) = π(49²-35²) = (22/7)*(2401-1225) = (22/7)*1176 = 3696 m²; total = 3360+3696 = 7056 m². Row1 (16b08308) option B=7056 matches; Row2 (e58b22bc) option C=7056 matches. No conflict — same value under different option letters. Row1 has far more history (n_seen=5,n_ans=2) and is kept; Row2 rewritten to a track with straight=100m, inner radius=28m, width=7m (outer radius=35m) -> area=2786 m² (verified).',
  keep_id: '16b08308-a027-4bd7-ae73-21ab0ee11b1f',
  rewrites: [
    {
      id: 'e58b22bc-66c7-4fa9-98c9-d4282bee9eb2',
      question_text: 'An athletic track consists of two straight sections each 100 m long joined by semicircular ends with inner radius 28 m. The track is 7 m wide. Calculate the area of the track.',
      question_text_ta: 'ஒரு விளையாட்டுத் தடம் தலா 100 m நீள இரு நேர் பகுதிகளைக் கொண்டது; அவை உள் ஆரம் 28 m உள்ள அரைவட்ட முனைகளால் இணைக்கப்பட்டுள்ளன. தடத்தின் அகலம் 7 m. தடத்தின் பரப்பளவைக் கணக்கிடுக.',
      option_a: '2786 m²', option_b: '1400 m²', option_c: '1386 m²', option_d: '4172 m²', correct_answer: 'A',
      explanation: 'Given:\nStraight sections: \\(2 \\times 100\\) m long; inner radius \\(r = 28\\) m; width \\(= 7\\) m, so outer radius \\(R = 28+7=35\\) m; \\(\\pi = \\dfrac{22}{7}\\)\nWorking:\nFormula: Area of track \\(=\\) area of the two rectangular strips \\(+\\) area of the circular ring (two semicircular ends \\(=\\) one full ring)\nRectangular strips \\(= 2 \\times (100 \\times 7) = 1400\\) m²\nRing area \\(= \\pi(R^{2}-r^{2}) = \\dfrac{22}{7}(35^{2}-28^{2}) = \\dfrac{22}{7}(1225-784) = \\dfrac{22}{7} \\times 441 = 1386\\) m²\nTotal area \\(= 1400 + 1386 = 2786\\) m²\nAsked:\nArea of the track \\(= 2786\\) m²\n→ Option (A)',
      explanation_ta: 'தரவுகள்:\nநேர் பகுதிகள்: தலா \\(100\\) m நீளம்; உள் ஆரம் \\(r = 28\\) m; அகலம் \\(= 7\\) m, எனவே வெளி ஆரம் \\(R = 28+7=35\\) m; \\(\\pi = \\dfrac{22}{7}\\)\nசெயல்முறை:\nசூத்திரம்: தடத்தின் பரப்பளவு \\(=\\) இரு செவ்வக பகுதிகளின் பரப்பு \\(+\\) வளையப் பகுதியின் பரப்பு (இரு அரைவட்ட முனைகள் \\(=\\) ஒரு முழு வளையம்)\nசெவ்வக பகுதிகள் \\(= 2 \\times (100 \\times 7) = 1400\\) m²\nவளையப் பரப்பு \\(= \\pi(R^{2}-r^{2}) = \\dfrac{22}{7}(35^{2}-28^{2}) = \\dfrac{22}{7}(1225-784) = \\dfrac{22}{7} \\times 441 = 1386\\) m²\nமொத்தப் பரப்பளவு \\(= 1400 + 1386 = 2786\\) m²\nகேட்டது:\nதடத்தின் பரப்பளவு \\(= 2786\\) m²\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

OUT.push({
  topic: '2D - Area',
  group_nums: '5,50,80',
  classification: 'true_duplicate',
  notes: 'Same right-triangular ground problem: legs 50m & 80m, rate Rs.5/m². Verified: Area = 1/2*50*80 = 2000 m²; Cost = 2000*5 = 10000. Row1 (3f56c534) option B=10000 matches; Row2 (5421ad91) option A=10000 matches. No conflict. Row2 has more history (n_seen=1,n_ans=1 vs 0,0) and is kept; Row1 rewritten with legs 60m & 90m, rate Rs.8/m² -> Area=2700, Cost=21,600 (verified).',
  keep_id: '5421ad91-2ee1-4a4c-978f-b9531af10d48',
  rewrites: [
    {
      id: '3f56c534-675c-4a14-a101-ffeb3d1cbf43',
      question_text: 'In a right triangular ground, the sides adjacent to the right angle are 60 m and 90 m. Find the cost of cementing the ground at ₹ 8 per m².',
      question_text_ta: 'ஒரு செங்கோண முக்கோண நிலத்தில், செங்கோணத்தை அடுத்துள்ள பக்கங்கள் 60 m மற்றும் 90 m ஆகும். m²க்கு ₹ 8 வீதம் நிலத்தை சிமெண்ட் இடுவதற்கான செலவைக் காண்க.',
      option_a: '₹ 21,600', option_b: '₹ 43,200', option_c: '₹ 13,500', option_d: '₹ 10,800', correct_answer: 'A',
      explanation: 'Given:\nSides adjacent to right angle \\(= 60\\) m, \\(90\\) m; rate \\(=\\) ₹\\(8\\) per m²\nWorking:\nFormula: Area of right triangle \\(= \\dfrac{1}{2} \\times \\text{base} \\times \\text{height}\\)\n\\(\\text{Area} = \\dfrac{1}{2} \\times 60 \\times 90 = 2700\\) m²\nCost \\(= 2700 \\times 8 = 21{,}600\\)\nAsked:\nCost of cementing the ground \\(=\\) ₹\\(21{,}600\\)\n→ Option (A)',
      explanation_ta: 'தரவுகள்:\nசெங்கோணத்தை அடுத்துள்ள பக்கங்கள் \\(= 60\\) m, \\(90\\) m; விகிதம் \\(=\\) ₹\\(8\\) ஒரு m²க்கு\nசெயல்முறை:\nசூத்திரம்: செங்கோண முக்கோணத்தின் பரப்பளவு \\(= \\dfrac{1}{2} \\times \\text{அடிப்பக்கம்} \\times \\text{உயரம்}\\)\n\\(\\text{பரப்பளவு} = \\dfrac{1}{2} \\times 60 \\times 90 = 2700\\) m²\nசெலவு \\(= 2700 \\times 8 = 21{,}600\\)\nகேட்டது:\nநிலத்தை சிமெண்ட் இடுவதற்கான செலவு \\(=\\) ₹\\(21{,}600\\)\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

// ===================== Perimeter, Circumference & Diameter =====================

OUT.push({
  topic: 'Perimeter, Circumference & Diameter',
  group_nums: '10,15',
  classification: 'true_duplicate',
  notes: 'This group has 3 rows but is a MIXED case. Row1 (2f2dc317, "radius and length of arc of a sector are 10cm and 15cm... find perimeter") is a genuinely DIFFERENT problem — a circular sector perimeter (P = l+2r = 15+2*10 = 35, verified, matches its option D) — it only coincidentally shares the numbers 10 and 15 with the other two rows; it is NOT part of the duplicate and is left completely untouched (false-positive-within-group). Row2 (d77d5c48, "perimeter of rectangular field, length 15m, breadth 10m") and Row3 (eca85989, "area AND perimeter of rectangular field, length 15m, breadth 10m") are the true duplicate pair: identical rectangle, Row3 is a superset question (also asks area). Verified: Perimeter=2(15+10)=50m; Area=15*10=150 m². Row2 option D=50m matches; Row3 option B="Area=150 m²; Perimeter=50 m" matches. No conflict. Row3 has more history (n_seen=2) and is kept; Row2 rewritten to a different rectangular field (length 24m, breadth 18m -> perimeter 84m, verified).',
  keep_id: 'eca85989-09cd-4370-9bff-b4043ee7d507',
  rewrites: [
    {
      id: 'd77d5c48-4ef9-45d3-a22f-dd0bfef9fcca',
      question_text: 'Find the perimeter of a rectangular field of length 24 m and breadth 18 m.',
      question_text_ta: 'நீளம் 24 m மற்றும் அகலம் 18 m உள்ள ஒரு செவ்வக நிலத்தின் சுற்றளவைக் காண்க.',
      option_a: '84 m', option_b: '42 m', option_c: '96 m', option_d: '108 m', correct_answer: 'A',
      explanation: 'Given:\nLength \\(l = 24\\) m, breadth \\(b = 18\\) m\nWorking:\nFormula: \\(P = 2(l+b)\\)\n\\(P = 2(24+18) = 2 \\times 42 = 84\\) m\nAsked:\nPerimeter of the rectangular field \\(= 84\\) m\n→ Option (A)',
      explanation_ta: 'தரவுகள்:\nநீளம் \\(l = 24\\) m, அகலம் \\(b = 18\\) m\nசெயல்முறை:\nசூத்திரம்: \\(P = 2(l+b)\\)\n\\(P = 2(24+18) = 2 \\times 42 = 84\\) m\nகேட்டது:\nசெவ்வக நிலத்தின் சுற்றளவு \\(= 84\\) m\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

OUT.push({
  topic: 'Perimeter, Circumference & Diameter',
  group_nums: '1,6',
  classification: 'true_duplicate',
  notes: 'Same problem: rectangular blackboard, perimeter=6m, breadth=1m, find length. Verified: 2(l+1)=6 -> l=2m. Row1 (4b183f70) option A=2m matches; Row2 (d47894c5) option C=2m matches. No conflict. Row1 has more history (n_ans=1 vs n_ans=0) and is kept; Row2 rewritten to a rectangular garden, perimeter=20m, breadth=3m -> length=7m (verified).',
  keep_id: '4b183f70-aac5-43cc-aebf-f98307fb2bb6',
  rewrites: [
    {
      id: 'd47894c5-7782-4fda-bd3f-496a2789a0c4',
      question_text: 'Find the length of a rectangular garden whose perimeter is 20 m and breadth is 3 m.',
      question_text_ta: 'சுற்றளவு 20 m மற்றும் அகலம் 3 m உள்ள ஒரு செவ்வகத் தோட்டத்தின் நீளத்தைக் காண்க.',
      option_a: '7 m', option_b: '10 m', option_c: '14 m', option_d: '4 m', correct_answer: 'A',
      explanation: 'Given:\nPerimeter \\(P = 20\\) m; breadth \\(b = 3\\) m\nWorking:\nFormula: \\(P = 2(l+b)\\)\n\\(2(l+3) = 20\\)\n\\(l+3 = 10\\)\n\\(l = 7\\) m\nAsked:\nLength of the garden \\(= 7\\) m\n→ Option (A)',
      explanation_ta: 'தரவுகள்:\nசுற்றளவு \\(P = 20\\) m; அகலம் \\(b = 3\\) m\nசெயல்முறை:\nசூத்திரம்: \\(P = 2(l+b)\\)\n\\(2(l+3) = 20\\)\n\\(l+3 = 10\\)\n\\(l = 7\\) m\nகேட்டது:\nதோட்டத்தின் நீளம் \\(= 7\\) m\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

OUT.push({
  topic: 'Perimeter, Circumference & Diameter',
  group_nums: '12,15',
  classification: 'true_duplicate',
  notes: 'Same problem: square plot side 12m, fencing rate Rs./₹15 per metre. Verified: Perimeter=4*12=48m, Cost=48*15=720. Row1 (4eb7a25d) option A=720 matches; Row2 (e06f2e67) option A=720 matches. No conflict (differ only by Rs. vs ₹ symbol). Row2 has more history (n_seen=2,n_ans=2) and is kept; Row1 rewritten to square plot side 20m, rate Rs.25/m -> Perimeter=80, Cost=2000 (verified).',
  keep_id: 'e06f2e67-6f70-42ec-a4e4-2fe6861d87b7',
  rewrites: [
    {
      id: '4eb7a25d-c06e-4777-ab1b-9fe34ec21de6',
      question_text: 'Find the cost of fencing a square plot of side 20 m at the rate of Rs. 25 per metre.',
      question_text_ta: 'பக்க அளவு 20 m உள்ள ஒரு சதுர நிலத்தை ஒரு மீட்டருக்கு Rs. 25 வீதம் வேலியடைக்கும் செலவைக் காண்க.',
      option_a: 'Rs. 2,000', option_b: 'Rs. 500', option_c: 'Rs. 1,000', option_d: 'Rs. 4,000', correct_answer: 'A',
      explanation: 'Given:\nSide of square \\(a = 20\\) m; rate \\(=\\) Rs. \\(25\\) per metre\nWorking:\nFormula: Perimeter of square \\(= 4a\\)\n\\(P = 4 \\times 20 = 80\\) m\nCost \\(= 80 \\times 25 = 2{,}000\\)\nAsked:\nCost of fencing \\(=\\) Rs. \\(2{,}000\\)\n→ Option (A)',
      explanation_ta: 'தரவுகள்:\nசதுரத்தின் பக்கம் \\(a = 20\\) m; விகிதம் \\(=\\) ஒரு மீட்டருக்கு Rs. \\(25\\)\nசெயல்முறை:\nசூத்திரம்: சதுரத்தின் சுற்றளவு \\(= 4a\\)\n\\(P = 4 \\times 20 = 80\\) m\nசெலவு \\(= 80 \\times 25 = 2{,}000\\)\nகேட்டது:\nவேலியடைக்கும் செலவு \\(=\\) Rs. \\(2{,}000\\)\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

OUT.push({
  topic: 'Perimeter, Circumference & Diameter',
  group_nums: '21',
  classification: 'true_duplicate',
  notes: 'Same problem: quadrant of a circle of radius 21cm, find area & perimeter. Verified independently: Area of quadrant = (1/4)πr² = (1/4)*(22/7)*441 = 346.5 cm²; Perimeter of quadrant = 2r + (1/4)*2πr = 42 + 33 = 75 cm. Row1 (68353527) question wording says "area and perimeter" but its correct option C gives "75 & 346.5" — this is actually (perimeter, area) order, inconsistent with the stated wording order (a pre-existing bank quirk, not something new). Row2 (e6b87a9f) explicitly asks "perimeter and area" and its option A = "75 & 346" (346 rounded from 346.5) is in the correct order and value. No numeric conflict — both rows agree the two values are {75, 346.5}; only Row1\'s label order was already inconsistent with its own question phrasing pre-existing this dedup pass. Row2 has more history (n_ans=2 vs 1) and is kept; Row1 rewritten (with corrected "perimeter and area" ordering matching the numeric option order) to radius=14cm -> perimeter=50cm, area=154 cm² (verified).',
  keep_id: 'e6b87a9f-81e5-4443-8088-fa0eea971111',
  rewrites: [
    {
      id: '68353527-0646-4bfa-a8b6-c548c74dee87',
      question_text: 'The radius of a circle is 14 cm. Find the perimeter and area of a quadrant of the circle.',
      question_text_ta: 'ஒரு வட்டத்தின் ஆரம் 14 செ.மீ. அந்த வட்டத்தின் கால்வட்டத்தின் சுற்றளவு மற்றும் பரப்பளவைக் காண்க.',
      option_a: '50 & 154', option_b: '22 & 154', option_c: '50 & 616', option_d: '56 & 77', correct_answer: 'A',
      explanation: 'Given:\nRadius \\(r = 14\\) cm; \\(\\pi = \\dfrac{22}{7}\\)\nWorking:\nFormula: Perimeter of quadrant \\(= 2r + \\dfrac{2\\pi r}{4}\\); Area of quadrant \\(= \\dfrac{\\pi r^{2}}{4}\\)\nArc length \\(= \\dfrac{2\\pi r}{4} = \\dfrac{2 \\times \\frac{22}{7} \\times 14}{4} = \\dfrac{88}{4} = 22\\) cm\nPerimeter \\(= 2 \\times 14 + 22 = 28 + 22 = 50\\) cm\nArea \\(= \\dfrac{22}{7} \\times \\dfrac{14 \\times 14}{4} = \\dfrac{22}{7} \\times 49 = 154\\) cm²\nAsked:\nPerimeter and area of the quadrant\n\\(= 50\\) cm, \\(154\\) cm²\n→ Option (A)',
      explanation_ta: 'தரவுகள்:\nஆரம் \\(r = 14\\) செ.மீ; \\(\\pi = \\dfrac{22}{7}\\)\nசெயல்முறை:\nசூத்திரம்: கால்வட்டத்தின் சுற்றளவு \\(= 2r + \\dfrac{2\\pi r}{4}\\); கால்வட்டத்தின் பரப்பளவு \\(= \\dfrac{\\pi r^{2}}{4}\\)\nவில் நீளம் \\(= \\dfrac{2\\pi r}{4} = \\dfrac{2 \\times \\frac{22}{7} \\times 14}{4} = \\dfrac{88}{4} = 22\\) செ.மீ\nசுற்றளவு \\(= 2 \\times 14 + 22 = 28 + 22 = 50\\) செ.மீ\nபரப்பளவு \\(= \\dfrac{22}{7} \\times \\dfrac{14 \\times 14}{4} = \\dfrac{22}{7} \\times 49 = 154\\) செ.மீ²\nகேட்டது:\nகால்வட்டத்தின் சுற்றளவு மற்றும் பரப்பளவு\n\\(= 50\\) செ.மீ, \\(154\\) செ.மீ²\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

// ===================== Conversion of Information to Data =====================

OUT.push({
  topic: 'Conversion of Information to Data',
  group_nums: '11,111,120,121,130,131,140,141,15,150,151,160,161,170,3,4,50,8,9',
  classification: 'true_duplicate',
  notes: 'Same dataset: heights of 50 students, histogram classes 111-120=4,121-130=11,131-140=15,141-150=9,151-160=8,161-170=3. Verified max frequency=15 at class 131-140. Row1 (096d282c) option B="131-140 cm" matches; Row2 (94eeff89) option B="130.5-140.5 cm (15 students)" matches (continuous-boundary convention, same modal class). No conflict. Row2 has much more history (n_seen=2,n_ans=2) and is kept; Row1 rewritten to a different histogram dataset — marks of 60 students across 6 classes (verified sum=60, max freq=18 at 41-50).',
  keep_id: '94eeff89-e23f-4cc2-be49-e1a0f4209958',
  rewrites: [
    {
      id: '096d282c-a9b2-4e10-bc38-b39f4932db22',
      question_text: 'A histogram shows the marks of 60 students in a test: 21–30 = 5, 31–40 = 12, 41–50 = 18, 51–60 = 14, 61–70 = 7, 71–80 = 4. In which mark range do the maximum number of students fall?',
      question_text_ta: 'ஒரு செவ்வகப் படம் ஒரு தேர்வில் 60 மாணவர்களின் மதிப்பெண்களைக் காட்டுகிறது: 21–30 = 5, 31–40 = 12, 41–50 = 18, 51–60 = 14, 61–70 = 7, 71–80 = 4. எந்த மதிப்பெண் வரம்பில் அதிகபட்ச மாணவர்கள் உள்ளனர்?',
      option_a: '41–50 marks', option_b: '31–40 marks', option_c: '51–60 marks', option_d: '21–30 marks', correct_answer: 'A',
      explanation: 'Given:\nFrequencies: 21–30 \\(=5\\), 31–40 \\(=12\\), 41–50 \\(=18\\), 51–60 \\(=14\\), 61–70 \\(=7\\), 71–80 \\(=4\\)\nWorking:\nThe range with the maximum number of students is the one with the highest frequency.\n\\(\\max(5,12,18,14,7,4) = 18\\)\nClass corresponding to \\(18 = \\) 41–50\nAsked:\nMark range with the maximum number of students\n\\(=\\) 41–50 marks\n→ Option (A)',
      explanation_ta: 'தரவுகள்:\nஅலைவெண்கள்: 21–30 \\(=5\\), 31–40 \\(=12\\), 41–50 \\(=18\\), 51–60 \\(=14\\), 61–70 \\(=7\\), 71–80 \\(=4\\)\nசெயல்முறை:\nஅதிகபட்ச மாணவர்கள் உள்ள வரம்பு என்பது அதிக அலைவெண் கொண்ட வகுப்பு.\n\\(\\max(5,12,18,14,7,4) = 18\\)\n\\(18\\)-க்கு உரிய வகுப்பு \\(=\\) 41–50\nகேட்டது:\nஅதிகபட்ச மாணவர்கள் உள்ள மதிப்பெண் வரம்பு\n\\(=\\) 41–50 மதிப்பெண்கள்\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

OUT.push({
  topic: 'Conversion of Information to Data',
  group_nums: '25,30,30,35,40,40,45,50,80,90',
  classification: 'true_duplicate',
  notes: 'Same dataset (identical numbers): expenditure of two schools — Construction 80/90, Computers 35/50, Lab 30/25, Watering 45/40, Library 40/30. Verified: Construction: School II (90) > School I (80) by 10; Watering: School I (45) > School II (40). Row1 (0e67c8a0) option A = "(a) School II (90>80); (b) School I (45>40)" matches both facts. Row2 (e4cb0ccb) asks only the Construction sub-question with margin; option C = "School II, by 10 lakhs" matches (90-80=10). No conflict — same source table, Row1 is a superset (asks 2 sub-questions vs Row2\'s 1). Row2 has more history and is kept; Row1 rewritten to a different two-company expenditure table (Marketing 60/75, R&D 40/55, Salaries 100/90, Utilities 20/25, Misc 30/15 — verified Company Y > Company X on Marketing by 15, Company X > Company Y on Salaries by 10).',
  keep_id: 'e4cb0ccb-3c3c-4495-85c7-1ae82bb40418',
  rewrites: [
    {
      id: '0e67c8a0-6948-4fac-86be-01b6363cc5eb',
      question_text: 'The expenditure (in lakhs) of two companies on various heads is: Marketing = Company X 60, Company Y 75; R&D = 40, 55; Salaries = 100, 90; Utilities = 20, 25; Miscellaneous = 30, 15. Which company spent more on (a) Marketing and (b) Salaries?',
      question_text_ta: 'இரு நிறுவனங்களின் பல்வேறு தலைப்புகளில் செலவு (லட்சத்தில்): Marketing = நிறுவனம் X 60, நிறுவனம் Y 75; R&D = 40, 55; Salaries = 100, 90; Utilities = 20, 25; Miscellaneous = 30, 15. (a) Marketing மற்றும் (b) Salaries ஆகியவற்றுக்கு எந்த நிறுவனம் அதிகம் செலவழித்தது?',
      option_a: '(a) Company Y (75 > 60); (b) Company X (100 > 90)', option_b: '(a) Company X (60); (b) Company Y (90)', option_c: '(a) Company X (75 > 60); (b) Company X (100 > 90)', option_d: '(a) Company Y (75 > 60); (b) Company Y (100 > 90)', correct_answer: 'A',
      explanation: 'Given:\nMarketing: Company X \\(=60\\), Company Y \\(=75\\)\nSalaries: Company X \\(=100\\), Company Y \\(=90\\)\nWorking:\n(a) Marketing: \\(75 > 60\\), so Company Y spent more.\n(b) Salaries: \\(100 > 90\\), so Company X spent more.\nAsked:\nWhich company spent more on (a) Marketing and (b) Salaries?\n\\(=\\) (a) Company Y (75 > 60); (b) Company X (100 > 90)\n→ Option (A)',
      explanation_ta: 'தரவுகள்:\nMarketing: நிறுவனம் X \\(=60\\), நிறுவனம் Y \\(=75\\)\nSalaries: நிறுவனம் X \\(=100\\), நிறுவனம் Y \\(=90\\)\nசெயல்முறை:\n(a) Marketing: \\(75 > 60\\), எனவே நிறுவனம் Y அதிகம் செலவழித்தது.\n(b) Salaries: \\(100 > 90\\), எனவே நிறுவனம் X அதிகம் செலவழித்தது.\nகேட்டது:\n(a) Marketing மற்றும் (b) Salaries ஆகியவற்றுக்கு எந்த நிறுவனம் அதிகம் செலவழித்தது?\n\\(=\\) (a) நிறுவனம் Y (75 > 60); (b) நிறுவனம் X (100 > 90)\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

OUT.push({
  topic: 'Conversion of Information to Data',
  group_nums: '15,16,18,2,2,20,24,25,25,27,3,3,4,5,6',
  classification: 'true_duplicate',
  notes: 'Same dataset: ungrouped frequency table of weights of 25 students: 15(3),16(4),18(3),20(5),24(2),25(6),27(2). Verified max frequency=6 at weight 25 (mode); range = 27-15 = 12. Row1 (18001fe9) option B="25 kg" matches the mode. Row2 (422ebb3d) option C=12 matches the range. No conflict — same dataset, different statistic asked (mode vs range). Row2 has more history and is kept; Row1 rewritten to a different frequency table — ages of 30 students: 12(4),13(6),14(9),15(5),16(4),17(2) (verified sum=30, max freq=9 at age 14).',
  keep_id: '422ebb3d-bda6-4a44-88f6-cd0c8883be26',
  rewrites: [
    {
      id: '18001fe9-b642-410a-beb2-9450ab041a5f',
      question_text: 'An ungrouped frequency table of the ages (years) of 30 students in a class gives: 12 (4), 13 (6), 14 (9), 15 (5), 16 (4), 17 (2). To which age do the maximum number of students belong?',
      question_text_ta: '30 மாணவர்களின் வயதுகளின் (ஆண்டுகள்) தொகுக்கப்படாத நிகழ்வெண் அட்டவணை: 12 (4), 13 (6), 14 (9), 15 (5), 16 (4), 17 (2). அதிகபட்ச மாணவர்கள் எந்த வயதைச் சேர்ந்தவர்கள்?',
      option_a: '14 years', option_b: '13 years', option_c: '15 years', option_d: '17 years', correct_answer: 'A',
      explanation: 'Given:\nFrequencies: 12 \\((4)\\), 13 \\((6)\\), 14 \\((9)\\), 15 \\((5)\\), 16 \\((4)\\), 17 \\((2)\\)\nWorking:\nThe age with the maximum number of students is the one with the highest frequency.\n\\(\\max(4,6,9,5,4,2) = 9\\), occurring at age \\(14\\)\nAsked:\nAge to which the maximum number of students belong\n\\(= 14\\) years\n→ Option (A)',
      explanation_ta: 'தரவுகள்:\nஅலைவெண்கள்: 12 \\((4)\\), 13 \\((6)\\), 14 \\((9)\\), 15 \\((5)\\), 16 \\((4)\\), 17 \\((2)\\)\nசெயல்முறை:\nஅதிகபட்ச மாணவர்கள் உள்ள வயது என்பது அதிக அலைவெண் கொண்டது.\n\\(\\max(4,6,9,5,4,2) = 9\\), இது வயது \\(14\\)-இல் நிகழ்கிறது\nகேட்டது:\nஅதிகபட்ச மாணவர்கள் சேர்ந்த வயது\n\\(= 14\\) ஆண்டுகள்\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

OUT.push({
  topic: 'Conversion of Information to Data',
  group_nums: '2,24,3,5,6,8',
  classification: 'true_duplicate',
  notes: 'Same dataset: 24-hour day, Sleep=8,School=6,Play=2,Homework=3,Other=5. Verified: Sleep%=8/24*100=33.33%; angle/hr=15°; Homework angle=45°, Play angle=30°, difference=15° (matches "(b) 15° more"); Sleep angle=120°, Other angle=75°, difference=45° (matches "(c) 45° less"). Row1 (31c5acf5) option C = "(a) 33.33%; (b) 15° more; (c) 45° less" matches all three verified values. Row2 (46a0260d) option A=33.33% matches part (a) alone. No conflict — Row2 is a subset of Row1\'s question, same dataset. Row1 has more history and is kept; Row2 rewritten to a different 24-hour breakdown — Sleep=6,Work=9,Commute=2,Leisure=3,Other=4 (sum=24), asking sleep% = 6/24*100 = 25% (verified).',
  keep_id: '31c5acf5-9be6-4c2a-8e25-7056711bf798',
  rewrites: [
    {
      id: '46a0260d-e918-4eb4-b879-e576ff97e2ca',
      question_text: 'A working professional spends a 24-hour day as follows: Sleep 6 hours, Work 9 hours, Commute 2 hours, Leisure 3 hours, Other 4 hours. In a pie chart of this data, what is the percentage of sleeping hours?',
      question_text_ta: 'ஒரு பணியாளர் 24 மணி நேர நாளை பின்வருமாறு செலவிடுகிறார்: தூக்கம் 6 மணி, வேலை 9 மணி, பயணம் 2 மணி, ஓய்வு 3 மணி, இதர 4 மணி. இந்தத் தரவின் வட்ட விளக்கப்படத்தில், தூக்க மணிநேரங்களின் சதவீதம் என்ன?',
      option_a: '25%', option_b: '37.5%', option_c: '12.5%', option_d: '33.33%', correct_answer: 'A',
      explanation: 'Given:\nSleep \\(=6\\) hours; total \\(=24\\) hours\nWorking:\nFormula: Percentage \\(= \\dfrac{\\text{part}}{\\text{total}} \\times 100\\)\n\\(\\dfrac{6}{24} \\times 100 = 25\\%\\)\nAsked:\nPercentage of sleeping hours\n\\(= 25\\%\\)\n→ Option (A)',
      explanation_ta: 'தரவுகள்:\nதூக்கம் \\(=6\\) மணி; மொத்தம் \\(=24\\) மணி\nசெயல்முறை:\nசூத்திரம்: சதவீதம் \\(= \\dfrac{\\text{பகுதி}}{\\text{மொத்தம்}} \\times 100\\)\n\\(\\dfrac{6}{24} \\times 100 = 25\\%\\)\nகேட்டது:\nதூக்க மணிநேரங்களின் சதவீதம்\n\\(= 25\\%\\)\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

// ===================== Parametric Representation =====================

OUT.push({
  topic: 'Parametric Representation',
  group_nums: '10,24,38,45,65,70,70,75,75,8,80,80,85,85,90',
  classification: 'true_duplicate',
  notes: 'Same dataset: pensioners ages, 65-70=38,70-75=45,75-80=24,80-85=10,85-90=8. Verified: total=38+45+24+10+8=125; modal class (max frequency 45) = 70-75. Row1 (52e2342c) option B=125 matches the total. Row2 (a166e919) option C="70-75" matches the modal class. No conflict — same dataset, different statistic asked. Row1 has more history and is kept; Row2 rewritten to a different frequency-curve/modal-class dataset — weights of workers: 50-55=12,55-60=28,60-65=35,65-70=18,70-75=7 (verified max freq=35 at class 60-65).',
  keep_id: '52e2342c-0de7-4b8b-a10b-330d3fdb3a0f',
  rewrites: [
    {
      id: 'a166e919-11dd-4734-a98f-bf76f9490111',
      question_text: 'The weights (kg) of a group of workers are distributed as: 50-55 = 12, 55-60 = 28, 60-65 = 35, 65-70 = 18, 70-75 = 7 workers. A frequency curve is drawn to show the tendency of the data. Which weight class has the highest frequency (the modal class)?',
      question_text_ta: 'ஒரு குழு தொழிலாளர்களின் எடைகள் (கி.கி) பின்வருமாறு பகிர்ந்துள்ளன: 50-55 = 12, 55-60 = 28, 60-65 = 35, 65-70 = 18, 70-75 = 7 தொழிலாளர்கள். தரவின் போக்கைக் காட்ட அலைவெண் வளைவரை வரையப்படுகிறது. எந்த எடை வகுப்பு அதிகபட்ச அலைவெண்ணைக் கொண்டுள்ளது (முகடு வகுப்பு)?',
      option_a: '60-65', option_b: '55-60', option_c: '65-70', option_d: '50-55', correct_answer: 'A',
      explanation: 'Given:\nFrequencies: 50-55 \\(=12\\), 55-60 \\(=28\\), 60-65 \\(=35\\), 65-70 \\(=18\\), 70-75 \\(=7\\)\nWorking:\nModal class \\(=\\) class with the maximum frequency\n\\(\\max(12,28,35,18,7) = 35\\)\nClass corresponding to \\(35 = \\) 60-65\nAsked:\nModal class\n\\(=\\) 60-65\n→ Option (A)',
      explanation_ta: 'தரவுகள்:\nஅலைவெண்கள்: 50-55 \\(=12\\), 55-60 \\(=28\\), 60-65 \\(=35\\), 65-70 \\(=18\\), 70-75 \\(=7\\)\nசெயல்முறை:\nமுகடு வகுப்பு \\(=\\) அதிகபட்ச அலைவெண் கொண்ட வகுப்பு\n\\(\\max(12,28,35,18,7) = 35\\)\n\\(35\\)-க்கு உரிய வகுப்பு \\(=\\) 60-65\nகேட்டது:\nமுகடு வகுப்பு\n\\(=\\) 60-65\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

OUT.push({
  topic: 'Parametric Representation',
  group_nums: '100,112,117,12,120,13,133,14,15,16,2011,2012,2013,2014,2015',
  classification: 'true_duplicate',
  notes: 'Same dataset: firm Net Worth 2011-12=100,2012-13=112,2013-14=120,2014-15=133,2015-16=117. Verified: sum=582, average=582/5=116.4; max value=133 in 2014-15. Row1 (661247fc) option A=116.4 matches the average. Row2 (fb5ad431) option B="2014-15" matches the year of highest net worth. No conflict — same dataset, different statistic asked. Row2 has more history and is kept; Row1 rewritten to a different firm/years dataset — 2016-17=90,2017-18=105,2018-19=98,2019-20=112,2020-21=120 (verified sum=525, average=105).',
  keep_id: 'fb5ad431-7266-470b-9eb5-be774895a543',
  rewrites: [
    {
      id: '661247fc-1110-4576-b7e1-1257d363c094',
      question_text: "A firm's Net Worth (Rs. in lakhs) over five years is: 2016-17 = 90, 2017-18 = 105, 2018-19 = 98, 2019-20 = 112, 2020-21 = 120. What is the average (mean) Net Worth over these five years?",
      question_text_ta: 'ஒரு நிறுவனத்தின் ஐந்து ஆண்டு நிகர மதிப்பு (Rs. லட்சங்களில்): 2016-17 = 90, 2017-18 = 105, 2018-19 = 98, 2019-20 = 112, 2020-21 = 120. இந்த ஐந்து ஆண்டுகளின் சராசரி நிகர மதிப்பு என்ன?',
      option_a: 'Rs. 105.0 lakhs', option_b: 'Rs. 112.0 lakhs', option_c: 'Rs. 101.0 lakhs', option_d: 'Rs. 108.5 lakhs', correct_answer: 'A',
      explanation: 'Given:\nValues (Rs. in lakhs): \\(90,\\ 105,\\ 98,\\ 112,\\ 120\\)\nNumber of years \\(= 5\\)\nWorking:\nFormula: \\(\\text{Average} = \\dfrac{\\text{Sum of all values}}{\\text{Number of values}}\\)\n\\(\\text{Sum} = 90+105+98+112+120 = 525\\)\n\\(\\text{Average} = \\dfrac{525}{5} = 105\\)\nAsked:\nAverage Net Worth\n\\(= \\text{Rs.}\\,105.0\\) lakhs\n→ Option (A)',
      explanation_ta: 'தரவுகள்:\nமதிப்புகள் (Rs. லட்சங்களில்): \\(90,\\ 105,\\ 98,\\ 112,\\ 120\\)\nஆண்டுகளின் எண்ணிக்கை \\(= 5\\)\nசெயல்முறை:\nசூத்திரம்: சராசரி = மதிப்புகளின் கூட்டுத்தொகை / மதிப்புகளின் எண்ணிக்கை\nகூட்டுத்தொகை \\(= 90+105+98+112+120 = 525\\)\nசராசரி \\(= \\dfrac{525}{5} = 105\\)\nகேட்டது:\nசராசரி நிகர மதிப்பு\n\\(= \\text{Rs.}\\,105.0\\) லட்சம்\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

// ===================== Simplification =====================

OUT.push({
  topic: 'Simplification',
  group_nums: '18',
  classification: 'false_positive',
  notes: 'Row1 (5b13efe6) is a two-digit-number digit problem: number is 7x sum of digits, reversed number is 18 LESS than original. Verified: with a=tens,b=units, 10a+b=7(a+b) -> a=2b; and 10a+b-(10b+a)=18 -> a-b=2; solving gives b=2,a=4, number=42 (check: sum of digits=6, 7*6=42 ✓; reversed=24, 42-24=18 ✓) — matches option D=42, confirmed correct. Row2 (9a18b13e) is a completely different problem: "One third of one half of one fifth of a number is 18" -> a simple compound-fraction-of-a-number question. Verified: (1/3)(1/2)(1/5)x=18 -> x/30=18 -> x=540 — matches option B=540, confirmed correct. Both rows are independently correct but are unrelated problem types; they only coincidentally both contain the number 18 (as a "difference" in Row1 and as the fraction\'s result in Row2). No change needed to either row.',
  keep_id: null,
  rewrites: [],
  conflict_details: null,
})

// ===================== Time, Work , Speed And Distance =====================

OUT.push({
  topic: 'Time, Work , Speed And Distance',
  group_nums: '12,24,8',
  classification: 'true_duplicate',
  notes: 'This group has 3 rows but is a MIXED case. Row1 (2e93aad4, "A,B,C can do a work in 12,24,8 days... they work 1 day, then C leaves, how many days for A&B to finish rest") is a genuinely DIFFERENT problem from the other two — verified independently: combined 1-day work of A+B+C = 1/12+1/24+1/8 = 6/24 = 1/4, remaining = 3/4; A+B combined rate = 1/12+1/24 = 1/8/day; time = (3/4)/(1/8) = 6 days, matching its option C=6 — it only coincidentally reuses the numbers 12, 24, 8 (as individual days for three different workers) and is NOT part of the duplicate; left completely untouched (false-positive-within-group). Row2 (37a96571) and Row3 (b919ea92) are the true duplicate pair, near-identical text: "12 men can do a piece of work in 24 days. How many days ... if 8 men do this work?" Verified: men-days = 12*24 = 288; with 8 men, days = 288/8 = 36. Row2 option A=36 matches; Row3 option B=36 matches. No conflict. Row2 has far more history (n_seen=2,n_ans=2 vs 0,0) and is kept; Row3 rewritten to a different men/days problem — 15 men, 20 days, 10 men -> 30 days (verified).',
  keep_id: '37a96571-696b-4415-9188-fe4610357ab6',
  rewrites: [
    {
      id: 'b919ea92-f0ed-476f-a8bc-0cda70db243b',
      question_text: '15 men can do a piece of work in 20 days. How many days are needed to complete the work, if 10 men do this work?',
      question_text_ta: '15 ஆண்கள் 20 நாட்களில் ஒரு வேலையைச் செய்யலாம். 10 ஆண்கள் இந்த வேலையைச் செய்தால், வேலையை முடிக்க எத்தனை நாட்கள் தேவை?',
      option_a: '30 days', option_b: '25 days', option_c: '40 days', option_d: '45 days', correct_answer: 'A',
      explanation: 'Given:\nMen \\(M_1 = 15\\), days \\(D_1 = 20\\)\nNew men \\(M_2 = 10\\)\nWorking:\nFormula: \\(M_1 \\times D_1 = M_2 \\times D_2\\)\n\\(15 \\times 20 = 10 \\times D_2\\)\n\\(300 = 10 \\times D_2\\)\n\\(D_2 = \\dfrac{300}{10} = 30\\)\nAsked:\nDays needed for 10 men\n\\(= 30\\) days\n→ Option (A)',
      explanation_ta: 'தரவுகள்:\nஆண்களின் எண்ணிக்கை \\(M_1 = 15\\), நாட்கள் \\(D_1 = 20\\)\nபுதிய ஆண்களின் எண்ணிக்கை \\(M_2 = 10\\)\nசெயல்முறை:\nசூத்திரம்: \\(M_1 \\times D_1 = M_2 \\times D_2\\)\n\\(15 \\times 20 = 10 \\times D_2\\)\n\\(300 = 10 \\times D_2\\)\n\\(D_2 = \\dfrac{300}{10} = 30\\)\nகேட்டது:\n10 ஆண்களுக்குத் தேவையான நாட்கள்\n\\(= 30\\) நாட்கள்\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

// ===================== Clock Problems =====================

OUT.push({
  topic: 'Clock Problems',
  group_nums: '4.20',
  classification: 'true_duplicate',
  notes: 'Same problem: angle between hands at 4:20. Verified using Angle=|30H-5.5M|: |30*4-5.5*20| = |120-110| = 10°. Row1 (3605d6d5) option B=10° matches; Row2 (79b0713b) option B=10° matches (Row2\'s explanation uses an equivalent hand-position method and also arrives at 10°). No conflict — identical value under the same option letter, option sets differ only in option A (0° vs 15°). Row1 has slightly more history (n_ans=2 vs 1) and is kept; Row2 rewritten to a different time — 6:30 -> angle=15° (verified: |30*6-5.5*30|=|180-165|=15°).',
  keep_id: '3605d6d5-68ed-48fb-9ea9-f2f0ecde63a9',
  rewrites: [
    {
      id: '79b0713b-b8bf-420f-80a5-b6425d9ba332',
      question_text: 'The angle between the minute hand and the hour hand of a clock when the time is 6:30, is:',
      question_text_ta: 'நேரம் 6:30 ஆக இருக்கும்போது கடிகாரத்தின் நிமிடமுள் மற்றும் மணிமுள்ளுக்கு இடையிலான கோணம்:',
      option_a: '15°', option_b: '0°', option_c: '30°', option_d: '180°', correct_answer: 'A',
      explanation: "Given:\nTime \\(= 6{:}30\\), so \\(H = 6\\), \\(M = 30\\).\nFormula: Angle \\(= |30H - 5.5M|\\)\nWorking:\n\\(= |30 \\times 6 - 5.5 \\times 30|\\)\n\\(= |180 - 165|\\)\n\\(= 15^\\circ\\)\nAsked:\nAngle between the hands\n\\(= 15^\\circ\\)\n→ Option (A)",
      explanation_ta: 'தரவுகள்:\nநேரம் \\(= 6{:}30\\), எனவே \\(H = 6\\), \\(M = 30\\).\nசூத்திரம்: கோணம் \\(= |30H - 5.5M|\\)\nசெயல்முறை:\n\\(= |30 \\times 6 - 5.5 \\times 30|\\)\n\\(= |180 - 165|\\)\n\\(= 15^\\circ\\)\nகேட்டது:\nமுட்களுக்கு இடையிலான கோணம்\n\\(= 15^\\circ\\)\nவிடை (A)',
    },
  ],
  conflict_details: null,
})

writeFileSync('C:/Users/mas20/Desktop/work/TNPSC/TNPSC-Academy/tnpsc-mentor/server/_dedup_batch_mixed.json', JSON.stringify(OUT, null, 2))
console.log('groups written:', OUT.length)
console.log('classification counts:', OUT.reduce((acc, g) => { acc[g.classification] = (acc[g.classification]||0)+1; return acc }, {}))
console.log('total rewrites:', OUT.reduce((n, g) => n + g.rewrites.length, 0))
