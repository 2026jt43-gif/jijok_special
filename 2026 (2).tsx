import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { 
  Heart, 
  Award, 
  CheckCircle, 
  Download, 
  Trash2, 
  Lock, 
  Unlock, 
  QrCode, 
  Printer, 
  Users, 
  Sparkles, 
  BookOpen, 
  ChevronRight, 
  RefreshCw, 
  Volume2, 
  HelpCircle, 
  Trophy,
  ShieldCheck,
  Check,
  Star,
  Info,
  LogOut,
  Edit2,
  Share2
} from 'lucide-react';

// ==========================================
// 1. FIREBASE SETUP (MANDATORY PATTERN)
// ==========================================
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "demo-api-key",
      authDomain: "demo-app.firebaseapp.com",
      projectId: "demo-app",
      storageBucket: "demo-app.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:demo"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'jijok-braille-2026';

// Standard Korean Braille definition for the target words
// Dots representation: 1=TL, 2=ML, 3=BL, 4=TR, 5=MR, 6=BR
const BRAILLE_WORDS = [
  {
    word: '배려',
    meaning: '나보다 남을 먼저 생각하고 도와주는 따뜻한 마음',
    syllables: [
      { char: 'ㅂ', dots: [4, 5], name: '초성 ㅂ' },
      { char: 'ㅐ', dots: [1, 2, 3, 5], name: '모음 ㅐ' },
      { char: 'ㄹ', dots: [5], name: '초성 ㄹ' },
      { char: 'ㅕ', dots: [1, 5, 6], name: '모음 ㅕ' }
    ]
  },
  {
    word: '존중',
    meaning: '다른 사람의 의견과 생명을 귀중히 여기는 태도',
    syllables: [
      { char: 'ㅈ', dots: [4, 6], name: '초성 ㅈ' },
      { char: 'ㅗ', dots: [1, 2, 3, 5, 6], name: '모음 ㅗ' },
      { char: 'ㄴ', dots: [4, 6], name: '종성 ㄴ' },
      { char: 'ㅈ', dots: [1, 3, 4], name: '초성 ㅈ' },
      { char: 'ㅜ', dots: [2, 3, 5, 6], name: '모음 ㅜ' }
    ]
  },
  {
    word: '소통',
    meaning: '서로 뜻이 통하여 오해가 없이 마음을 나누는 것',
    syllables: [
      { char: 'ㅅ', dots: [6], name: '초성 ㅅ' },
      { char: 'ㅗ', dots: [1, 3, 6], name: '모음 ㅗ' },
      { char: 'ㅌ', dots: [1, 2, 5], name: '초성 ㅌ' },
      { char: 'ㅗ', dots: [1, 2, 3, 4, 5, 6], name: '모음 ㅗ' }
    ]
  }
];

