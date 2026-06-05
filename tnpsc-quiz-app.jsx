import { useState, useEffect, useRef } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────
const GROUP = {
  label: "Group I",
  labelTa: "குழு I",
  subtitle: "Combined Civil Services Examination",
  subtitleTa: "இணைந்த சிவில் சேவைகள் தேர்வு",
  color: "#7C3AED",
  bg: "#EDE9FE",
  icon: "⚖️",
};

const SUBJECTS = [
  { id: "history",     label: "History",          labelTa: "வரலாறு",              icon: "🏛️", count: 150, color: "#7C3AED", bg: "#EDE9FE" },
  { id: "geography",   label: "Geography",         labelTa: "புவியியல்",            icon: "🌍", count: 120, color: "#0369A1", bg: "#E0F2FE" },
  { id: "polity",      label: "Polity",            labelTa: "அரசியல் அறிவியல்",    icon: "🏛️", count: 130, color: "#059669", bg: "#D1FAE5" },
  { id: "economics",   label: "Economics",         labelTa: "பொருளாதாரம்",          icon: "📈", count: 100, color: "#D97706", bg: "#FEF3C7" },
  { id: "science",     label: "Science & Tech",    labelTa: "அறிவியல் & தொழில்நுட்பம்", icon: "🔬", count: 140, color: "#DC2626", bg: "#FEE2E2" },
  { id: "environment", label: "Environment",       labelTa: "சுற்றுச்சூழல்",        icon: "🌿", count: 80,  color: "#065F46", bg: "#D1FAE5" },
  { id: "tamil",       label: "Tamil Language",    labelTa: "தமிழ் மொழி",           icon: "📚", count: 160, color: "#9333EA", bg: "#F3E8FF" },
  { id: "aptitude",    label: "Aptitude & Mental", labelTa: "திறன் அறிவு",          icon: "🧠", count: 90,  color: "#0F766E", bg: "#CCFBF1" },
  { id: "current",     label: "Current Affairs",   labelTa: "நடப்பு நிகழ்வுகள்",   icon: "📰", count: 110, color: "#1D4ED8", bg: "#DBEAFE" },
];