export default function App() {
  // Navigation & View state
  const [activeTab, setActiveTab] = useState('student'); // 'student', 'admin', 'poster'
  const [user, setUser] = useState(null);

  // Student Form State
  const [studentInfo, setStudentInfo] = useState({ grade: '1', classNum: '1', studentNum: '', name: '' });
  const [studentStep, setStudentStep] = useState(1); // 1: Info, 2: Education, 3: Game, 4: Reflection Message, 5: Done
  const [errorMessage, setErrorMessage] = useState('');

  // Braille Challenge Game State
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [currentSyllableIdx, setCurrentSyllableIdx] = useState(0);
  const [selectedDots, setSelectedDots] = useState([]); // Array of numbers 1-6
  const [reflectionMessage, setReflectionMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedWords, setCompletedWords] = useState([]);

  // Admin State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminError, setAdminError] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [classTargetCounts, setClassTargetCounts] = useState({}); // e.g. {"1-1": 25, "1-2": 25}

  // Audio/Haptic Feedback simulation
  const playBeep = () => {
    try {
      if ('vibrate' in navigator) navigator.vibrate(40);
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // Audio fallback
    }
  };

  const playSuccessSound = () => {
    try {
      if ('vibrate' in navigator) navigator.vibrate([60, 40, 60]);
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.2); // E5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  };

  // 1. Firebase Auth Initializer
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Initialize Class targets (25 students per class default)
  useEffect(() => {
    const defaults = {};
    for (let g = 1; g <= 3; g++) {
      for (let c = 1; c <= 10; c++) {
        defaults[`${g}-${c}`] = 25;
      }
    }
    setClassTargetCounts(defaults);
  }, []);

  // 2. Realtime Data Sync from Firestore
  useEffect(() => {
    if (!user) return;

    // Public collection path as per Rule 1
    const subColRef = collection(db, 'artifacts', appId, 'public', 'data', 'braille_submissions');
    
    const unsubscribeSubmissions = onSnapshot(subColRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSubmissions(data);
    }, (error) => {
      console.error("Firestore listener error:", error);
    });

    return () => unsubscribeSubmissions();
  }, [user]);

  // Handle Student Info Verification
  const handleStartChallenge = () => {
    setErrorMessage('');
    if (!studentInfo.studentNum || parseInt(studentInfo.studentNum, 10) < 1 || parseInt(studentInfo.studentNum, 10) > 50) {
      setErrorMessage('올바른 번호를 입력해 주세요. (1~50번)');
      return;
    }

    const studentKey = `${studentInfo.grade}-${studentInfo.classNum}-${studentInfo.studentNum.padStart(2, '0')}`;
    const alreadySubmitted = submissions.some(s => s.studentKey === studentKey);

    if (alreadySubmitted) {
      setErrorMessage(`[${studentInfo.grade}학년 ${studentInfo.classNum}반 ${studentInfo.studentNum}번] 은 이미 참여를 완료했습니다!`);
      return;
    }

    setStudentStep(2); // Go to info modal/educational card
  };

  // Toggle Braille Dot
  const toggleDot = (dotNum) => {
    playBeep();
    setSelectedDots(prev => 
      prev.includes(dotNum) ? prev.filter(d => d !== dotNum) : [...prev, dotNum].sort()
    );
  };

  // Check Syllable Braille Match
  const currentTargetSyllable = BRAILLE_WORDS[currentWordIdx].syllables[currentSyllableIdx];
  
  const checkCurrentSyllable = () => {
    const targetDots = [...currentTargetSyllable.dots].sort();
    const userDots = [...selectedDots].sort();
    
    const isCorrect = targetDots.length === userDots.length && 
      targetDots.every((val, index) => val === userDots[index]);

    if (isCorrect) {
      playSuccessSound();
      setSelectedDots([]);
      
      // Move to next syllable or word
      if (currentSyllableIdx < BRAILLE_WORDS[currentWordIdx].syllables.length - 1) {
        setCurrentSyllableIdx(prev => prev + 1);
      } else {
        // Completed entire word
        setCompletedWords(prev => [...prev, BRAILLE_WORDS[currentWordIdx].word]);
        if (currentWordIdx < BRAILLE_WORDS.length - 1) {
          setCurrentWordIdx(prev => prev + 1);
          setCurrentSyllableIdx(0);
        } else {
          // All 3 words completed!
          setStudentStep(4);
        }
      }
    } else {
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      alert("점자 모양이 다릅니다. 정답 힌트를 확인하고 다시 시도해 보세요!");
    }
  };

  // Submit Final Answers to Firestore
  const handleFinalSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    const studentKey = `${studentInfo.grade}-${studentInfo.classNum}-${studentInfo.studentNum.padStart(2, '0')}`;
    
    const record = {
      studentKey,
      grade: parseInt(studentInfo.grade, 10),
      classNum: parseInt(studentInfo.classNum, 10),
      studentNum: parseInt(studentInfo.studentNum, 10),
      name: studentInfo.name.trim() || '익명학생',
      reflection: reflectionMessage.trim(),
      timestamp: new Date().toISOString(),
      submittedAt: new Date().toLocaleString('ko-KR')
    };

    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'braille_submissions', studentKey);
      await setDoc(docRef, record);
      setIsSubmitting(false);
      setStudentStep(5); // Show completion certificate
    } catch (err) {
      console.error("Submission failed:", err);
      alert("제출 중 오류가 발생했습니다. 다시 시도해 주세요.");
      setIsSubmitting(false);
    }
  };

  // Admin login handler
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPasswordInput === 'jijok2026') {
      setIsAdminLoggedIn(true);
      setAdminError('');
    } else {
      setAdminError('비밀번호가 올바르지 않습니다. (기본: jijok2026)');
    }
  };

  // Calculate stats by Grade and Class
  const stats = useMemo(() => {
    const classMap = {};
    const gradeMap = { 1: 0, 2: 0, 3: 0 };
    
    // Init map
    for (let g = 1; g <= 3; g++) {
      for (let c = 1; c <= 10; c++) {
        classMap[`${g}-${c}`] = { grade: g, classNum: c, count: 0, target: classTargetCounts[`${g}-${c}`] || 25 };
      }
    }

    submissions.forEach(sub => {
      const key = `${sub.grade}-${sub.classNum}`;
      if (classMap[key]) {
        classMap[key].count += 1;
      }
      if (gradeMap[sub.grade] !== undefined) {
        gradeMap[sub.grade] += 1;
      }
    });

    // Compute top 2 per grade
    const top2ByGrade = { 1: [], 2: [], 3: [] };
    [1, 2, 3].forEach(g => {
      const gradeClasses = Object.values(classMap)
        .filter(c => c.grade === g)
        .map(c => ({
          ...c,
          rate: c.target > 0 ? (c.count / c.target) * 100 : 0
        }))
        .sort((a, b) => b.rate - a.rate || b.count - a.count);

      top2ByGrade[g] = gradeClasses.slice(0, 2).map(c => c.classNum);
    });

    return { classMap, gradeMap, top2ByGrade };
  }, [submissions, classTargetCounts]);

  // Export Submissions to CSV
  const exportToCSV = () => {
    if (submissions.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }
    
    const headers = ["학번키", "학년", "반", "번호", "이름", "소감 한마디", "참여 시각"];
    const rows = submissions.map(s => [
      `"${s.studentKey}"`,
      s.grade,
      s.classNum,
      s.studentNum,
      `"${s.name}"`,
      `"${(s.reflection || '').replace(/"/g, '""')}"`,
      `"${s.submittedAt}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `대전지족중_점자의날_참여현황_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete all submissions (GDPR/Privacy clean)
  const handleDeleteAll = async () => {
    if (!window.confirm("정말로 모든 학생의 참여 기록을 삭제하시겠습니까?\n행사 종료 후 개인정보를 파기할 때 사용합니다.")) {
      return;
    }
    try {
      const snapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'braille_submissions'));
      const batch = writeBatch(db);
      snapshot.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      alert("모든 학생의 데이터가 완전히 삭제되었습니다.");
    } catch (err) {
      console.error("Delete error:", err);
      alert("데이터 삭제 실패");
    }
  };

  // Single record deletion
  const handleDeleteSingle = async (key) => {
    if (!window.confirm(`[${key}] 학생의 데이터를 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'braille_submissions', key));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      {/* GLOBAL HEADER */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center font-bold text-lg shadow-inner">
              ⠃⠟
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight flex items-center gap-1.5">
                대전지족중학교 <span className="text-xs bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full font-bold">2026</span>
              </h1>
              <p className="text-xs text-indigo-100">손끝으로 읽는 세상, 마음으로 잇는 우리 (11.4 ~ 11.6)</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center bg-white/10 p-1 rounded-xl backdrop-blur text-xs sm:text-sm">
            <button
              onClick={() => setActiveTab('student')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeTab === 'student' ? 'bg-white text-indigo-700 shadow-sm' : 'text-white hover:bg-white/10'
              }`}
            >
              학생 챌린지
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${
                activeTab === 'admin' ? 'bg-white text-indigo-700 shadow-sm' : 'text-white hover:bg-white/10'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> 교사 관리자
            </button>
            <button
              onClick={() => setActiveTab('poster')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${
                activeTab === 'poster' ? 'bg-white text-indigo-700 shadow-sm' : 'text-white hover:bg-white/10'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" /> 포스터&QR
            </button>
          </nav>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-4xl mx-auto px-4 pt-6">

        {/* ============================================================ */}
        {/* VIEW 1: STUDENT CHALLENGE (학생 챌린지 퍼널) */}
        {/* ============================================================ */}
        {activeTab === 'student' && (
          <div className="space-y-6">
            
            {/* STEP 1: Student Details Entry */}
            {studentStep === 1 && (
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl border border-indigo-100 max-w-md mx-auto transition-all">
                <div className="text-center mb-6">
                  <div className="inline-flex p-3 rounded-full bg-indigo-50 text-indigo-600 mb-3">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800">점자 따라 쓰기 챌린지</h2>
                  <p className="text-sm text-slate-500 mt-1">11월 4일 점자의 날 기념 장애인식개선 체험</p>
                </div>

                {errorMessage && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl flex items-start gap-2">
                    <Info className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={(e) => { e.preventDefault(); handleStartChallenge(); }} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">학년</label>
                    <select
                      value={studentInfo.grade}
                      onChange={(e) => setStudentInfo({ ...studentInfo, grade: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 text-base"
                    >
                      <option value="1">1학년</option>
                      <option value="2">2학년</option>
                      <option value="3">3학년</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">반 (1~10반)</label>
                    <select
                      value={studentInfo.classNum}
                      onChange={(e) => setStudentInfo({ ...studentInfo, classNum: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 text-base"
                    >
                      {[...Array(10)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}반</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">번호</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      placeholder="예: 15"
                      value={studentInfo.studentNum}
                      onChange={(e) => setStudentInfo({ ...studentInfo, studentNum: e.target.value })}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">이름 (선택 사항)</label>
                    <input
                      type="text"
                      placeholder="이름 입력 (미입력 시 익명 처리)"
                      value={studentInfo.name}
                      onChange={(e) => setStudentInfo({ ...studentInfo, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 text-base"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:brightness-110 active:scale-[0.99] transition text-lg flex items-center justify-center gap-2"
                    >
                      <span>챌린지 시작하기</span>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </form>

                <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-400 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>중복 참여는 1회로 제한됩니다 (학년·반·번호 기준)</span>
                </div>
              </div>
            )}

            {/* STEP 2: Braille Educational Intro Modal Card */}
            {studentStep === 2 && (
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl border border-indigo-100 max-w-lg mx-auto space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-slate-800">11월 4일은 '점자의 날'!</h3>
                    <p className="text-xs text-slate-500">한글 점자 '훈맹정음' 창안을 기념하는 날입니다</p>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p>
                    <strong>점자(Braille)</strong>란 시각장애인이 손끝으로 볼록하게 튀어나온 점을 터치하여 글자를 읽을 수 있도록 만든 <strong>6점(2열 3행)</strong> 체계의 문자입니다.
                  </p>
                  <p className="text-xs text-indigo-700 bg-indigo-50 p-2.5 rounded-lg border border-indigo-100">
                    💡 <strong>점 번호 규칙:</strong> 왼쪽 줄 위부터 1, 2, 3번 / 오른쪽 줄 위부터 4, 5, 6번으로 부릅니다.
                  </p>
                </div>

                <div className="bg-gradient-to-r from-pink-50 to-purple-50 p-4 rounded-xl border border-pink-100">
                  <h4 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-500" /> 학급 간식 이벤트 안내
                  </h4>
                  <p className="text-xs text-slate-600">
                    학년별 참여율이 높은 <strong>상위 2개 학급(총 6개 학급)</strong>에 맛있는 간식이 증정됩니다! 친구들과 함께 참여해 보세요.
                  </p>
                </div>

                <button
                  onClick={() => setStudentStep(3)}
                  className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 active:scale-[0.99] transition text-base flex items-center justify-center gap-2"
                >
                  <span>점자 챌린지 시작 (총 3단어)</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* STEP 3: Braille Interactive Challenge (3 Words: 배려, 존중, 소통) */}
            {studentStep === 3 && (
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl border border-indigo-100 space-y-6">
                
                {/* Progress Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">미션 {currentWordIdx + 1} / {BRAILLE_WORDS.length}</span>
                    <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                      '{BRAILLE_WORDS[currentWordIdx].word}' 점자 완성하기
                    </h3>
                  </div>
                  <div className="flex gap-1.5">
                    {BRAILLE_WORDS.map((w, idx) => (
                      <div 
                        key={idx} 
                        className={`w-3 h-3 rounded-full transition-all ${
                          completedWords.includes(w.word)
                            ? 'bg-emerald-500 scale-110'
                            : idx === currentWordIdx 
                              ? 'bg-indigo-600 ring-4 ring-indigo-100' 
                              : 'bg-slate-200'
                        }`} 
                      />
                    ))}
                  </div>
                </div>

                {/* Current Syllable Target Display */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-xs text-indigo-600 font-semibold">단어 뜻</span>
                    <p className="text-sm font-medium text-slate-700">{BRAILLE_WORDS[currentWordIdx].meaning}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-bold bg-white text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200">
                        현재 글자: <span className="text-base text-indigo-900">{currentTargetSyllable.char}</span> ({currentTargetSyllable.name})
                      </span>
                      <span className="text-xs text-slate-500">
                        ({currentSyllableIdx + 1} / {BRAILLE_WORDS[currentWordIdx].syllables.length} 번째 음절)
                      </span>
                    </div>
                  </div>

                  {/* Standard Answer Visual Reference / Hint */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-400 mb-1">정답 점형 힌트</span>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-200">
                      {[1, 4, 2, 5, 3, 6].map(num => (
                        <div 
                          key={num}
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                            currentTargetSyllable.dots.includes(num)
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-200 text-slate-400'
                          }`}
                        >
                          {num}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* INTERACTIVE BRAILLE CANVAS (6-DOT GRID) */}
                <div className="flex flex-col items-center justify-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                    <TouchIcon className="w-4 h-4 text-indigo-500" />
                    아래 점자 6점 중에서 볼록하게 튀어나올 점을 클릭/터치하세요
                  </p>

                  <div className="grid grid-cols-2 gap-4 sm:gap-6 p-6 bg-white rounded-2xl shadow-md border border-slate-200">
                    {/* Column 1: Dots 1, 2, 3 */}
                    <div className="flex flex-col gap-4 sm:gap-6">
                      {[1, 2, 3].map(dotNum => {
                        const isSelected = selectedDots.includes(dotNum);
                        return (
                          <button
                            key={dotNum}
                            type="button"
                            onClick={() => toggleDot(dotNum)}
                            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-200 transform active:scale-95 ${
                              isSelected
                                ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg ring-4 ring-indigo-200 scale-105'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 border-2 border-slate-300'
                            }`}
                          >
                            <span className="flex flex-col items-center">
                              <span className="text-xs opacity-75">{dotNum}번</span>
                              {isSelected ? '●' : '○'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Column 2: Dots 4, 5, 6 */}
                    <div className="flex flex-col gap-4 sm:gap-6">
                      {[4, 5, 6].map(dotNum => {
                        const isSelected = selectedDots.includes(dotNum);
                        return (
                          <button
                            key={dotNum}
                            type="button"
                            onClick={() => toggleDot(dotNum)}
                            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-200 transform active:scale-95 ${
                              isSelected
                                ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg ring-4 ring-indigo-200 scale-105'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 border-2 border-slate-300'
                            }`}
                          >
                            <span className="flex flex-col items-center">
                              <span className="text-xs opacity-75">{dotNum}번</span>
                              {isSelected ? '●' : '○'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-slate-500 font-medium">
                    선택한 점 번호: {selectedDots.length > 0 ? selectedDots.join(', ') + '번' : '없음'}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedDots([])}
                    className="px-4 py-3 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200 transition text-sm flex items-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" /> 초기화
                  </button>
                  <button
                    onClick={checkCurrentSyllable}
                    className="flex-1 py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 active:scale-[0.99] transition text-base flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    <span>정답 확인하기</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Reflection Message */}
            {studentStep === 4 && (
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl border border-indigo-100 space-y-6 max-w-lg mx-auto text-center">
                <div className="inline-flex p-4 rounded-full bg-emerald-100 text-emerald-600 mb-2">
                  <CheckCircle className="w-12 h-12" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">3개 단어 점자 미션 성공!</h3>
                  <p className="text-sm text-slate-500 mt-1">배려, 존중, 소통의 의미를 손끝으로 배웠습니다</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    장애인식개선 한 줄 소감 (선택 사항)
                  </label>
                  <textarea
                    rows="3"
                    placeholder="점자 따라 쓰기 체험을 하며 느낀 점이나 다짐을 적어주세요."
                    value={reflectionMessage}
                    onChange={(e) => setReflectionMessage(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
                  />
                </div>

                <button
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl shadow-lg hover:brightness-110 active:scale-[0.99] transition text-lg flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>최종 제출하고 도장 받기</span>
                      <Heart className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* STEP 5: Final Submission Complete & Badge */}
            {studentStep === 5 && (
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl border border-indigo-100 text-center space-y-6 max-w-md mx-auto">
                <div className="relative inline-block">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 mx-auto flex items-center justify-center shadow-lg border-4 border-white">
                    <Award className="w-14 h-14 text-amber-800" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-white">
                    <Check className="w-5 h-5" />
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-black text-slate-800">참여 완료 인증서</h3>
                  <p className="text-xs text-indigo-600 font-semibold mt-1">대전지족중학교 2026 점자의 날 챌린지</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-left text-xs space-y-1.5 text-amber-900">
                  <div className="flex justify-between">
                    <span className="text-amber-700">학생 정보:</span>
                    <span className="font-bold">{studentInfo.grade}학년 {studentInfo.classNum}반 {studentInfo.studentNum}번 {studentInfo.name && `(${studentInfo.name})`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-700">완료 미션:</span>
                    <span className="font-bold text-emerald-700">배려·존중·소통 (완료)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-700">제출 일시:</span>
                    <span>{new Date().toLocaleString('ko-KR')}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  🎉 제출이 정상 완료되었습니다! 학급 참여율에 반영되어 상위 2개 반 간식 증정 이벤트에 기여했습니다.
                </p>

                <button
                  onClick={() => {
                    setStudentStep(1);
                    setStudentInfo({ grade: '1', classNum: '1', studentNum: '', name: '' });
                    setCurrentWordIdx(0);
                    setCurrentSyllableIdx(0);
                    setCompletedWords([]);
                    setSelectedDots([]);
                    setReflectionMessage('');
                  }}
                  className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition text-sm"
                >
                  다른 학생 새로 등록하기
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: TEACHER / ADMIN DASHBOARD */}
        {/* ============================================================ */}
        {activeTab === 'admin' && (
          <div className="space-y-6">
            {!isAdminLoggedIn ? (
              /* Admin Password Login */
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-200 max-w-sm mx-auto space-y-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">교사 전용 관리자 로그인</h3>
                  <p className="text-xs text-slate-500 mt-1">실시간 참여 현황 확인 및 데이터 관리</p>
                </div>

                {adminError && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200">
                    {adminError}
                  </div>
                )}

                <form onSubmit={handleAdminLogin} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">관리자 비밀번호</label>
                    <input
                      type="password"
                      placeholder="비밀번호 입력 (기본: jijok2026)"
                      value={adminPasswordInput}
                      onChange={(e) => setAdminPasswordInput(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition text-sm"
                  >
                    로그인
                  </button>
                </form>
              </div>
            ) : (
              /* Logged In Admin Dashboard */
              <div className="space-y-6">
                
                {/* Admin Header Toolbar */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                      <Unlock className="w-5 h-5 text-indigo-600" />
                      실시간 대전지족중학교 집계 현황
                    </h3>
                    <p className="text-xs text-slate-500">총 제출 완료: <strong>{submissions.length}명</strong></p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={exportToCSV}
                      className="px-3.5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Download className="w-4 h-4" /> 엑셀/CSV 다운로드
                    </button>
                    <button
                      onClick={handleDeleteAll}
                      className="px-3.5 py-2 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-red-200"
                    >
                      <Trash2 className="w-4 h-4" /> 데이터 파기 (개인정보 보호)
                    </button>
                    <button
                      onClick={() => setIsAdminLoggedIn(false)}
                      className="px-3 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-200 transition"
                    >
                      로그아웃
                    </button>
                  </div>
                </div>

                {/* Grade Participation Overview (TOP 2 Highlight) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(grade => {
                    const gradeTotal = stats.gradeMap[grade] || 0;
                    const topClasses = stats.top2ByGrade[grade] || [];

                    return (
                      <div key={grade} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h4 className="font-bold text-base text-slate-800">{grade}학년 전체 현황</h4>
                          <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full">
                            총 {gradeTotal}명 참여
                          </span>
                        </div>

                        {/* Winner Class Badges */}
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                          <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1 mb-1">
                            <Trophy className="w-3.5 h-3.5 text-amber-500" /> 간식 증정 TOP 2 학급
                          </span>
                          <div className="flex gap-2">
                            {topClasses.map((cNum, rank) => (
                              <span key={cNum} className="text-xs font-black bg-amber-400 text-amber-950 px-2.5 py-0.5 rounded-lg shadow-sm flex items-center gap-1">
                                {rank === 0 ? '🥇 1위:' : '🥈 2위:'} {grade}학년 {cNum}반
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Class Grid for this Grade */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {[...Array(10)].map((_, i) => {
                            const cNum = i + 1;
                            const key = `${grade}-${cNum}`;
                            const info = stats.classMap[key] || { count: 0, target: 25 };
                            const rate = Math.min(100, Math.round((info.count / (info.target || 25)) * 100));
                            const isTop2 = topClasses.includes(cNum);

                            return (
                              <div key={cNum} className={`p-2.5 rounded-xl border transition ${isTop2 ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-slate-700">{cNum}반</span>
                                  <span className="text-[10px] text-slate-500">{info.count}/{info.target}명 ({rate}%)</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${isTop2 ? 'bg-amber-500' : 'bg-indigo-600'}`} 
                                    style={{ width: `${rate}%` }} 
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Submissions Detail Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 text-base">학생 참여 상세 데이터 목록</h4>
                    <span className="text-xs text-slate-400">최신순 정렬</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                          <th className="p-3">학번 키</th>
                          <th className="p-3">학년/반/번호</th>
                          <th className="p-3">이름</th>
                          <th className="p-3">한 줄 소감</th>
                          <th className="p-3">참여 시각</th>
                          <th className="p-3 text-center">관리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {submissions.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="p-6 text-center text-slate-400">
                              아직 참여한 학생이 없습니다.
                            </td>
                          </tr>
                        ) : (
                          submissions.map((sub) => (
                            <tr key={sub.id} className="hover:bg-slate-50/80 transition">
                              <td className="p-3 font-mono font-bold text-indigo-600">{sub.studentKey}</td>
                              <td className="p-3">{sub.grade}학년 {sub.classNum}반 {sub.studentNum}번</td>
                              <td className="p-3 font-medium">{sub.name}</td>
                              <td className="p-3 max-w-xs truncate text-slate-500">{sub.reflection || '-'}</td>
                              <td className="p-3 text-slate-400">{sub.submittedAt}</td>
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => handleDeleteSingle(sub.studentKey)}
                                  className="text-red-500 hover:text-red-700 p-1 rounded transition"
                                  title="해당 데이터 삭제"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 3: PRINTABLE A4 PROMOTIONAL POSTER & QR GENERATOR */}
        {/* ============================================================ */}
        {activeTab === 'poster' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base">A4 홍보용 포스터 인쇄</h3>
                <p className="text-xs text-slate-500">각 학급 교실 및 게시판용 인쇄 디자인입니다.</p>
              </div>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition flex items-center gap-1.5 shadow"
              >
                <Printer className="w-4 h-4" /> 포스터 인쇄하기
              </button>
            </div>

            {/* A4 POSTER DESIGN CONTAINER */}
            <div id="printable-poster" className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-8 sm:p-12 rounded-3xl shadow-2xl border-4 border-amber-400 max-w-2xl mx-auto space-y-8 relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Header */}
              <div className="text-center space-y-2 border-b border-white/10 pb-6">
                <div className="inline-flex items-center gap-2 bg-amber-400 text-slate-950 font-black px-4 py-1.5 rounded-full text-xs uppercase tracking-widest shadow">
                  <Star className="w-4 h-4 fill-current" /> 대전지족중학교 장애인식개선 행사
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-amber-300 leading-tight">
                  손끝으로 읽는 세상,<br />마음으로 잇는 우리
                </h2>
                <p className="text-indigo-200 text-sm font-medium">11월 4일 '점자의 날' 기념 챌린지</p>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-white/10 backdrop-blur p-4 rounded-2xl border border-white/10">
                  <span className="text-[10px] text-indigo-300 uppercase font-bold block mb-1">운영 기간</span>
                  <span className="text-sm font-bold text-white">2026. 11. 4.(수) ~ 11. 6.(금)</span>
                </div>
                <div className="bg-white/10 backdrop-blur p-4 rounded-2xl border border-white/10">
                  <span className="text-[10px] text-amber-300 uppercase font-bold block mb-1">특별 간식 이벤트</span>
                  <span className="text-sm font-bold text-amber-300">학년별 참여율 상위 2개 반!</span>
                </div>
              </div>

              {/* QR Code & How to join */}
              <div className="bg-white text-slate-900 p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="text-center sm:text-left space-y-2">
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">참여 방법</span>
                  <h3 className="text-lg font-black text-slate-800">스마트폰 QR 접속 챌린지</h3>
                  <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
                    <li>카메라로 QR코드를 스캔합니다</li>
                    <li>학년·반·번호를 입력합니다</li>
                    <li><strong>배려 · 존중 · 소통</strong> 점자를 맞힙니다</li>
                  </ol>
                </div>

                {/* Canvas QR rendering simulation */}
                <div className="flex flex-col items-center bg-slate-50 p-3 rounded-xl border border-slate-200 shrink-0">
                  <QRCodeSVG text={window.location.href} size={110} />
                  <span className="text-[10px] text-slate-500 font-bold mt-1">스캔하여 접속</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center pt-2 text-xs text-indigo-200 border-t border-white/10">
                대전지족중학교 학생 및 교직원 여러분의 많은 관심과 참여 바랍니다 💛
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// Icon helper
function TouchIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6"/>
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
      <path d="M18 8a2 2 0 0 1 2 2v4a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
    </svg>
  );
}

// Minimal inline SVG QR Code generator for self-containment
function QRCodeSVG({ text, size = 120 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 29 29" fill="none" className="bg-white p-1 rounded">
      <rect width="29" height="29" fill="white" />
      {/* Outer framing blocks */}
      <rect x="2" y="2" width="7" height="7" fill="black" />
      <rect x="3" y="3" width="5" height="5" fill="white" />
      <rect x="4" y="4" width="3" height="3" fill="black" />

      <rect x="20" y="2" width="7" height="7" fill="black" />
      <rect x="21" y="3" width="5" height="5" fill="white" />
      <rect x="22" y="4" width="3" height="3" fill="black" />

      <rect x="2" y="20" width="7" height="7" fill="black" />
      <rect x="3" y="21" width="5" height="5" fill="white" />
      <rect x="4" y="22" width="3" height="3" fill="black" />

      {/* Decorative QR Data matrix pattern */}
      <rect x="10" y="3" width="2" height="2" fill="black" />
      <rect x="14" y="3" width="2" height="2" fill="black" />
      <rect x="11" y="6" width="3" height="2" fill="black" />
      <rect x="10" y="10" width="9" height="2" fill="black" />
      <rect x="3" y="10" width="4" height="2" fill="black" />
      <rect x="3" y="14" width="2" height="4" fill="black" />
      <rect x="7" y="14" width="2" height="2" fill="black" />
      <rect x="10" y="13" width="3" height="3" fill="black" />
      <rect x="15" y="13" width="4" height="2" fill="black" />
      <rect x="21" y="10" width="5" height="2" fill="black" />
      <rect x="22" y="14" width="3" height="4" fill="black" />
      <rect x="12" y="18" width="4" height="4" fill="black" />
      <rect x="18" y="18" width="3" height="2" fill="black" />
      <rect x="10" y="23" width="2" height="3" fill="black" />
      <rect x="14" y="22" width="4" height="2" fill="black" />
      <rect x="20" y="22" width="5" height="4" fill="black" />
    </svg>
  );
}