const SAMPLE_QUESTIONS = {
  history: [
    { id:1, en:"Who is known as the 'Iron Man of India'?", ta:"'இந்தியாவின் இரும்பு மனிதர்' என்று யார் அழைக்கப்படுகிறார்?", options:{ en:["Mahatma Gandhi","Sardar Vallabhbhai Patel","Jawaharlal Nehru","Subhas Chandra Bose"], ta:["மகாத்மா காந்தி","சர்தார் வல்லபாய் படேல்","ஜவாஹர்லால் நேரு","சுபாஷ் சந்திர போஸ்"] }, correct:1, explanation:{ en:"Sardar Vallabhbhai Patel is known as the 'Iron Man of India' for his role in integrating the princely states.", ta:"சர்தார் வல்லபாய் படேல் சமஸ்தானங்களை ஒன்றிணைப்பதில் ஆற்றிய பங்கிற்காக 'இந்தியாவின் இரும்பு மனிதர்' என்று அழைக்கப்படுகிறார்." } },
    { id:2, en:"The Battle of Plassey was fought in which year?", ta:"பிளாசி போர் எந்த ஆண்டு நடந்தது?", options:{ en:["1757","1764","1776","1799"], ta:["1757","1764","1776","1799"] }, correct:0, explanation:{ en:"The Battle of Plassey was fought on June 23, 1757, between the British East India Company and the Nawab of Bengal.", ta:"பிளாசி போர் ஜூன் 23, 1757 அன்று பிரிட்டிஷ் கிழக்கிந்திய கம்பனிக்கும் வங்காள நவாப்புக்கும் இடையே நடந்தது." } },
    { id:3, en:"Who founded the Indian National Congress in 1885?", ta:"1885 ஆம் ஆண்டு இந்திய தேசிய காங்கிரஸை யார் நிறுவினார்?", options:{ en:["Dadabhai Naoroji","A.O. Hume","Bal Gangadhar Tilak","Gopal Krishna Gokhale"], ta:["தாதாபாய் நௌரோஜி","A.O. ஹியூம்","பால் கங்காதர் திலக்","கோபால் கிருஷ்ண கோகலே"] }, correct:1, explanation:{ en:"Allan Octavian Hume, a retired British civil servant, founded the Indian National Congress in 1885.", ta:"ஓய்வுபெற்ற பிரிட்டிஷ் சிவில் சேவகரான அல்லன் அக்டேவியன் ஹியூம் 1885 ஆம் ஆண்டு இந்திய தேசிய காங்கிரஸை நிறுவினார்." } },
    { id:4, en:"The Jallianwala Bagh massacre occurred in which city?", ta:"ஜல்லியன் வாலாபாக் படுகொலை எந்த நகரில் நடந்தது?", options:{ en:["Delhi","Amritsar","Lahore","Lucknow"], ta:["டெல்லி","அமிர்தசரஸ்","லாஹூர்","லக்னோ"] }, correct:1, explanation:{ en:"The Jallianwala Bagh massacre took place on April 13, 1919, in Amritsar, Punjab.", ta:"ஜல்லியன் வாலாபாக் படுகொலை ஏப்ரல் 13, 1919 அன்று பஞ்சாப் மாநிலம் அமிர்தசரஸில் நடந்தது." } },
    { id:5, en:"Which Mughal emperor built the Taj Mahal?", ta:"தாஜ் மஹாலை எந்த முகலாய பேரரசர் கட்டினார்?", options:{ en:["Akbar","Jahangir","Shah Jahan","Aurangzeb"], ta:["அக்பர்","ஜஹாங்கீர்","ஷாஜஹான்","ஔரங்கசீப்"] }, correct:2, explanation:{ en:"Shah Jahan built the Taj Mahal in memory of his wife Mumtaz Mahal between 1632 and 1653.", ta:"ஷாஜஹான் தனது மனைவி மும்தாஜ் மஹாலின் நினைவாக 1632 முதல் 1653 வரை தாஜ் மஹாலை கட்டினார்." } },
  ],
  geography: [
    { id:1, en:"Which is the longest river in India?", ta:"இந்தியாவின் மிக நீண்ட ஆறு எது?", options:{ en:["Godavari","Ganga","Brahmaputra","Indus"], ta:["கோதாவரி","கங்கை","பிரம்மபுத்திரா","இந்துஸ்"] }, correct:1, explanation:{ en:"The Ganga (Ganges) is the longest river in India, flowing about 2,525 km.", ta:"கங்கை நதி இந்தியாவின் மிக நீண்ட ஆறு, சுமார் 2,525 கிமீ நீளம் கொண்டது." } },
    { id:2, en:"Tamil Nadu shares its border with how many states?", ta:"தமிழ்நாடு எத்தனை மாநிலங்களுடன் எல்லையைப் பகிர்ந்து கொள்கிறது?", options:{ en:["2","3","4","5"], ta:["2","3","4","5"] }, correct:1, explanation:{ en:"Tamil Nadu shares borders with 3 states: Kerala, Karnataka, and Andhra Pradesh.", ta:"தமிழ்நாடு கேரளா, கர்நாடகா மற்றும் ஆந்திரப்பிரதேசம் என 3 மாநிலங்களுடன் எல்லையைப் பகிர்ந்து கொள்கிறது." } },
    { id:3, en:"Which mountain range separates India from China?", ta:"இந்தியாவை சீனாவிலிருந்து பிரிக்கும் மலைத்தொடர் எது?", options:{ en:["Western Ghats","Aravalli Range","Himalayas","Vindhya Range"], ta:["மேற்குத் தொடர்ச்சி மலை","அரவல்லி மலைத்தொடர்","இமயமலை","விந்திய மலைத்தொடர்"] }, correct:2, explanation:{ en:"The Himalayas form the natural boundary between India and China.", ta:"இமயமலை இந்தியாவிற்கும் சீனாவிற்கும் இடையே இயற்கையான எல்லையை உருவாக்குகிறது." } },
    { id:4, en:"The Nilgiri Hills are located in which state?", ta:"நீலகிரி மலைகள் எந்த மாநிலத்தில் அமைந்துள்ளன?", options:{ en:["Kerala","Karnataka","Tamil Nadu","Andhra Pradesh"], ta:["கேரளா","கர்நாடகா","தமிழ்நாடு","ஆந்திரப்பிரதேசம்"] }, correct:2, explanation:{ en:"The Nilgiri Hills are located primarily in Tamil Nadu, with parts extending into Kerala and Karnataka.", ta:"நீலகிரி மலைகள் முதன்மையாக தமிழ்நாட்டில் அமைந்துள்ளன, சில பகுதிகள் கேரளா மற்றும் கர்நாடகாவில் நீடிக்கின்றன." } },
    { id:5, en:"Which is the largest desert in India?", ta:"இந்தியாவின் மிகப்பெரிய பாலைவனம் எது?", options:{ en:["Rann of Kutch","Thar Desert","Deccan Plateau","Cold Desert of Ladakh"], ta:["கட்ச் ஓடை","தார் பாலைவனம்","டெக்கான் பீடபூமி","லடாக்கின் குளிர் பாலைவனம்"] }, correct:1, explanation:{ en:"The Thar Desert, also known as the Great Indian Desert, is the largest desert in India covering about 200,000 sq km.", ta:"மகா இந்திய பாலைவனம் என்றும் அழைக்கப்படும் தார் பாலைவனம் சுமார் 2 லட்சம் சதுர கிமீ பரப்பளவுடன் இந்தியாவின் மிகப்பெரிய பாலைவனம்." } },
  ],
  polity: [
    { id:1, en:"The Constitution of India came into effect on which date?", ta:"இந்திய அரசியலமைப்பு எந்த தேதியில் நடைமுறைக்கு வந்தது?", options:{ en:["August 15, 1947","January 26, 1950","November 26, 1949","December 9, 1946"], ta:["ஆகஸ்ட் 15, 1947","ஜனவரி 26, 1950","நவம்பர் 26, 1949","டிசம்பர் 9, 1946"] }, correct:1, explanation:{ en:"The Constitution of India came into effect on January 26, 1950, which is celebrated as Republic Day.", ta:"இந்திய அரசியலமைப்பு ஜனவரி 26, 1950 அன்று நடைமுறைக்கு வந்தது, இது குடியரசு தினமாக கொண்டாடப்படுகிறது." } },
    { id:2, en:"How many articles does the original Constitution of India have?", ta:"இந்திய அரசியலமைப்பின் மூல வடிவத்தில் எத்தனை சட்டப்பிரிவுகள் உள்ளன?", options:{ en:["395","444","448","470"], ta:["395","444","448","470"] }, correct:0, explanation:{ en:"The original Constitution had 395 articles, 8 schedules, and 22 parts.", ta:"மூல அரசியலமைப்பில் 395 சட்டப்பிரிவுகள், 8 அட்டவணைகள் மற்றும் 22 பகுதிகள் இருந்தன." } },
    { id:3, en:"Who is the constitutional head of a state in India?", ta:"இந்தியாவில் ஒரு மாநிலத்தின் அரசியலமைப்பு தலைவர் யார்?", options:{ en:["Chief Minister","Governor","President","Speaker"], ta:["முதலமைச்சர்","ஆளுநர்","குடியரசுத் தலைவர்","சபாநாயகர்"] }, correct:1, explanation:{ en:"The Governor is the constitutional head of a state, appointed by the President of India.", ta:"ஆளுநர் மாநிலத்தின் அரசியலமைப்பு தலைவர், இந்தியக் குடியரசுத் தலைவரால் நியமிக்கப்படுகிறார்." } },
    { id:4, en:"The Right to Education Act was passed in which year?", ta:"கல்வி உரிமைச் சட்டம் எந்த ஆண்டு நிறைவேற்றப்பட்டது?", options:{ en:["2007","2009","2011","2013"], ta:["2007","2009","2011","2013"] }, correct:1, explanation:{ en:"The Right to Education (RTE) Act was passed in 2009, providing free and compulsory education to children aged 6-14.", ta:"கல்வி உரிமைச் சட்டம் (RTE) 2009 ஆம் ஆண்டு நிறைவேற்றப்பட்டது, 6-14 வயதுடைய குழந்தைகளுக்கு இலவச மற்றும் கட்டாயக் கல்வியை வழங்குகிறது." } },
    { id:5, en:"Which article of the Indian Constitution abolishes untouchability?", ta:"இந்திய அரசியலமைப்பின் எந்த சட்டப்பிரிவு தீண்டாமையை ஒழிக்கிறது?", options:{ en:["Article 14","Article 15","Article 17","Article 21"], ta:["சட்டப்பிரிவு 14","சட்டப்பிரிவு 15","சட்டப்பிரிவு 17","சட்டப்பிரிவு 21"] }, correct:2, explanation:{ en:"Article 17 of the Indian Constitution abolishes untouchability and forbids its practice in any form.", ta:"இந்திய அரசியலமைப்பின் 17வது சட்டப்பிரிவு தீண்டாமையை ஒழித்து அதை எந்த வடிவத்திலும் கடைப்பிடிப்பதை தடை செய்கிறது." } },
  ],
};
["economics","science","environment","tamil","aptitude","current"].forEach(id => { SAMPLE_QUESTIONS[id] = SAMPLE_QUESTIONS.polity; });

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

// ─── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async () => {
    setError("");
    if (!form.email || !form.password) return setError("Please fill all fields.");
    if (mode === "signup" && !form.name) return setError("Enter your name.");
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setLoading(false);
    onAuth({ name: form.name || form.email.split("@")[0], email: form.email });
  };
  const inputStyle = { width:"100%", padding:"0.75rem 1rem", borderRadius:10, border:"1.5px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.08)", color:"#fff", fontSize:15, outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#0f0c29,#302b63,#24243e)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ width:"100%", maxWidth:420 }}>
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{ width:76, height:76, background:"rgba(124,58,237,0.3)", border:"2px solid rgba(124,58,237,0.6)", borderRadius:22, display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, margin:"0 auto 1rem" }}>📝</div>
          <h1 style={{ color:"#fff", fontSize:30, fontWeight:800, margin:0, letterSpacing:"-1px" }}>TNPSC Prep</h1>
          <p style={{ color:"rgba(255,255,255,0.45)", margin:"0.4rem 0 0", fontSize:13, letterSpacing:"0.5px" }}>TAMIL NADU PUBLIC SERVICE COMMISSION</p>
        </div>
        <div style={{ background:"rgba(255,255,255,0.06)", backdropFilter:"blur(24px)", borderRadius:22, padding:"2rem", border:"1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display:"flex", background:"rgba(0,0,0,0.25)", borderRadius:12, padding:4, marginBottom:"1.5rem" }}>
            {["login","signup"].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ flex:1, padding:"0.6rem", borderRadius:9, border:"none", cursor:"pointer", fontWeight:700, fontSize:14, fontFamily:"inherit", transition:"all 0.2s", background:mode===m?"#7C3AED":"transparent", color:mode===m?"#fff":"rgba(255,255,255,0.5)" }}>
                {m==="login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>
          {mode==="signup" && (
            <div style={{ marginBottom:"1rem" }}>
              <label style={{ color:"rgba(255,255,255,0.7)", fontSize:12, fontWeight:700, display:"block", marginBottom:6, letterSpacing:"0.5px" }}>FULL NAME</label>
              <input name="name" value={form.name} onChange={handle} placeholder="Enter your name" style={inputStyle} />
            </div>
          )}
          <div style={{ marginBottom:"1rem" }}>
            <label style={{ color:"rgba(255,255,255,0.7)", fontSize:12, fontWeight:700, display:"block", marginBottom:6, letterSpacing:"0.5px" }}>EMAIL</label>
            <input name="email" value={form.email} onChange={handle} placeholder="your@email.com" style={inputStyle} />
          </div>
          <div style={{ marginBottom:"1.5rem" }}>
            <label style={{ color:"rgba(255,255,255,0.7)", fontSize:12, fontWeight:700, display:"block", marginBottom:6, letterSpacing:"0.5px" }}>PASSWORD</label>
            <input name="password" type="password" value={form.password} onChange={handle} placeholder="••••••••" style={inputStyle} />
          </div>
          {error && <div style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.4)", borderRadius:9, padding:"0.6rem 1rem", color:"#fca5a5", fontSize:13, marginBottom:"1rem" }}>{error}</div>}
          <button onClick={submit} disabled={loading} style={{ width:"100%", padding:"0.9rem", borderRadius:12, border:"none", background:loading?"rgba(124,58,237,0.4)":"linear-gradient(135deg,#7C3AED,#5B21B6)", color:"#fff", fontWeight:700, fontSize:16, cursor:loading?"wait":"pointer", fontFamily:"inherit" }}>
            {loading ? "Please wait…" : mode==="login" ? "Sign In →" : "Create Account →"}
          </button>
          <div style={{ textAlign:"center", marginTop:"1.2rem" }}>
            <button onClick={() => onAuth({ name:"Guest User", email:"guest@tnpsc.app" })} style={{ background:"none", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, color:"rgba(255,255,255,0.45)", fontSize:13, cursor:"pointer", padding:"0.4rem 1.2rem", fontFamily:"inherit" }}>
              Continue as Guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Language Screen ───────────────────────────────────────────────────────────
function LanguageScreen({ onSelect }) {
  const [selected, setSelected] = useState(null);
  const opts = [
    { id:"en",   flag:"🇬🇧", label:"English",           labelSub:"English only",              desc:"All questions and answers in English" },
    { id:"ta",   flag:"🇮🇳", label:"தமிழ்",             labelSub:"Tamil only",                desc:"அனைத்து கேள்விகளும் தமிழில்" },
    { id:"both", flag:"🌐",  label:"English + தமிழ்",   labelSub:"Bilingual",                 desc:"Questions shown in both languages" },
  ];
  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#0f0c29,#302b63,#24243e)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"2rem", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ width:"100%", maxWidth:460 }}>
        <div style={{ textAlign:"center", marginBottom:"2.5rem" }}>
          <div style={{ fontSize:44, marginBottom:"0.75rem" }}>🌐</div>
          <h2 style={{ fontSize:28, fontWeight:800, color:"#fff", margin:"0 0 0.4rem", letterSpacing:"-0.5px" }}>Choose Language</h2>
          <p style={{ color:"rgba(255,255,255,0.45)", fontSize:14, margin:0 }}>மொழியை தேர்ந்தெடுக்கவும்</p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"0.9rem", marginBottom:"2rem" }}>
          {opts.map(o => (
            <div key={o.id} onClick={() => setSelected(o.id)} style={{ background: selected===o.id ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.06)", border:`2px solid ${selected===o.id ? "#7C3AED" : "rgba(255,255,255,0.1)"}`, borderRadius:16, padding:"1.1rem 1.4rem", display:"flex", alignItems:"center", gap:"1.2rem", cursor:"pointer", transition:"all 0.2s", backdropFilter:"blur(10px)" }}>
              <span style={{ fontSize:34, flexShrink:0 }}>{o.flag}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:18, color:"#fff" }}>{o.label}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", marginTop:2 }}>{o.desc}</div>
              </div>
              <div style={{ width:22, height:22, borderRadius:"50%", border:`2px solid ${selected===o.id ? "#7C3AED" : "rgba(255,255,255,0.2)"}`, background:selected===o.id ? "#7C3AED" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {selected===o.id && <div style={{ width:8, height:8, borderRadius:"50%", background:"#fff" }} />}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => selected && onSelect(selected)} style={{ width:"100%", padding:"0.95rem", borderRadius:14, border:"none", background: selected ? "linear-gradient(135deg,#7C3AED,#5B21B6)" : "rgba(255,255,255,0.1)", color: selected ? "#fff" : "rgba(255,255,255,0.3)", fontWeight:700, fontSize:16, cursor: selected ? "pointer" : "default", fontFamily:"inherit", transition:"all 0.2s" }}>
          Continue →
        </button>
      </div>
    </div>
  );
}

// ─── Top Bar ───────────────────────────────────────────────────────────────────
function TopBar({ user, lang, onHome }) {
  return (
    <div style={{ background:"#1e1b4b", padding:"0.8rem 1.5rem", display:"flex", alignItems:"center", justifyContent:"space-between", fontFamily:"'Segoe UI',system-ui,sans-serif", borderBottom:"1px solid rgba(124,58,237,0.3)" }}>
      <div onClick={onHome} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
        <span style={{ fontSize:20 }}>📝</span>
        <span style={{ fontWeight:800, color:"#fff", fontSize:16, letterSpacing:"-0.3px" }}>TNPSC Prep</span>
        <span style={{ fontSize:11, background:"rgba(124,58,237,0.4)", color:"#c4b5fd", padding:"2px 8px", borderRadius:6, fontWeight:600 }}>Group I</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
        <span style={{ fontSize:12, background:"rgba(124,58,237,0.3)", color:"#c4b5fd", padding:"3px 10px", borderRadius:8, fontWeight:600 }}>
          {lang==="ta" ? "தமிழ்" : lang==="both" ? "EN + தமிழ்" : "English"}
        </span>
        <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#7C3AED,#5B21B6)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:14 }}>
          {user?.name?.[0]?.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

// ─── Subject Screen ────────────────────────────────────────────────────────────
function SubjectScreen({ lang, onSelect }) {
  const [hovered, setHovered] = useState(null);
  const getName = s => lang==="ta" ? s.labelTa : s.label;
  return (
    <div style={{ minHeight:"calc(100vh - 56px)", background:"#0f0e1a", padding:"1.5rem", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ maxWidth:700, margin:"0 auto" }}>
        <div style={{ marginBottom:"1.5rem" }}>
          <h2 style={{ fontSize:22, fontWeight:800, color:"#fff", margin:"0 0 0.3rem", letterSpacing:"-0.4px" }}>
            {lang==="ta" ? "தலைப்பை தேர்ந்தெடுக்கவும்" : "Select a Subject"}
          </h2>
          <p style={{ color:"rgba(255,255,255,0.4)", fontSize:14, margin:0 }}>
            {lang==="ta" ? "குழு I பாடத்திட்டம்" : "Group I Syllabus — Choose your topic to begin"}
          </p>
        </div>

        {/* Group I banner */}
        <div style={{ background:"linear-gradient(135deg,rgba(124,58,237,0.3),rgba(91,33,182,0.2))", border:"1px solid rgba(124,58,237,0.4)", borderRadius:16, padding:"1rem 1.4rem", marginBottom:"1.5rem", display:"flex", alignItems:"center", gap:"1rem" }}>
          <span style={{ fontSize:28 }}>⚖️</span>
          <div>
            <div style={{ fontWeight:700, color:"#c4b5fd", fontSize:15 }}>TNPSC Group I — {lang==="ta" ? "இணைந்த சிவில் சேவைகள்" : "Combined Civil Services"}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:2 }}>{lang==="ta" ? "9 பாடங்கள் • 1,080 கேள்விகள்" : "9 Subjects • 1,080 Questions"}</div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(195px,1fr))", gap:"0.9rem" }}>
          {SUBJECTS.map(s => (
            <div key={s.id} onClick={() => onSelect(s.id)} onMouseEnter={() => setHovered(s.id)} onMouseLeave={() => setHovered(null)}
              style={{ background: hovered===s.id ? `${s.color}22` : "rgba(255,255,255,0.05)", border:`1.5px solid ${hovered===s.id ? s.color : "rgba(255,255,255,0.08)"}`, borderRadius:16, padding:"1.2rem", cursor:"pointer", transition:"all 0.2s", transform: hovered===s.id ? "translateY(-3px)" : "none" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.8rem" }}>
                <div style={{ width:44, height:44, borderRadius:12, background:`${s.color}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{s.icon}</div>
                <span style={{ fontSize:11, color:s.color, background:`${s.color}15`, padding:"2px 8px", borderRadius:6, fontWeight:700 }}>{s.count} Qs</span>
              </div>
              <div style={{ fontWeight:700, fontSize:15, color:"#fff", marginBottom:3, lineHeight:1.3 }}>{getName(s)}</div>
              {lang==="both" && <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{s.label}</div>}
              <div style={{ marginTop:"0.8rem", background:"rgba(255,255,255,0.08)", height:3, borderRadius:3 }}>
                <div style={{ height:"100%", width:`${30 + (s.count % 70)}%`, background:`linear-gradient(90deg,${s.color},${s.color}88)`, borderRadius:3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Quiz Screen ───────────────────────────────────────────────────────────────
function QuizScreen({ lang, subject, onFinish, onBack }) {
  const subInfo = SUBJECTS.find(s => s.id === subject);
  const qs = useRef(shuffle(SAMPLE_QUESTIONS[subject] || SAMPLE_QUESTIONS.history).slice(0, 5)).current;
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showExp, setShowExp] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [timer, setTimer] = useState(30);
  const timerRef = useRef(null);

  useEffect(() => {
    setTimer(30); setSelected(null); setShowExp(false);
    timerRef.current = setInterval(() => setTimer(t => {
      if (t <= 1) { clearInterval(timerRef.current); doNext(null, true); return 0; }
      return t - 1;
    }), 1000);
    return () => clearInterval(timerRef.current);
  }, [current]);

  const q = qs[current];
  const opts = (lang==="ta" || lang==="both") ? q.options.ta : q.options.en;
  const isBoth = lang==="both";

  const handleAnswer = idx => {
    if (selected !== null) return;
    clearInterval(timerRef.current);
    setSelected(idx); setShowExp(true);
  };

  const doNext = (sel, auto=false) => {
    const ans = auto ? null : (sel !== undefined ? sel : selected);
    const newAnswers = [...answers, { q, selected:ans, correct:q.correct }];
    setAnswers(newAnswers);
    if (current + 1 < qs.length) setCurrent(c => c+1);
    else onFinish(newAnswers);
  };

  const progress = (current / qs.length) * 100;
  const timerPct = (timer / 30) * 100;
  const timerColor = timer > 10 ? subInfo.color : timer > 5 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ minHeight:"100vh", background:"#0f0e1a", padding:"1.5rem", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ maxWidth:660, margin:"0 auto" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.2rem" }}>
          <button onClick={onBack} style={{ background:"rgba(255,255,255,0.08)", border:"none", color:"rgba(255,255,255,0.6)", fontWeight:600, fontSize:14, cursor:"pointer", padding:"6px 14px", borderRadius:8, fontFamily:"inherit" }}>✕ Quit</button>
          <div style={{ display:"flex", alignItems:"center", gap:6, color:"rgba(255,255,255,0.7)", fontSize:14, fontWeight:600 }}>
            {subInfo.icon} {lang==="ta" ? subInfo.labelTa : subInfo.label}
          </div>
          {/* Circle timer */}
          <div style={{ position:"relative", width:46, height:46 }}>
            <svg width="46" height="46" style={{ position:"absolute", top:0, left:0, transform:"rotate(-90deg)" }}>
              <circle cx="23" cy="23" r="19" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
              <circle cx="23" cy="23" r="19" fill="none" stroke={timerColor} strokeWidth="3" strokeDasharray={`${2*Math.PI*19}`} strokeDashoffset={`${2*Math.PI*19*(1-timerPct/100)}`} strokeLinecap="round" style={{ transition:"stroke-dashoffset 0.9s linear, stroke 0.5s" }} />
            </svg>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13, color:timerColor }}>{timer}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:4, height:5, marginBottom:"0.5rem", overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${progress}%`, background:`linear-gradient(90deg,${subInfo.color},${subInfo.color}aa)`, borderRadius:4, transition:"width 0.4s" }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"rgba(255,255,255,0.35)", marginBottom:"1.2rem" }}>
          <span>Question {current+1} of {qs.length}</span>
          <span>{answers.filter(a=>a.selected===a.correct).length} correct so far</span>
        </div>

        {/* Question */}
        <div style={{ background:"rgba(255,255,255,0.06)", border:`1.5px solid ${subInfo.color}44`, borderRadius:18, padding:"1.4rem", marginBottom:"1rem" }}>
          {isBoth && <p style={{ fontSize:14, color:"rgba(255,255,255,0.45)", margin:"0 0 0.6rem", lineHeight:1.6 }}>{q.en}</p>}
          <p style={{ fontSize:18, fontWeight:600, color:"#fff", margin:0, lineHeight:1.65 }}>{isBoth ? q.ta : (lang==="ta" ? q.ta : q.en)}</p>
        </div>

        {/* Options */}
        <div style={{ display:"flex", flexDirection:"column", gap:"0.65rem", marginBottom:"1rem" }}>
          {opts.map((opt, idx) => {
            let bg="rgba(255,255,255,0.05)", border="rgba(255,255,255,0.1)", textColor="#fff", iconEl=null;
            if (selected !== null) {
              if (idx===q.correct)      { bg="rgba(16,185,129,0.15)"; border="#10b981"; textColor="#6ee7b7"; iconEl="✅"; }
              else if (idx===selected)  { bg="rgba(239,68,68,0.15)";  border="#ef4444"; textColor="#fca5a5"; iconEl="❌"; }
            }
            return (
              <div key={idx} onClick={() => handleAnswer(idx)} style={{ background:bg, border:`1.5px solid ${border}`, borderRadius:13, padding:"0.9rem 1.1rem", cursor:selected!==null?"default":"pointer", display:"flex", alignItems:"center", gap:"0.9rem", transition:"all 0.18s" }}>
                <div style={{ width:30, height:30, borderRadius:8, background:selected===null?"rgba(255,255,255,0.08)":border==="rgba(255,255,255,0.1)"?"rgba(255,255,255,0.08)":border, border:`1px solid ${border}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, color: border==="rgba(255,255,255,0.1)"?"rgba(255,255,255,0.5)":"#fff", flexShrink:0 }}>
                  {String.fromCharCode(65+idx)}
                </div>
                <span style={{ fontSize:15, color:textColor, flex:1, lineHeight:1.4 }}>{opt}</span>
                {iconEl && <span style={{ fontSize:18, flexShrink:0 }}>{iconEl}</span>}
              </div>
            );
          })}
        </div>

        {/* Explanation */}
        {showExp && (
          <div style={{ background:"rgba(59,130,246,0.12)", border:"1px solid rgba(59,130,246,0.35)", borderRadius:13, padding:"1rem 1.1rem", marginBottom:"1rem" }}>
            <div style={{ fontWeight:700, color:"#93c5fd", fontSize:12, marginBottom:6, letterSpacing:"0.5px" }}>💡 EXPLANATION</div>
            {isBoth && <p style={{ margin:"0 0 0.5rem", fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.6 }}>{q.explanation.en}</p>}
            <p style={{ margin:0, fontSize:14, color:"rgba(255,255,255,0.8)", lineHeight:1.65 }}>{isBoth ? q.explanation.ta : q.explanation[lang==="ta"?"ta":"en"]}</p>
          </div>
        )}

        {selected !== null && (
          <button onClick={() => doNext()} style={{ width:"100%", padding:"0.95rem", borderRadius:13, border:"none", background:`linear-gradient(135deg,${subInfo.color},${subInfo.color}cc)`, color:"#fff", fontWeight:700, fontSize:16, cursor:"pointer", fontFamily:"inherit" }}>
            {current+1 < qs.length ? "Next Question →" : "View Results →"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Result Screen ─────────────────────────────────────────────────────────────
function ResultScreen({ answers, lang, subject, onRetry, onHome }) {
  const subInfo = SUBJECTS.find(s => s.id === subject);
  const correct = answers.filter(a => a.selected===a.correct).length;
  const pct = Math.round((correct / answers.length) * 100);
  const [tab, setTab] = useState("summary");
  const grade = pct>=80?"🏆 Excellent!":pct>=60?"🎯 Good Job!":pct>=40?"📚 Keep Practicing":"💪 Don't Give Up!";
  const gradeColor = pct>=80?"#10b981":pct>=60?"#3b82f6":pct>=40?"#f59e0b":"#ef4444";

  return (
    <div style={{ minHeight:"100vh", background:"#0f0e1a", padding:"1.5rem", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ maxWidth:600, margin:"0 auto" }}>
        {/* Score hero */}
        <div style={{ background:`linear-gradient(135deg,${subInfo.color}33,${subInfo.color}11)`, border:`1.5px solid ${subInfo.color}55`, borderRadius:22, padding:"2rem", textAlign:"center", marginBottom:"1.2rem" }}>
          <div style={{ fontSize:52, marginBottom:"0.5rem" }}>{pct>=80?"🏆":pct>=60?"🎯":pct>=40?"📚":"💪"}</div>
          <div style={{ fontSize:20, fontWeight:700, color:gradeColor, marginBottom:6 }}>{grade}</div>
          <div style={{ fontSize:64, fontWeight:900, color:"#fff", lineHeight:1, letterSpacing:"-2px" }}>{pct}%</div>
          <div style={{ color:"rgba(255,255,255,0.45)", marginTop:8, fontSize:15 }}>{correct} out of {answers.length} correct</div>
          <div style={{ display:"flex", justifyContent:"center", gap:"2.5rem", marginTop:"1.5rem" }}>
            {[["✅","#10b981",correct,"Correct"],["❌","#ef4444",answers.length-correct,"Wrong"],["📊","#6366f1",answers.length,"Total"]].map(([icon,col,val,lab]) => (
              <div key={lab} style={{ textAlign:"center" }}>
                <div style={{ fontSize:26, fontWeight:800, color:col }}>{val}</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:2 }}>{lab}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", background:"rgba(255,255,255,0.06)", borderRadius:12, padding:4, marginBottom:"1.2rem" }}>
          {[["summary","📊 Summary"],["review","📋 Review"]].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:"0.6rem", borderRadius:9, border:"none", cursor:"pointer", fontWeight:700, fontSize:14, fontFamily:"inherit", background:tab===t?subInfo.color:"transparent", color:tab===t?"#fff":"rgba(255,255,255,0.45)", transition:"all 0.2s" }}>{l}</button>
          ))}
        </div>

        {tab==="summary" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem", marginBottom:"1.2rem" }}>
            {answers.map((a,i) => {
              const ok = a.selected===a.correct;
              const opts = lang==="ta" ? a.q.options.ta : a.q.options.en;
              return (
                <div key={i} style={{ background:`rgba(${ok?"16,185,129":"239,68,68"},0.08)`, border:`1.5px solid rgba(${ok?"16,185,129":"239,68,68"},0.25)`, borderRadius:13, padding:"0.9rem 1.1rem", display:"flex", alignItems:"flex-start", gap:"0.75rem" }}>
                  <span style={{ fontSize:18, flexShrink:0, marginTop:1 }}>{ok?"✅":"❌"}</span>
                  <div>
                    <p style={{ margin:"0 0 0.3rem", fontSize:14, color:"rgba(255,255,255,0.85)", fontWeight:500, lineHeight:1.5 }}>{lang==="ta" ? a.q.ta : a.q.en}</p>
                    {!ok && <div style={{ fontSize:12 }}>
                      <span style={{ color:"#fca5a5" }}>Your answer: {opts[a.selected] ?? "⏱ Timed out"}</span>
                      <span style={{ color:"rgba(255,255,255,0.3)", margin:"0 6px" }}>•</span>
                      <span style={{ color:"#6ee7b7" }}>Correct: {opts[a.correct]}</span>
                    </div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab==="review" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem", marginBottom:"1.2rem" }}>
            {answers.map((a,i) => {
              const opts = lang==="ta" ? a.q.options.ta : a.q.options.en;
              return (
                <div key={i} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:13, padding:"1rem 1.1rem" }}>
                  <p style={{ margin:"0 0 0.7rem", fontSize:14, color:"#fff", fontWeight:600, lineHeight:1.5 }}>{i+1}. {lang==="ta"?a.q.ta:a.q.en}</p>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {opts.map((opt,idx) => {
                      let col="rgba(255,255,255,0.3)", bg="transparent";
                      if (idx===a.correct) { col="#6ee7b7"; bg="rgba(16,185,129,0.1)"; }
                      else if (idx===a.selected && a.selected!==a.correct) { col="#fca5a5"; bg="rgba(239,68,68,0.1)"; }
                      return <div key={idx} style={{ fontSize:13, color:col, background:bg, padding:"4px 10px", borderRadius:6 }}>{String.fromCharCode(65+idx)}. {opt}</div>;
                    })}
                  </div>
                  <div style={{ marginTop:"0.6rem", fontSize:12, color:"rgba(255,255,255,0.4)", lineHeight:1.5, borderTop:"1px solid rgba(255,255,255,0.08)", paddingTop:"0.5rem" }}>
                    💡 {a.q.explanation[lang==="ta"?"ta":"en"]}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.9rem" }}>
          <button onClick={onRetry} style={{ padding:"0.9rem", borderRadius:13, border:`2px solid ${subInfo.color}`, background:"transparent", color:subInfo.color, fontWeight:700, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>🔄 Retry</button>
          <button onClick={onHome} style={{ padding:"0.9rem", borderRadius:13, border:"none", background:`linear-gradient(135deg,${subInfo.color},${subInfo.color}cc)`, color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>🏠 Home</button>
        </div>
      </div>
    </div>
  );
}

// ─── App Shell ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("auth");
  const [user, setUser]     = useState(null);
  const [lang, setLang]     = useState(null);
  const [subject, setSubject] = useState(null);
  const [answers, setAnswers] = useState([]);

  if (screen==="auth")     return <AuthScreen onAuth={u => { setUser(u); setScreen("language"); }} />;
  if (screen==="language") return <LanguageScreen onSelect={l => { setLang(l); setScreen("subjects"); }} />;

  if (screen==="subjects") return (
    <div style={{ minHeight:"100vh", background:"#0f0e1a" }}>
      <TopBar user={user} lang={lang} onHome={() => setScreen("subjects")} />
      <SubjectScreen lang={lang} onSelect={s => { setSubject(s); setScreen("quiz"); }} />
    </div>
  );

  if (screen==="quiz") return (
    <QuizScreen lang={lang} subject={subject}
      onFinish={a => { setAnswers(a); setScreen("result"); }}
      onBack={() => setScreen("subjects")} />
  );

  if (screen==="result") return (
    <ResultScreen answers={answers} lang={lang} subject={subject}
      onRetry={() => setScreen("quiz")}
      onHome={() => setScreen("subjects")} />
  );

  return null;
}
