import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppData, StudentSubmission, Assignment } from '../types';
import { addPendingRequest, createContestRequest, createSubmission, uploadViolationScreenshot, logViolation } from '../services/supabase';
import { generateFollowUpQuestions } from '../services/geminiService';
import * as mammoth from 'mammoth';
//checking if browser api exist

const AnimatedBg: React.FC = () => {
  const orbs = [
    { w:520, h:520, bg:'#bae6fd', top:'-8%',  left:'-6%',  dur:'18s', delay:'0s'   },
    { w:380, h:380, bg:'#a7f3d0', top:'50%',  right:'-5%', dur:'22s', delay:'-7s'  },
    { w:300, h:300, bg:'#67e8f9', bottom:'-7%',left:'38%', dur:'16s', delay:'-4s'  },
    { w:240, h:240, bg:'#6ee7b7', top:'18%',  left:'58%',  dur:'24s', delay:'-11s' },
    { w:200, h:200, bg:'#bae6fd', top:'70%',  left:'20%',  dur:'20s', delay:'-8s'  },
  ];
  const dots = [
    { s:8,  top:'10%', left:'18%', c:'#0284c7', dur:'3.2s', dl:'0s'    },
    { s:6,  top:'72%', left:'13%', c:'#059669', dur:'4.1s', dl:'-1.2s' },
    { s:10, top:'28%', left:'82%', c:'#0ea5e9', dur:'2.8s', dl:'-0.6s' },
    { s:5,  top:'82%', left:'72%', c:'#10b981', dur:'3.6s', dl:'-2.1s' },
    { s:7,  top:'54%', left:'44%', c:'#0369a1', dur:'4.4s', dl:'-1.8s' },
    { s:9,  top:'16%', left:'62%', c:'#34d399', dur:'3.0s', dl:'-0.9s' },
    { s:5,  top:'90%', left:'32%', c:'#0284c7', dur:'5.0s', dl:'-3.0s' },
    { s:6,  top:'40%', left:'94%', c:'#059669', dur:'3.8s', dl:'-2.5s' },
  ];
  const rings = [
    { s:70,  top:'6%',  left:'74%', c:'rgba(2,132,199,0.2)',  dur:'12s' },
    { s:50,  top:'77%', left:'6%',  c:'rgba(5,150,105,0.2)',  dur:'18s' },
    { s:90,  top:'58%', left:'57%', c:'rgba(14,165,233,0.15)',dur:'20s' },
  ];
  const squares = [
    { s:14, top:'20%', left:'4%',  c:'rgba(2,132,199,0.18)',  dur:'6s',   dl:'0s'  },
    { s:10, top:'66%', left:'90%', c:'rgba(5,150,105,0.18)',  dur:'7.5s', dl:'-2s' },
    { s:18, top:'44%', left:'2%',  c:'rgba(14,165,233,0.13)', dur:'8s',   dl:'-4s' },
    { s:8,  top:'8%',  left:'50%', c:'rgba(16,185,129,0.18)', dur:'5.5s', dl:'-1s' },
  ];
  return (
    <div style={{
      position:'fixed', inset:0, overflow:'hidden', zIndex:0, pointerEvents:'none',
      background:'linear-gradient(135deg,#e0f2fe 0%,#ecfdf5 45%,#f0fdf4 70%,#e0f2fe 100%)',
    }}>
      {orbs.map((o,i) => (
        <div key={i} style={{
          position:'absolute', borderRadius:'50%', filter:'blur(60px)', opacity:0.45,
          width:o.w, height:o.h, background:o.bg,
          top:(o as any).top, left:(o as any).left,
          right:(o as any).right, bottom:(o as any).bottom,
          animation:`vpFloat ${o.dur} linear infinite`, animationDelay:o.delay,
        }}/>
      ))}
      {dots.map((d,i) => (
        <div key={i} style={{
          position:'absolute', borderRadius:'50%',
          width:d.s, height:d.s, top:d.top, left:d.left, background:d.c,
          animation:`vpPulse ${d.dur} ease-in-out infinite`, animationDelay:d.dl,
        }}/>
      ))}
      {rings.map((r,i) => (
        <div key={i} style={{
          position:'absolute', borderRadius:'50%', border:`1.5px solid ${r.c}`,
          width:r.s, height:r.s, top:r.top, left:r.left,
          animation:`vpSpin ${r.dur} linear infinite`,
        }}/>
      ))}
      {squares.map((s,i) => (
        <div key={i} style={{
          position:'absolute', borderRadius:3, background:s.c,
          width:s.s, height:s.s, top:s.top, left:s.left,
          animation:`vpDrift ${s.dur} ease-in-out infinite`, animationDelay:s.dl,
        }}/>
      ))}
    </div>
  );
};

const studentBgStyles = `
  @keyframes vpFloat { 0%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-40px) scale(1.08)} 66%{transform:translate(-20px,20px) scale(0.94)} 100%{transform:translate(0,0) scale(1)} }
  @keyframes vpPulse { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.7);opacity:0.12} }
  @keyframes vpSpin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes vpDrift { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-18px) rotate(22deg)} }
  @keyframes timerPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.04)} }
  @keyframes timerPopupIn { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.88)} 100%{opacity:1;transform:translate(-50%,-50%) scale(1)} }
`;

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}
//app.tsx should gives these values to student dashboard upload loading 
interface StudentDashboardProps {
  userName: string;
  userId: string;
  userEmail: string;
  appData: AppData; //all classes and assignment data
  setAppData: React.Dispatch<React.SetStateAction<AppData>>; //setstae func that accept app data
  onExamStateChange?: (isActive: boolean) => void; // notify parent when exam starts/ends
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ userName, userId, userEmail, appData, setAppData, onExamStateChange }) => {
//which assign the student is currently doing , when student clicks an assignment that is set to assignment object otherwise not in exam
  const [activeAsgn, setActiveAsgn] = useState<Assignment | null>(null);
//student answers [] starts empty
  const [answers, setAnswers] = useState<string[]>([]);
  // per-question edit flags: 'none' | 'edited' | 'replaced'
  // 'edited'   = student tweaked a few words after voice transcription
  // 'replaced' = student wiped the whole transcribed answer and typed fresh
  const [answerEditFlags, setAnswerEditFlags] = useState<string[]>([]);
  // snapshot of answers at the moment student switches from voice → text mode
  // used to detect post-transcription edits
  const voiceSnapshotRef = useRef<string[]>([]);

  // review popup before final submit
  const [showReviewModal, setShowReviewModal] = useState(false);

//total count of all the violations: tab switches and camera violation 
  const [violations, setViolations] = useState(0);
//to track separate violations
  const [tabViolations, setTabViolations] = useState(0);

  // ── Mode selection ── what the student choose to give viva in──────────────────────────────────────────────────────
  const [selectedMode, setSelectedMode] = useState<'text' | 'voice' | null>(null);
  const [showModeSelect, setShowModeSelect] = useState(false);

  // ── Video proctoring state ────────────────────────────────────────────────
  //checks if the camera is on if true start the camera and proctoring loop
  const [videoMode, setVideoMode] = useState(false);

  //check if consent is given by the student
  const [consentGiven, setConsentGiven] = useState(false);

  //separate video violations
  const [videoViolations, setVideoViolations] = useState<string[]>([]);
//how many seconds the student has been looking away 
  const [lookAwaySeconds, setLookAwaySeconds] = useState(0);
  //show violation banner
  const [showViolationBanner, setShowViolationBanner] = useState<string | null>(null);
  //useref used here since these are the things that change but dont trigger reload
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const proctoringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lookAwayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lookAwayCountRef = useRef(0);
  // Debounce: track consecutive bad frames before logging a violation
  //e.g {phone:3} phone has been detected 3 frames in a row
  const consecutiveBadFramesRef = useRef<Record<string, number>>({});

  //to avoid spam of violations it stores when each violation type was last logged 
  const violationCooldownRef = useRef<Record<string, number>>({});

  // Stable submission ID created when the exam starts — reused for screenshot uploads and final submission
  const submissionIdRef = useRef<string>(`sub-${Date.now()}`);
  // Ref so captureAndAnalyze always sees the current assignment (avoids stale closure)
  const activeAsgnRef = useRef<Assignment | null>(null);

  
  const [activeTab, setActiveTab] = useState<'assessments' | 'classes' | 'contest'>('assessments');

  //contest grade state
  const [contestClassId, setContestClassId] = useState<string>('');
  const [contestAsgnId, setContestAsgnId] = useState<string>('');
  const [contestReason, setContestReason] = useState<string>('');
  const [contestSubmitting, setContestSubmitting] = useState(false);
  const [contestSuccess, setContestSuccess] = useState('');
  //when student joins a class 
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinCodeError, setJoinCodeError] = useState('');
  const [joinCodeSuccess, setJoinCodeSuccess] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  //new testing
  const [examStarted, setExamStarted] = useState(false);

  // ── Exam countdown timer ──────────────────────────────────────────────────
  // timeLimitSecs: null = no limit. Starts counting down from timeLimitMinutes*60 when exam begins.
  const [examSecondsLeft, setExamSecondsLeft] = useState<number | null>(null);
  const examTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [examTimeExpired, setExamTimeExpired] = useState(false);
  // Popup warnings at 5 min and 1 min — shown once each
  const [timerPopup, setTimerPopup] = useState<'5min' | '1min' | null>(null);
  const warned5MinRef = useRef(false);
  const warned1MinRef = useRef(false);

  // ── Follow-up questions phase ─────────────────────────────────────────────
  // Flow: 'upload' → student uploads doc before mode select
  //       'generating' → Gemini running in background (shown as loading screen before Round 1)
  //       'round1' → normal exam (existing flow), follow-ups generating in bg
  //       'round2' → follow-up Q&A
  const [examPhase, setExamPhase] = useState<'upload' | 'generating' | 'round1' | 'transitioning' | 'round2'>('upload');
  const [assignmentText, setAssignmentText] = useState('');
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<string[]>([]);
  const followUpReadyRef = useRef(false);
  const [followUpReady, setFollowUpReady] = useState(false);
  const [followUpError, setFollowUpError] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const assignmentFileInputRef = useRef<HTMLInputElement>(null);

//loop through every class and keep only where the students id match 
  const myClasses = appData.classes.filter(c => c.members.some(m => m.userId === userId));
  //same for where student has applied but the teacher hasnt approved the request
  const myPendingClasses = appData.classes.filter(c => c.pendingRequests.some(r => r.userId === userId));
  const myClassIds = myClasses.map(c => c.id);

  const myAssignments = appData.assignments.filter(
    a => a.status === 'Published' && myClassIds.includes(a.classId)
  );

  //student enters the code to join the class 
  const handleJoinByCode = async () => {
    const code = joinCodeInput.trim().toUpperCase();
    //wipe old tries/message before trying again to join
    setJoinCodeError('');
    setJoinCodeSuccess('');
    if (!code) return;
    //find the class whose code is it, if none found show error
    const cls = appData.classes.find(c => c.joinCode === code);
    if (!cls) { setJoinCodeError('Invalid join code. Please check and try again.'); return; }
    if (cls.members.some(m => m.userId === userId)) { setJoinCodeError('You are already a member of this class.'); return; }
    if (cls.pendingRequests.some(r => r.userId === userId)) { setJoinCodeError('Your request is already pending approval.'); return; }

  //the request goes to supabase table
    try {
      await addPendingRequest({
        class_id: cls.id,
        user_id: userId,
        name: userName,
        email: userEmail,
        requested_at: Date.now(),
        method: 'code',
      });
    } catch (err) {
      console.error('Failed to save join request:', err);
      setJoinCodeError('Failed to send request. Please try again.');
      return;
    }

//if data was written in supabase successfully update the local state so student doesnt need to refresh, it sees the pending status without refreshing
    setAppData(prev => ({
      ...prev,
      classes: prev.classes.map(c =>
        c.id !== cls.id ? c : {
          ...c,
          pendingRequests: [...c.pendingRequests, {
            userId, name: userName, email: userEmail,
            requestedAt: Date.now(), method: 'code' as const,
          }],
        }
      ),
    }));
    setJoinCodeSuccess(`Request sent to join "${cls.name}". Waiting for teacher approval.`);
    setJoinCodeInput('');
  };

  // ── Step 1: student uploads assignment, then we fire Gemini in background ─
  const handleAssignmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeAsgn) return;
    setUploadingDoc(true);
    setFollowUpError('');
    try {
      let text = '';
      if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        text = await file.text();
      }
      if (!text.trim()) {
        setFollowUpError('Could not extract text. Try a .txt or .docx file.');
        setUploadingDoc(false);
        return;
      }
      setAssignmentText(text);
      setUploadingDoc(false);
      // Move to generating screen — show loading animation
      setExamPhase('generating');
      // Fire Gemini — we pass empty studentAnswers since Round 1 hasn't happened yet.
      // Gemini will generate questions purely from the assignment content at this point.
      generateFollowUpQuestions(text, activeAsgn.questions.map(q => ({
        question: q.question,
        modelAnswer: q.modelAnswer || '',
        studentAnswer: '',   // not yet answered — Gemini probes the assignment itself
      }))).then(questions => {
        setFollowUpQuestions(questions);
        setFollowUpAnswers(new Array(questions.length).fill(''));
        followUpReadyRef.current = true;
        setFollowUpReady(true);
      }).catch(err => {
        console.error('Follow-up generation failed:', err);
        setFollowUpError('AI could not generate follow-up questions. You can still proceed.');
        followUpReadyRef.current = true;
        setFollowUpReady(true); // let them continue even if it fails
      });
    } catch (err: any) {
      console.error('File read failed:', err);
      setFollowUpError(err.message || 'Failed to read file. Please try again.');
      setUploadingDoc(false);
    }
  };

//*******VOICE CALL MODE  */

//is voice-call Ui showing
  const [voiceMode, setVoiceMode] = useState(false);
//which ques the student is on 
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
//what text the AI just spoke 
  const [aiCaption, setAiCaption] = useState('');
//what student replied
  const [studentCaption, setStudentCaption] = useState('');
//shows how much time student spent to give the exam
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

//which question no. the mic is recording for
  const [listeningIdx, setListeningIdx] = useState<number | null>(null);

//if whisper fails use browser stt
  const recognitionRef = useRef<any>(null);
  //track which ques,final student answer
  const dictationRef = useRef<{ index: number; base: string; final: string } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
//when true it means waiting for whisper to respond
  const [isTranscribing, setIsTranscribing] = useState(false);

  // tracks the timestamp (ms) when student left each question's textarea
  const blurTimeRef = useRef<Record<number, number>>({});
  // once 'replaced' is locked in for a question, don't downgrade it back to 'edited'
  const replacedLockedRef = useRef<Record<number, boolean>>({});

//find a browser to run these otherwise undefined
  const SpeechRecognitionCtor = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, []);

  const speechSupported = true;

  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);

  //checks if the browser supports text to speech 
  const ttsSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }, []);

//watch voice mode set duration to 0 and when voice mode stops reset timer
  useEffect(() => {
    if (voiceMode) {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [voiceMode]);

//show correct time seconds to minutes
  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // Format remaining seconds as "MM:SS" for the countdown bar
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  //stop browser from speaking to cutof ongoing speech since now student will give their answer
  const stopTTS = () => {
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {}
    setSpeakingIdx(null);
  };

  //after the student gives the answer click the same button to stop the mic 
  const speakQuestion = (i: number) => {
    if (!ttsSupported) {
      alert("Text-to-speech isn't supported in this browser.");
      return;
    }
    const text = (examPhase === 'round2'
      ? (followUpQuestions[i] || '')
      : (activeAsgn?.questions?.[i]?.question || '')
    ).trim();
    if (!text) return;
    if (speakingIdx === i) { stopTTS(); return; }
    stopTTS();
    try {
      //when AI finises talking wait 500ms then auto start recording
      const utter = new (window as any).SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = 1;
      utter.pitch = 1;
      utter.onend = () => {
        setSpeakingIdx(null);
      };
      utter.onerror = () => setSpeakingIdx(null);
      setAiCaption(text);
      setSpeakingIdx(i);
      window.speechSynthesis.speak(utter);
    } catch { stopTTS(); }
  };

  //stop anything from running first then request microphone permission
  const stopDictation = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {}
    try {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      }
    } catch {}
    recognitionRef.current = null;
    dictationRef.current = null;
    setListeningIdx(null);
  };

  const startDictation = async (i: number) => {
    stopDictation();
    stopTTS();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
//when rec stops release microphone 
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setListeningIdx(null);

        if (audioChunksRef.current.length === 0) return;

//************************WHISPER WORK************************************ */
//combine all chunks into one complete audio file. flask reads the uploaded files over HTTP 
//and sends them to whisper which returns text
        setIsTranscribing(true);
        try {

          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          const response = await fetch('http://localhost:5000/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) throw new Error('Whisper server error: ' + response.status);

          const data = await response.json();
          const transcript = (data.text || '').trim();

  //******APPENDING ANSWERS****** */
  //append the transcript along with the students typed answer since user can go back to text mode
          if (transcript) {
            const setA = examPhase === 'round2' ? setFollowUpAnswers : setAnswers;
            setA(prev => {
              const next = [...prev];
              const existing = (next[i] || '').trim();
              next[i] = existing ? `${existing} ${transcript}` : transcript;
              return next;
            });
            setStudentCaption(transcript);
          }
  //if whisper fails fall back to browser speech recognistion
        } catch (err) {
          // Hide whisper error from users, log it directly instead.
          console.error('Whisper transcription failed, falling back to browser STT:', err);

          if (SpeechRecognitionCtor) {
            const rec = new SpeechRecognitionCtor();
            recognitionRef.current = rec;
            rec.lang = 'en-US';
            rec.continuous = true;
            rec.interimResults = true; //show words appearing in real time when student speaks
            const baseText = (examPhase === 'round2' ? (followUpAnswers[i] || '') : (answers[i] || '')).trim();
            dictationRef.current = { index: i, base: baseText, final: '' };
            setListeningIdx(i);
            rec.onresult = (event: any) => {
              if (!dictationRef.current) return;
              let interim = '';
              let finalChunk = '';
              for (let j = event.resultIndex; j < event.results.length; j++) {
                const t = (event.results[j][0]?.transcript || '').trim();
                if (event.results[j].isFinal) finalChunk += ' ' + t;
                else interim += ' ' + t;
              }
              if (finalChunk) dictationRef.current.final = (dictationRef.current.final + finalChunk).trim();
              const combined = `${dictationRef.current.base} ${dictationRef.current.final} ${interim}`.replace(/\s+/g, ' ').trim();
              const setA2 = examPhase === 'round2' ? setFollowUpAnswers : setAnswers;
              setA2(prev => { const next = [...prev]; next[i] = combined; setStudentCaption(combined); return next; });
            };
            rec.onend = () => {
              if (dictationRef.current) {
                const finalText = `${dictationRef.current.base} ${dictationRef.current.final}`.replace(/\s+/g, ' ').trim();
                const setA3 = examPhase === 'round2' ? setFollowUpAnswers : setAnswers;
                setA3(prev => { const next = [...prev]; next[i] = finalText; return next; });
              }
              recognitionRef.current = null;
              dictationRef.current = null;
              setListeningIdx(null);
            };
            rec.onerror = () => stopDictation();
            try { rec.start(); } catch { stopDictation(); }
          }
        } finally {
          setIsTranscribing(false);
          audioChunksRef.current = [];
        }
      };

      mediaRecorder.start(250);
      setListeningIdx(i);
//if permission was denied show message
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        alert('Microphone permission denied. Please allow mic access and try again.');
      } else {
        console.error('Mic error:', err);
      }
    }
  };

  //exam ended, stop any ongoing recording
  useEffect(() => {
    if (!activeAsgn) { stopDictation(); stopTTS(); }
  }, [activeAsgn]);

  //ONLY activate these things when exam is started
  useEffect(() => {
  if (!activeAsgn || !examStarted) return;
  const block = (e: Event) => { e.preventDefault(); };
  document.addEventListener('copy', block, true);
  document.addEventListener('cut', block, true);
  document.addEventListener('paste', block, true);
  document.addEventListener('contextmenu', block, true);
  document.addEventListener('dragstart', block, true);
  document.addEventListener('drop', block, true);
  return () => {
    document.removeEventListener('copy', block, true);
    document.removeEventListener('cut', block, true);
    document.removeEventListener('paste', block, true);
    document.removeEventListener('contextmenu', block, true);
    document.removeEventListener('dragstart', block, true);
    document.removeEventListener('drop', block, true);
  };
}, [activeAsgn, examStarted]);

  useEffect(() => { return () => { stopDictation(); stopTTS(); }; }, []);
  // Keep activeAsgnRef in sync so captureAndAnalyze never reads stale state
  useEffect(() => { activeAsgnRef.current = activeAsgn; }, [activeAsgn]);


  //TESTING *****
  //****************VIOLATION RECORDING*************************** */
  useEffect(() => {
  if (!activeAsgn || !examStarted) return;

  const handleVisibilityChange = () => {
    if (document.hidden) {
      setViolations(v => v + 1);
      setTabViolations(v => v + 1);

      //adding change -fs
      logViolation({
      user_id: userId,
      assignment_id: activeAsgn.id,
      submission_id: submissionIdRef.current,
      type: 'tab_switch',
      mode: selectedMode ?? 'text',
    }).catch(err => console.error('logViolation failed:', err));
    setShowViolationBanner('Tab switching is strictly prohibited. This has been logged.');
    setTimeout(() => setShowViolationBanner(null), 3000);
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [activeAsgn, examStarted]);

  // ── Split screen / window resize / PiP detection ─────────────────────────
  // Same violation pattern as tab switching above
  useEffect(() => {
    if (!activeAsgn || !examStarted) return;

    const fullWidth  = window.screen.width;
    const fullHeight = window.screen.height;
    const WIDTH_THRESHOLD  = 0.80; // flag if window < 80% of screen width
    const HEIGHT_THRESHOLD = 0.80; // flag if window < 80% of screen height
    const COOLDOWN_MS = 5000;      // max one violation per 5 seconds

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let lastFlagged = 0;

    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const widthRatio  = window.innerWidth  / fullWidth;
        const heightRatio = window.innerHeight / fullHeight;
        const now = Date.now();
        if ((widthRatio < WIDTH_THRESHOLD || heightRatio < HEIGHT_THRESHOLD) && now - lastFlagged > COOLDOWN_MS) {
          lastFlagged = now;
          setViolations(v => v + 1);
          setTabViolations(v => v + 1);
          //adding here -fs
          logViolation({
            user_id: userId,
            assignment_id: activeAsgn.id,
            submission_id: submissionIdRef.current,
            type: 'split_screen',
            mode: selectedMode ?? 'text',
          }).catch(err => console.error('logViolation failed:', err));
          setShowViolationBanner('Split screen detected. Please return to full screen.');
          setTimeout(() => setShowViolationBanner(null), 3000);
        }
      }, 300);
    };

    const handleEnterPiP = () => {
      const now = Date.now();
      if (now - lastFlagged > COOLDOWN_MS) {
        lastFlagged = now;
        setViolations(v => v + 1);
        setTabViolations(v => v + 1);
        logViolation({
          user_id: userId,
          assignment_id: activeAsgn.id,
          submission_id: submissionIdRef.current,
          type: 'picture_in_picture',
          mode: selectedMode ?? 'text',
        }).catch(err => console.error('logViolation failed:', err));
        setShowViolationBanner('Picture-in-picture detected. This is not allowed during the exam.');
        setTimeout(() => setShowViolationBanner(null), 3000);
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('enterpictureinpicture', handleEnterPiP);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('enterpictureinpicture', handleEnterPiP);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [activeAsgn, examStarted]);

//TESTING END -fs


  // ── Video proctoring functions ─────────────────────────────────────────────

  const startVideoProctoring = async () => {
    //request camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoStreamRef.current = stream;
      if (videoRef.current) {
        //connect to students live camera feed so the student can see themseveles 
        videoRef.current.srcObject = stream;
      }
      // Send frame every 600ms — fast enough for near-instant phone & gaze detection
      proctoringIntervalRef.current = setInterval(() => {
        captureAndAnalyze();
      }, 600);
    } catch (err) {
      console.error('Camera access denied:', err);
      alert('Camera permission is required for proctoring. Please allow camera access and try again.');
    }
  };

  //stop the camera and reset all counters
  const stopVideoProctoring = () => {
    if (proctoringIntervalRef.current) {
      clearInterval(proctoringIntervalRef.current);
      proctoringIntervalRef.current = null;
    }
    if (lookAwayTimerRef.current) {
      clearInterval(lookAwayTimerRef.current);
      lookAwayTimerRef.current = null;
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
    }
    lookAwayCountRef.current = 0;
    consecutiveBadFramesRef.current = {};
    violationCooldownRef.current = {};
    setLookAwaySeconds(0);
  };

  // Camera proctoring is now always active in both text and voice modes.
  // We start/stop the camera via this effect whenever the exam is active.
  useEffect(() => {
    if (videoMode) {
      startVideoProctoring();
    } else {
      stopVideoProctoring();
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [videoMode]);

  // When the student switches between voice ↔ text mode the whole UI block swaps,
  // mounting a brand-new <video> element whose srcObject is empty.
  // Re-attach the live stream to whatever video element is now in the DOM.
  useEffect(() => {
    if (videoStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = videoStreamRef.current;
    }
  }, [voiceMode]);

  //******START EXAM PROTOCOLS */
  const startExam = () => {
    submissionIdRef.current = `sub-${Date.now()}`; // fresh ID for this exam session
    setExamStarted(true);
    onExamStateChange?.(true);
    setCurrentQuestionIdx(0);
    setAiCaption('');
    setStudentCaption('');
    setExamTimeExpired(false);
    warned5MinRef.current = false;
    warned1MinRef.current = false;
    setTimerPopup(null);
    // Start countdown if assignment has a time limit
    const limitMins = (activeAsgn as any)?.timeLimitMinutes;
    if (limitMins && limitMins > 0) {
      const totalSecs = limitMins * 60;
      setExamSecondsLeft(totalSecs);
      if (examTimerRef.current) clearInterval(examTimerRef.current);
      examTimerRef.current = setInterval(() => {
        setExamSecondsLeft(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(examTimerRef.current!);
            examTimerRef.current = null;
            setExamTimeExpired(true);
            return 0;
          }
          const next = prev - 1;
          // Fire 5-min warning (at exactly 300s remaining)
          if (next === 300 && !warned5MinRef.current) {
            warned5MinRef.current = true;
            setTimerPopup('5min');
          }
          // Fire 1-min warning (at exactly 60s remaining)
          if (next === 60 && !warned1MinRef.current) {
            warned1MinRef.current = true;
            setTimerPopup('1min');
          }
          return next;
        });
      }, 1000);
    } else {
      setExamSecondsLeft(null);
    }
    if (selectedMode === 'voice') {
      setVoiceMode(true);
    } else {
      // text mode
      setVoiceMode(false);
    }
    // Camera proctoring always starts for both text and voice modes
    setVideoMode(true); // triggers the useEffect → startVideoProctoring()
  };

  //*************************SENDING SNAPSHOTS TO FLASK******************************************8 */
  //check is video has started 
  const captureAndAnalyze = async () => {
    if (!videoRef.current || !videoCanvasRef.current) return;
    const canvas = videoCanvasRef.current;
    const video = videoRef.current;
    if (video.videoWidth === 0) return;
    //resize the screen to match the video and draw current video frame on the UI 
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    //take a snapshot and convert to base64 JPEG at 60% quality so its a small file sending
    //this is then read by OPENCV,mediapipe,yolo
    const imageData = canvas.toDataURL('image/jpeg', 0.6);

//send these to flask
    try {
      const res = await fetch('http://localhost:5000/analyze_frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData, student_id: userId }),
      });
      if (!res.ok) return;
      const result = await res.json();

      const { warnings = [], gaze = 'center' } = result;

// Update look-away indicator in the UI
if (gaze === 'center' || gaze === 'unknown') {
  setLookAwaySeconds(0);
} else {
  setLookAwaySeconds(prev => prev + 0.6);
}

// Server has already decided — just log whatever it sends
if (warnings.length > 0) {
  setViolations(v => v + 1);
  setVideoViolations(prev => [...prev, warnings[0]]);
  setShowViolationBanner(warnings[0]);
  setTimeout(() => setShowViolationBanner(null), 3000);

  // Upload screenshot + log to violation_logs — both fire-and-forget, won't block the exam
  const asgn = activeAsgnRef.current;
  if (asgn) {
    canvas.toBlob(async blob => {
      if (!blob) return;
      const url = await uploadViolationScreenshot(submissionIdRef.current, blob).catch(() => null);
      logViolation({
        user_id: userId,
        assignment_id: asgn.id,
        submission_id: submissionIdRef.current,
        type: warnings[0],
        mode: selectedMode ?? 'text',
        evidence_url: url ?? undefined,
      }).catch(err => console.error('logViolation failed:', err));
    }, 'image/jpeg', 0.6);
  }
}
    } catch (err) {
      // Server not running — silently continue, don't interrupt exam
      console.error('Proctoring server unreachable:', err);
    }
  };

//stop refreshing the page
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeAsgn) return;
    // Show review popup first — actual submission happens in handleConfirmSubmit
    setShowReviewModal(true);
  };

  const handleConfirmSubmit = () => {
    if (!activeAsgn) return;
    setShowReviewModal(false);

    // After Round 1 — show loading screen briefly then go to Round 2
    if (examPhase === 'round1') {
    stopDictation();
    stopTTS();
    stopVideoProctoring(); // pause camera during transition
    setVideoMode(false);   // explicitly false so useEffect fires when we set true in goToRound2
    setVoiceMode(false);   // reset voice UI — Round 2 restores it based on selectedMode
    setExamPhase('transitioning');
      // If follow-ups already ready, go after short delay for UX. If still loading, wait for them.
      const goToRound2 = () => {
        setExamPhase('round2');
        // Restore voice mode for Round 2 if student chose voice in Round 1
        if (selectedMode === 'voice') {
          setVoiceMode(true);
          setCurrentQuestionIdx(0);
          setAiCaption('');
          setStudentCaption('');
        }
        setVideoMode(true); // restart camera for round 2 (false→true triggers useEffect)
      };
      if (followUpReadyRef.current) {
        setTimeout(goToRound2, 2200);
      } else {
        const interval = setInterval(() => {
          if (followUpReadyRef.current) { clearInterval(interval); goToRound2(); }
        }, 300);
        setTimeout(() => { clearInterval(interval); goToRound2(); }, 15000);
      }
      return;
    }

    // After Round 2 — merge all answers and submit for real
    const mergedAnswers = [...answers, ...followUpAnswers];

    stopDictation();
    stopTTS();
    stopVideoProctoring();
    const modeUsed = voiceMode ? 'voice' : 'text';

    const newSub = {
      id: submissionIdRef.current,
      studentName: userName,
      studentId: userId,
      answers: mergedAnswers,
      status: 'Pending' as const,
      submittedAt: Date.now(),
      violations,
      tabViolations,
      proctoringViolations: violations - tabViolations,
      videoViolationLog: [...videoViolations],
      modeUsed,
      answerEditFlags: [...answerEditFlags],
      originalAnswers: [...voiceSnapshotRef.current],
      followUpQuestions,
    } as StudentSubmission & { answerEditFlags: string[]; originalAnswers: string[]; followUpQuestions: string[] };

    setAppData(prev => ({
      ...prev,
      assignments: prev.assignments.map(a =>
        a.id === activeAsgn.id ? { ...a, submissions: [...a.submissions, newSub] } : a
      )
    }));

    // Persist to Supabase so teacher sees it after page refresh
    createSubmission({
      id: newSub.id,
      assignment_id: activeAsgn.id,
      student_id: userId,
      student_name: userName,
      student_email: userEmail,
      answers: mergedAnswers,
      results: null,
      status: 'Pending',
      violations,
      submitted_at: Date.now(),
      mode_used: modeUsed,
      answer_edit_flags: [...answerEditFlags],
      original_answers: [...voiceSnapshotRef.current],
      follow_up_questions: [...followUpQuestions],
    }).catch(err => console.error('Failed to save submission to Supabase:', err));

    // Full reset
    if (examTimerRef.current) { clearInterval(examTimerRef.current); examTimerRef.current = null; }
    setExamSecondsLeft(null);
    setExamTimeExpired(false);
    setTimerPopup(null);
    warned5MinRef.current = false;
    warned1MinRef.current = false;
    setActiveAsgn(null);
    setViolations(0);
    setTabViolations(0);
    setVoiceMode(false);
    setVideoMode(false);
    setSelectedMode(null);
    setShowModeSelect(false);
    setConsentGiven(false);
    setVideoViolations([]);
    setAnswerEditFlags([]);
    voiceSnapshotRef.current = [];
    blurTimeRef.current = {};
    replacedLockedRef.current = {};
    setExamStarted(false);
    setExamPhase('upload');
    setAssignmentText('');
    setFollowUpQuestions([]);
    setFollowUpAnswers([]);
    setFollowUpReady(false);
    followUpReadyRef.current = false;
    setFollowUpError('');
    onExamStateChange?.(false);
    alert('VivaPro Secure Submission Successful.');
  };

  // ── Timer warning popup modal ─────────────────────────────────────────────
  const TimerPopup = timerPopup ? (
    <div style={{
      position:'fixed', inset:0, zIndex:500,
      background:'rgba(15,23,42,0.45)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div style={{
        position:'relative', maxWidth:380, width:'90%',
        background:'white', borderRadius:24, padding:'32px 28px',
        boxShadow:'0 24px 60px rgba(0,0,0,0.18)',
        border: timerPopup === '1min' ? '2px solid rgba(220,38,38,0.3)' : '2px solid rgba(217,119,6,0.25)',
        animation:'timerPopupIn 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards',
        textAlign:'center',
      }}>
        {/* Icon */}
        <div style={{
          width:56, height:56, borderRadius:18, margin:'0 auto 16px',
          background: timerPopup === '1min' ? 'rgba(220,38,38,0.1)' : 'rgba(217,119,6,0.1)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width={28} height={28} fill="none" stroke={timerPopup === '1min' ? '#dc2626' : '#d97706'} viewBox="0 0 24 24" strokeWidth={2}>
            <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/>
          </svg>
        </div>
        <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:20, fontWeight:900, color:'#0f172a', marginBottom:8 }}>
          {timerPopup === '1min' ? '⚠ 1 Minute Left!' : '5 Minutes Remaining'}
        </div>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:'#64748b', lineHeight:1.6, marginBottom:24 }}>
          {timerPopup === '1min'
            ? 'Your time is almost up. Wrap up your answers and submit as soon as possible.'
            : 'You have 5 minutes left. Start wrapping up and review your answers.'}
        </div>
        <button
          onClick={() => setTimerPopup(null)}
          style={{
            width:'100%', padding:'12px', borderRadius:14, border:'none', cursor:'pointer',
            fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:800,
            background: timerPopup === '1min' ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(135deg,#d97706,#b45309)',
            color:'white', boxShadow: timerPopup === '1min' ? '0 4px 16px rgba(220,38,38,0.35)' : '0 4px 16px rgba(217,119,6,0.35)',
          }}
        >
          Got it — back to exam
        </button>
      </div>
    </div>
  ) : null;

  // ── Auto-submit when timer expires ────────────────────────────────────────
  useEffect(() => {
    if (!examTimeExpired || !examStarted || !activeAsgn) return;
    // Don't auto-submit if already in review or already submitted
    if (showReviewModal) return;
    // Trigger the real confirmation submit directly (skip review modal for timeout)
    handleConfirmSubmit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examTimeExpired]);

  //7 days in ms — after this the contest window is closed
  const CONTEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

  //graded assignments where the 7-day contest window is still open
  const contestableAssignments = (() => {
    if (!contestClassId) return [];
    const now = Date.now();
    return myAssignments.filter(a => {
      if (a.classId !== contestClassId) return false;
      const mySub = a.submissions.find(s => s.studentId === userId || s.studentName === userName);
      if (!mySub || mySub.status !== 'Graded') return false;
      //only allow contest if graded within last 7 days
      const gradedAt = (mySub as any).gradedAt || mySub.submittedAt;
      return now - gradedAt < CONTEST_WINDOW_MS;
    });
  })();

  const handleSubmitContest = async () => {
    if (!contestAsgnId || !contestReason.trim()) return;
    setContestSubmitting(true);

    const asgn = appData.assignments.find(a => a.id === contestAsgnId);
    const mySub = asgn?.submissions.find(s => s.studentId === userId || s.studentName === userName);
    if (!asgn || !mySub) { setContestSubmitting(false); return; }

    //build the request object first, then pass it to both supabase and local state
    const newRequest = {
      id: `contest-${Date.now()}`,
      studentId: userId,
      studentName: userName,
      assignmentId: contestAsgnId,
      assignmentName: asgn.name,
      submissionId: mySub.id,
      reason: contestReason.trim(),
      status: 'pending' as const,
      requestedAt: Date.now(),
      teacherId: asgn.teacherId,
    };


    //build a contest request and store it in appData
    await createContestRequest({
        id: newRequest.id,
        student_id: newRequest.studentId,
        student_name: newRequest.studentName,
        assignment_id: newRequest.assignmentId,
        assignment_name: newRequest.assignmentName,
        submission_id: newRequest.submissionId,
        reason: newRequest.reason,
        status: 'pending',
        requested_at: newRequest.requestedAt,
        teacher_id: newRequest.teacherId,
      });
      setAppData(prev => ({
        ...prev,
        contestRequests: [...(prev.contestRequests || []), newRequest],
      }));

    setContestReason('');
    setContestAsgnId('');
    setContestClassId('');
    setContestSubmitting(false);
    setContestSuccess(`Your contest request for "${asgn.name}" has been sent to your teacher.`);
    setTimeout(() => setContestSuccess(''), 5000);
  };

  //DOWNLOAD REPORT 
  const downloadPersonalReport = (asgn: Assignment, sub: StudentSubmission) => {
    //if no results then write 0 .reduce adds all records 
    const finalScore = (sub.results?.reduce((acc, b) => acc + b.score, 0) || 0) / (sub.results?.length || 1);
    const timestamp = new Date().toLocaleString();

    // ── Violation breakdown ──────────────────────────────────────────────────
    const totalViolations = sub.violations || 0;
    const tabViol = (sub as any).tabViolations ?? 0;
    const procViol = (sub as any).proctoringViolations ?? (totalViolations - tabViol);
    const violationLog: string[] = (sub as any).videoViolationLog || [];

    const violationSection = totalViolations > 0 ? `
      <div class='violation-box'>
        <h3 style='margin:0 0 12px; color:#dc2626;'>⚠ Integrity Report</h3>
        <table class='viol-table'>
          <tr><th>Violation Type</th><th>Count</th></tr>
          <tr>
            <td>🖥 Tab / Window Switching</td>
            <td style='color:${tabViol > 0 ? '#dc2626' : '#16a34a'};font-weight:700'>${tabViol}</td>
          </tr>
          <tr>
            <td>📹 Camera Proctoring (gaze, phone, face)</td>
            <td style='color:${procViol > 0 ? '#dc2626' : '#16a34a'};font-weight:700'>${procViol}</td>
          </tr>
          <tr style='border-top:2px solid #fecaca'>
            <td><b>Total Violations</b></td>
            <td style='color:#dc2626;font-weight:800'>${totalViolations}</td>
          </tr>
        </table>
        ${violationLog.length > 0 ? `
          <div style='margin-top:14px'>
            <p style='font-weight:700;font-size:10pt;margin-bottom:6px'>Camera Event Log:</p>
            <ul style='margin:0;padding-left:18px;font-size:9pt;color:#7f1d1d'>
              ${violationLog.map((v, i) => `<li style='margin-bottom:4px'>${i + 1}. ${v}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    ` : `<div class='no-violation-box'> No integrity violations recorded during this assessment.</div>`;

    const docContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>VivaPro Student Report</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 40px; }
        .header { text-align: center; border-bottom: 3px solid #6366f1; padding-bottom: 10px; }
        .score-box { background: #6366f1; color: white; padding: 20px; border-radius: 15px; text-align: center; margin: 30px 0; }
        .q-card { border: 1px solid #e2e8f0; padding: 20px; border-radius: 10px; margin-bottom: 20px; background: #f8fafc; }
        .q-card-followup { border: 1px solid #fde68a; padding: 20px; border-radius: 10px; margin-bottom: 20px; background: #fffbeb; }
        .label { color: #6366f1; font-weight: bold; font-size: 10pt; text-transform: uppercase; }
        .label-followup { color: #d97706; font-weight: bold; font-size: 10pt; text-transform: uppercase; }
        .feedback { background: white; border-left: 4px solid #6366f1; padding: 10px; margin-top: 10px; font-style: italic; }
        .feedback-followup { background: white; border-left: 4px solid #f59e0b; padding: 10px; margin-top: 10px; font-style: italic; }
        .section-divider { border: none; border-top: 2px dashed #e2e8f0; margin: 28px 0 20px; }
        .violation-box { border: 2px solid #fecaca; background: #fff5f5; border-radius: 10px; padding: 20px; margin: 24px 0; }
        .no-violation-box { border: 2px solid #bbf7d0; background: #f0fdf4; border-radius: 10px; padding: 16px 20px; margin: 24px 0; color: #15803d; font-weight: 600; font-size: 11pt; }
        .viol-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
        .viol-table th { background: #fee2e2; color: #991b1b; text-align: left; padding: 8px 12px; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.05em; }
        .viol-table td { padding: 8px 12px; border-bottom: 1px solid #fecaca; }
      </style>
      </head>
      <body>
        <div class='header'>
          <h1 style='color: #6366f1;'>VivaPro Official Grade Report</h1>
          <p>Student Name: <b>${userName}</b></p>
          <p>Assessment: <b>${asgn.name}</b></p>
          <p>Date: ${timestamp}</p>
        </div>
        <div class='score-box'>
          <h2 style='margin: 0;'>Final Grade</h2>
          <p style='font-size: 36pt; font-weight: bold; margin: 10px 0;'>${finalScore.toFixed(1)} / 10</p>
        </div>
        ${violationSection}
        <h3>Round 1 — Standard Questions</h3>
        ${sub.results?.slice(0, asgn.questions.length).map((res, i) => `
          <div class='q-card'>
            <p class='label'>Question ${i + 1}</p>
            <p><b>Question:</b> ${asgn.questions[i]?.question || 'N/A'}</p>
            <p><b>Your Answer:</b> "${sub.answers[i] || '[Empty]'}"</p>
            <p><b>Score:</b> <b>${res.score}/10</b></p>
            <div class='feedback'><b>Feedback:</b> ${res.feedback}</div>
          </div>
        `).join('')}
        ${(() => {
          const followUpQs: string[] = (sub as any).followUpQuestions || [];
          if (followUpQs.length === 0) return '';
          const r1Count = asgn.questions.length;
          return `
            <hr class='section-divider' />
            <h3>Round 2 — Follow-Up Questions</h3>
            ${followUpQs.map((q, i) => {
              const ansIdx = r1Count + i;
              const res = sub.results?.[ansIdx];
              return `
                <div class='q-card-followup'>
                  <p class='label-followup'>Follow-up Question ${i + 1}</p>
                  <p><b>Question:</b> ${q}</p>
                  <p><b>Your Answer:</b> "${sub.answers[ansIdx] || '[Empty]'}"</p>
                  ${res ? `
                    <p><b>Score:</b> <b>${res.score}/10</b></p>
                    <div class='feedback-followup'><b>Feedback:</b> ${res.feedback}</div>
                  ` : `<p style='color:#94a3b8;font-style:italic;'>Not yet graded</p>`}
                </div>
              `;
            }).join('')}
          `;
        })()}
        <p style='margin-top: 50px; text-align: center; font-size: 9pt; color: #94a3b8;'>
          This is an AI-generated academic evaluation by VivaPro Secure Assessment System.
        </p>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', docContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${asgn.name}_My_Report.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  // ─── VOICE CALL MODE UI ───────────────────────────────────────────────────
  if (activeAsgn && voiceMode) {
    // In Round 2, swap question/answer sources to follow-up arrays
    const isRound2Voice = examPhase === "round2";
    const voiceQuestions: { question: string }[] = isRound2Voice
      ? followUpQuestions.map(q => ({ question: q }))
      : (activeAsgn.questions as { question: string }[]);
    const voiceAnswers = isRound2Voice ? followUpAnswers : answers;
    const setVoiceAnswers = isRound2Voice
      ? (fn: (prev: string[]) => string[]) => setFollowUpAnswers(fn)
      : (fn: (prev: string[]) => string[]) => setAnswers(fn);
    const totalQuestions = voiceQuestions.length;
    const isAiSpeaking = speakingIdx !== null;
    const isStudentSpeaking = listeningIdx !== null;
    const progressPct = ((currentQuestionIdx) / totalQuestions) * 100;

    return (
      <>
        <style>{studentBgStyles}</style>
        <AnimatedBg />
        {/* Hidden canvas for frame capture (camera proctoring) */}
        <canvas ref={videoCanvasRef} style={{ display: 'none' }} />

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');

          .voice-root {
            font-family: 'Inter', sans-serif;
            position: fixed;
            inset: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            z-index: 50;
          }

          .voice-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 28px;
            background: rgba(255,255,255,0.92);
            backdrop-filter: blur(18px);
            border-bottom: 1.5px solid rgba(2,132,199,0.12);
            position: relative;
            z-index: 10;
            flex-shrink: 0;
          }

          .voice-brand { display:flex; align-items:center; gap:10px; }

          .voice-brand-dot {
            width: 8px; height: 8px; border-radius: 50%;
            background: #0284c7;
            box-shadow: 0 0 10px rgba(2,132,199,0.6);
            animation: vpPulse 2s ease-in-out infinite;
          }

          .voice-brand-name {
            font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: 0.05em;
          }

          .voice-status-badge {
            display: flex; align-items: center; gap: 8px;
            background: rgba(2,132,199,0.08);
            border: 1px solid rgba(2,132,199,0.2);
            border-radius: 100px; padding: 6px 14px;
          }

          .live-dot {
            width: 6px; height: 6px; border-radius: 50%;
            background: #059669;
            box-shadow: 0 0 6px rgba(5,150,105,0.7);
            animation: blink 1.5s ease-in-out infinite;
          }

          @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

          .voice-status-text {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px; color: #0369a1; letter-spacing: 0.08em;
          }

          .voice-timer {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 13px; color: #64748b; letter-spacing: 0.1em;
          }

          .voice-progress-bar {
            height: 3px; background: rgba(2,132,199,0.1); flex-shrink: 0;
          }

          .voice-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #0284c7, #38bdf8);
            transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
            box-shadow: 0 0 8px rgba(2,132,199,0.4);
          }

          .voice-question-pill {
            background: rgba(255,255,255,0.92);
            backdrop-filter: blur(18px);
            border: 1.5px solid rgba(2,132,199,0.12);
            border-radius: 100px;
            padding: 10px 24px;
            display: flex;
            align-items: flex-start;
            gap: 14px;
            flex-shrink: 0;
            margin: 12px 28px;
            box-shadow: 0 2px 12px rgba(2,132,199,0.07);
          }

          .voice-q-num {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px; color: #0284c7;
            letter-spacing: 0.1em; white-space: nowrap; flex-shrink: 0;
            padding-top: 2px;
          }

          .voice-q-text {
            font-size: 13px; font-weight: 600; color: #0f172a;
            line-height: 1.6; flex: 1;
          }

          .voice-main {
            position: relative;
            z-index: 10;
            flex: 1;
            display: grid;
            grid-template-columns: 1fr 1fr 260px;
            gap: 0;
            overflow: hidden;
          }

          .voice-panel {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px 28px;
            position: relative;
            background: rgba(255,255,255,0.6);
            backdrop-filter: blur(8px);
          }

          .voice-panel-divider {
            position: absolute;
            right: 0; top: 10%; bottom: 10%;
            width: 1px;
            background: linear-gradient(to bottom, transparent, rgba(2,132,199,0.15), transparent);
          }

          .avatar-ring-wrap {
            position: relative; margin-bottom: 20px;
          }

          .avatar-ring {
            position: absolute; inset: -12px; border-radius: 50%;
            border: 1.5px solid rgba(2,132,199,0.2);
            animation: ring-spin 8s linear infinite;
          }

          .avatar-ring-2 {
            inset: -24px; border-color: rgba(2,132,199,0.1);
            animation-duration: 12s; animation-direction: reverse;
          }

          @keyframes ring-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

          .speaking-pulse::before, .speaking-pulse::after {
            content: ''; position: absolute; inset: -8px; border-radius: 50%;
            border: 2px solid rgba(2,132,199,0.4);
            animation: speak-pulse 1.5s ease-out infinite;
          }
          .speaking-pulse::after { animation-delay: 0.5s; }
          @keyframes speak-pulse { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(1.5);opacity:0} }

          .listening-pulse::before, .listening-pulse::after {
            content: ''; position: absolute; inset: -8px; border-radius: 50%;
            border: 2px solid rgba(5,150,105,0.4);
            animation: listen-pulse 1.2s ease-out infinite;
          }
          .listening-pulse::after { animation-delay: 0.4s; }
          @keyframes listen-pulse { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(1.6);opacity:0} }

          .avatar-circle {
            width: 96px; height: 96px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            position: relative;
          }

          .avatar-ai {
            background: linear-gradient(135deg, #0369a1 0%, #0284c7 50%, #38bdf8 100%);
            box-shadow: 0 8px 32px rgba(2,132,199,0.3), inset 0 1px 0 rgba(255,255,255,0.3);
          }

          .avatar-student {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%);
            box-shadow: 0 8px 32px rgba(2,132,199,0.15), inset 0 1px 0 rgba(255,255,255,0.8);
            border: 2px solid rgba(2,132,199,0.2);
          }

          .avatar-label {
            font-size: 10px; font-weight: 700; letter-spacing: 0.15em;
            text-transform: uppercase; color: #94a3b8; margin-bottom: 4px;
          }

          .avatar-name {
            font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;
          }

          .avatar-state {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px; color: #94a3b8; letter-spacing: 0.08em; min-height: 16px;
          }
          .avatar-state.active { color: #0284c7; }
          .avatar-state.listening { color: #059669; }

          .waveform {
            display: flex; align-items: center; gap: 3px;
            height: 28px; margin-top: 10px;
          }

          .wave-bar {
            width: 3px; border-radius: 2px; background: #0284c7;
            animation: wave-anim var(--dur) ease-in-out infinite alternate;
            transform-origin: bottom;
          }
          .wave-bar.green { background: #059669; }
          @keyframes wave-anim { from{height:4px} to{height:var(--h)} }

          .voice-cam-panel {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px 20px;
            gap: 12px;
            background: rgba(255,255,255,0.75);
            backdrop-filter: blur(18px);
            border-left: 1.5px solid rgba(2,132,199,0.1);
            overflow-y: auto;
          }

          .voice-cam-wrap {
            width: 100%; aspect-ratio: 4/3;
            background: #0a0a0f; border-radius: 16px; overflow: hidden;
            position: relative;
            border: 1.5px solid rgba(2,132,199,0.15);
            box-shadow: 0 4px 20px rgba(0,0,0,0.12);
          }

          .voice-cam-video {
            width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);
          }

          .voice-cam-overlay {
            position: absolute; top: 0; left: 0; right: 0;
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 10px;
          }

          .voice-cam-badge {
            display: flex; align-items: center; gap: 4px;
            background: rgba(0,0,0,0.55); border-radius: 7px; padding: 3px 8px;
          }

          .voice-cam-label {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 8px; color: rgba(255,255,255,0.8); letter-spacing: 0.08em;
          }

          .voice-gaze-ok { color: #22c55e; font-size: 10px; font-family: 'IBM Plex Mono', monospace; }
          .voice-gaze-warn { color: #f59e0b; font-size: 10px; font-family: 'IBM Plex Mono', monospace; }

          .voice-cam-rec-dot {
            width: 5px; height: 5px; border-radius: 50%; background: #ef4444;
            box-shadow: 0 0 5px rgba(239,68,68,0.9);
            animation: blink 1.2s ease-in-out infinite;
          }

          .voice-viol-log { width: 100%; max-height: 80px; overflow-y: auto; }
          .voice-viol-item {
            font-family: 'IBM Plex Mono', monospace; font-size: 9px;
            color: #dc2626; padding: 2px 0;
            border-bottom: 1px solid rgba(220,38,38,0.1);
          }

          .voice-student-card {
            background: rgba(255,255,255,0.9);
            border: 1px solid rgba(2,132,199,0.12);
            border-radius: 12px; padding: 8px 14px; width: 100%; text-align: center;
          }

          .voice-caption-area {
            position: relative; z-index: 10;
            padding: 0 20px 14px;
            display: flex; flex-direction: column; gap: 8px;
            flex-shrink: 0;
            background: rgba(255,255,255,0.7);
            backdrop-filter: blur(8px);
            border-top: 1px solid rgba(2,132,199,0.08);
          }

          .caption-bubble {
            max-width: 500px; padding: 10px 16px; border-radius: 14px;
            font-size: 13px; line-height: 1.5; font-weight: 500;
          }

          .caption-ai {
            background: rgba(2,132,199,0.07);
            border: 1px solid rgba(2,132,199,0.15);
            color: #0f172a; align-self: flex-start;
          }

          .caption-student {
            background: rgba(255,255,255,0.9);
            border: 1px solid #e2e8f0;
            color: #334155; align-self: flex-end;
          }

          .caption-label {
            font-size: 9px; font-weight: 700; letter-spacing: 0.12em;
            text-transform: uppercase; margin-bottom: 3px; opacity: 0.5;
          }

          .voice-controls {
            position: relative; z-index: 10;
            display: flex; align-items: center; justify-content: center;
            gap: 12px; padding: 14px 28px 18px;
            border-top: 1.5px solid rgba(2,132,199,0.1);
            background: rgba(255,255,255,0.92);
            backdrop-filter: blur(18px);
            flex-shrink: 0; flex-wrap: wrap;
          }

          .ctrl-btn {
            display: flex; flex-direction: column; align-items: center;
            gap: 5px; cursor: pointer; background: none; border: none; padding: 0;
          }

          .ctrl-btn-icon {
            width: 48px; height: 48px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            transition: transform 0.15s, box-shadow 0.15s;
          }

          .ctrl-btn:hover .ctrl-btn-icon { transform: scale(1.08); }

          .ctrl-btn-label {
            font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
            text-transform: uppercase; color: #64748b;
          }

          .btn-ask {
            background: linear-gradient(135deg, #0284c7, #0369a1);
            box-shadow: 0 4px 16px rgba(2,132,199,0.35);
          }
          .btn-ask:hover { box-shadow: 0 6px 24px rgba(2,132,199,0.5); }

          .btn-mic {
            background: #f8fafc; border: 1.5px solid #e2e8f0;
          }
          .btn-mic.active {
            background: rgba(5,150,105,0.1); border-color: rgba(5,150,105,0.3);
            box-shadow: 0 4px 16px rgba(5,150,105,0.2);
          }

          .btn-next { background: #f8fafc; border: 1.5px solid #e2e8f0; }

          .btn-end {
            background: rgba(220,38,38,0.08); border: 1.5px solid rgba(220,38,38,0.2);
          }
          .btn-end:hover .ctrl-btn-icon {
            background: rgba(220,38,38,0.15) !important;
            box-shadow: 0 4px 16px rgba(220,38,38,0.25);
          }

          .btn-exit { background: #f8fafc; border: 1.5px solid #e2e8f0; }

          .ctrl-separator {
            width: 1px; height: 36px;
            background: linear-gradient(to bottom, transparent, rgba(2,132,199,0.15), transparent);
            margin: 0 4px;
          }

          .proctor-violation-banner {
            position: fixed; top: 72px; left: 50%; transform: translateX(-50%);
            z-index: 300;
            background: rgba(220,38,38,0.92); border: 1px solid rgba(239,68,68,0.5);
            border-radius: 12px; padding: 10px 20px;
            font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: white;
            letter-spacing: 0.05em; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            white-space: nowrap;
          }
        `}</style>

        <div className="voice-root">

          {showViolationBanner && (
            <div className="proctor-violation-banner">⚠ {showViolationBanner}</div>
          )}

          {/* Topbar */}
          <div className="voice-topbar">
            <div className="voice-brand">
              <div className="voice-brand-dot" />
              <span className="voice-brand-name">VivaPro</span>
            </div>
            <div className="voice-status-badge">
              <div className="live-dot" />
              <span className="voice-status-text">CAMERA PROCTORED</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              {violations > 0 && (
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'#dc2626', letterSpacing:'0.08em' }}>
                  ⚠ {violations} violation{violations > 1 ? 's' : ''}
                </span>
              )}
              {examSecondsLeft !== null && (
                <span style={{
                  fontFamily:"'IBM Plex Mono',monospace", fontSize:18, fontWeight:800,
                  letterSpacing:'0.1em', padding:'8px 16px', borderRadius:10,
                  background: examSecondsLeft <= 60 ? 'rgba(220,38,38,0.15)' : examSecondsLeft <= 300 ? 'rgba(217,119,6,0.15)' : 'rgba(2,132,199,0.1)',
                  color: examSecondsLeft <= 60 ? '#dc2626' : examSecondsLeft <= 300 ? '#d97706' : '#0284c7',
                  border: `1px solid ${examSecondsLeft <= 60 ? 'rgba(220,38,38,0.3)' : examSecondsLeft <= 300 ? 'rgba(217,119,6,0.3)' : 'rgba(2,132,199,0.2)'}`,
                  animation: examSecondsLeft <= 60 ? 'timerPulse 1s ease-in-out infinite' : 'none',
                }}>
                  ⏱ {examSecondsLeft <= 0 ? 'Time up!' : formatCountdown(examSecondsLeft)}
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="voice-progress-bar">
            <div className="voice-progress-fill" style={{ width:`${progressPct}%` }} />
          </div>

          {/* Current question pill — full text, no truncation */}
          <div className="voice-question-pill">
            <span className="voice-q-num">Q {currentQuestionIdx + 1} / {totalQuestions}</span>
            <div style={{ width:1, background:'rgba(2,132,199,0.15)', alignSelf:'stretch', flexShrink:0 }} />
            <span className="voice-q-text">
              {voiceQuestions[currentQuestionIdx]?.question || 'No more questions'}
            </span>
          </div>

          {/* Main 3-column grid: AI | Student | Camera */}
          <div className="voice-main">

            {/* AI panel */}
            <div className="voice-panel">
              <div className="voice-panel-divider" />
              <p className="avatar-label">AI Examiner</p>
              <div className="avatar-ring-wrap" style={{ marginBottom:20 }}>
                {isAiSpeaking && <div className="avatar-ring" />}
                {isAiSpeaking && <div className="avatar-ring avatar-ring-2" />}
                <div className={`avatar-circle avatar-ai ${isAiSpeaking ? 'speaking-pulse' : ''}`}>
                  <svg width="42" height="42" fill="none" stroke="rgba(255,255,255,0.95)" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
              </div>
              <p className="avatar-name">VivaPro AI</p>
              <p className={`avatar-state ${isAiSpeaking ? 'active' : ''}`}>
                {isAiSpeaking ? '● Speaking' : 'Waiting'}
              </p>
              {isAiSpeaking && (
                <div className="waveform">
                  {[18,10,22,14,26,10,18,24,12,20,8,16].map((h,i) => (
                    <div key={i} className="wave-bar" style={{ '--h':`${h}px`, '--dur':`${0.4+(i%4)*0.12}s` } as any} />
                  ))}
                </div>
              )}
            </div>

            {/* Student panel */}
            <div className="voice-panel" style={{ alignItems:'center' }}>
              <p className="avatar-label">Student</p>
              <div className="avatar-ring-wrap" style={{ marginBottom:20 }}>
                <div className={`avatar-circle avatar-student ${isStudentSpeaking ? 'listening-pulse' : ''}`}>
                  <svg width="42" height="42" fill="none" stroke="#0284c7" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
              </div>
              <p className="avatar-name">{userName}</p>
              <p className={`avatar-state ${isStudentSpeaking ? 'listening' : ''}`}>
                {isStudentSpeaking ? '● Listening' : 'Muted'}
              </p>
              {isStudentSpeaking && (
                <div className="waveform">
                  {[10,20,14,24,8,18,22,12,26,16,10,20].map((h,i) => (
                    <div key={i} className="wave-bar green" style={{ '--h':`${h}px`, '--dur':`${0.35+(i%5)*0.1}s` } as any} />
                  ))}
                </div>
              )}
            </div>

            {/* Camera column */}
            <div className="voice-cam-panel">
              <div style={{ width:'100%' }}>
                <p style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:'#94a3b8', textTransform:'uppercase' as const, letterSpacing:'0.12em', marginBottom:8 }}>Live Camera</p>
                <div className="voice-cam-wrap">
                  <video ref={videoRef} autoPlay muted playsInline className="voice-cam-video" />
                  <div className="voice-cam-overlay">
                    <div className="voice-cam-badge">
                      <div className="voice-cam-rec-dot" />
                      <span className="voice-cam-label">LIVE</span>
                    </div>
                    <div className="voice-cam-badge">
                      {lookAwaySeconds > 0
                        ? <span className="voice-gaze-warn">👁 Away</span>
                        : <span className="voice-gaze-ok">👁 On</span>
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div className="voice-student-card">
                <p style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:'#94a3b8', textTransform:'uppercase' as const, letterSpacing:'0.1em', margin:'0 0 2px' }}>Student</p>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:700, color:'#0f172a', margin:0 }}>{userName}</p>
              </div>

              {videoViolations.length > 0 && (
                <div style={{ width:'100%' }}>
                  <p style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:'rgba(220,38,38,0.7)', textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:5 }}>
                    Flags ({videoViolations.length})
                  </p>
                  <div className="voice-viol-log">
                    {[...videoViolations].reverse().map((v,i) => (
                      <div key={i} className="voice-viol-item">⚠ {v}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Captions */}
          {(aiCaption || studentCaption) && (
            <div className="voice-caption-area">
              {aiCaption && (
                <div className="caption-bubble caption-ai">
                  <div className="caption-label">AI Examiner</div>
                  {aiCaption}
                </div>
              )}
              {studentCaption && (
                <div className="caption-bubble caption-student" style={{ alignSelf:'flex-end' }}>
                  <div className="caption-label">You</div>
                  {studentCaption}
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="voice-controls">
            <button className="ctrl-btn btn-exit" type="button" onClick={() => {
              voiceSnapshotRef.current = [...answers];
              setVoiceMode(false); stopDictation(); stopTTS();
            }}>
              <div className="ctrl-btn-icon btn-exit">
                <svg width="18" height="18" fill="none" stroke="#475569" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                </svg>
              </div>
              <span className="ctrl-btn-label">Text Mode</span>
            </button>

            <div className="ctrl-separator" />

            <button className="ctrl-btn" type="button" onClick={() => speakQuestion(currentQuestionIdx)}>
              <div className="ctrl-btn-icon btn-ask">
                {speakingIdx === currentQuestionIdx ? (
                  <svg width="18" height="18" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2.5">
                    <rect x="6" y="6" width="4" height="12" rx="1" fill="white" stroke="none"/>
                    <rect x="14" y="6" width="4" height="12" rx="1" fill="white" stroke="none"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5l-4 4H4v6h3l4 4V5z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a4 4 0 010 7"/>
                  </svg>
                )}
              </div>
              <span className="ctrl-btn-label">{speakingIdx === currentQuestionIdx ? 'Stop' : 'Read Q'}</span>
            </button>

            <button className="ctrl-btn" type="button" onClick={() => {
              if (listeningIdx === currentQuestionIdx) stopDictation();
              else startDictation(currentQuestionIdx);
            }}>
              <div className={`ctrl-btn-icon btn-mic ${isStudentSpeaking ? 'active' : ''}`}>
                {isStudentSpeaking ? (
                  <svg width="18" height="18" fill="none" stroke="#059669" viewBox="0 0 24 24" strokeWidth="2">
                    <rect x="6" y="6" width="4" height="12" rx="1" fill="#059669" stroke="none"/>
                    <rect x="14" y="6" width="4" height="12" rx="1" fill="#059669" stroke="none"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" fill="none" stroke="#475569" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a3 3 0 003-3V7a3 3 0 00-6 0v4a3 3 0 003 3zm7-3a7 7 0 01-14 0m7 7v3m-4 0h8"/>
                  </svg>
                )}
              </div>
              <span className="ctrl-btn-label">{isStudentSpeaking ? 'Stop' : 'Speak'}</span>
            </button>

            <button className="ctrl-btn" type="button"
              disabled={currentQuestionIdx >= totalQuestions - 1}
              onClick={() => {
                stopDictation(); stopTTS();
                setCurrentQuestionIdx(prev => prev + 1);
                setAiCaption(''); setStudentCaption('');
              }}
            >
              <div className="ctrl-btn-icon btn-next" style={{ opacity: currentQuestionIdx >= totalQuestions - 1 ? 0.3 : 1 }}>
                <svg width="18" height="18" fill="none" stroke="#475569" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
                </svg>
              </div>
              <span className="ctrl-btn-label">Next</span>
            </button>

            <div className="ctrl-separator" />

            <button className="ctrl-btn btn-end" type="button" onClick={() => handleSubmit()}>
              <div className="ctrl-btn-icon btn-end">
                <svg width="18" height="18" fill="none" stroke="#dc2626" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"/>
                </svg>
              </div>
              <span className="ctrl-btn-label" style={{ color:'#dc2626' }}>End</span>
            </button>
          </div>
        </div>
        {/* ── Review Modal (voice mode) ──────────────────────────────────────── */}
        {showReviewModal && activeAsgn && (
          <div style={{
            position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(6px)',
            zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:24
          }}>
            <div style={{
              background:'white', borderRadius:28, padding:'36px 36px 28px',
              maxWidth:600, width:'100%', maxHeight:'80vh', overflowY:'auto', boxShadow:'0 32px 80px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
                <div style={{ width:44, height:44, borderRadius:14, background:'#0284c7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="22" height="22" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontFamily:"'Inter',sans-serif", fontSize:18, fontWeight:800, color:'#0f172a', margin:0 }}>Review Your Answers</h2>
                  <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94a3b8', margin:'4px 0 0' }}>Check everything before submitting. You cannot change answers after this.</p>
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:28 }}>
                {isRound2Voice
                  ? followUpQuestions.map((q, i) => (
                    <div key={i} style={{ background:'#f8fafc', border:'1px solid #f1f5f9', borderRadius:16, padding:'16px 18px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:700, color:'#0284c7', background:'rgba(2,132,199,0.08)', border:'1px solid rgba(2,132,199,0.2)', borderRadius:8, padding:'2px 8px' }}>FU{i+1}</span>
                        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, color:'#1e293b', margin:0, flex:1 }}>{q}</p>
                      </div>
                      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color: followUpAnswers[i]?.trim() ? '#334155' : '#cbd5e1', fontStyle: followUpAnswers[i]?.trim() ? 'normal' : 'italic', margin:0, lineHeight:1.6 }}>
                        {followUpAnswers[i]?.trim() || 'No answer provided'}
                      </p>
                    </div>
                  ))
                  : activeAsgn.questions.map((q, i) => (
                    <div key={q.id} style={{ background:'#f8fafc', border:'1px solid #f1f5f9', borderRadius:16, padding:'16px 18px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:700, color:'#0284c7', background:'rgba(2,132,199,0.08)', border:'1px solid rgba(2,132,199,0.2)', borderRadius:8, padding:'2px 8px' }}>Q{i+1}</span>
                        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, color:'#1e293b', margin:0, flex:1 }}>{q.question}</p>
                      </div>
                      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color: answers[i]?.trim() ? '#334155' : '#cbd5e1', fontStyle: answers[i]?.trim() ? 'normal' : 'italic', margin:0, lineHeight:1.6 }}>
                        {answers[i]?.trim() || 'No answer provided'}
                      </p>
                    </div>
                  ))}
              </div>

              <div style={{ display:'flex', gap:12 }}>
                <button
                  onClick={() => setShowReviewModal(false)}
                  style={{ flex:1, padding:'14px', background:'#f1f5f9', border:'none', borderRadius:16, fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:700, color:'#64748b', cursor:'pointer' }}
                >
                  Go Back
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  style={{ flex:2, padding:'14px', background:'linear-gradient(135deg,#0284c7,#0369a1)', border:'none', borderRadius:16, fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:800, color:'white', cursor:'pointer', boxShadow:'0 6px 20px rgba(2,132,199,0.35)' }}
                >
                  Confirm and Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ─── UPLOAD SCREEN

  // ─── UPLOAD SCREEN (first thing student sees after clicking an assignment) ─
  if (activeAsgn && examPhase === 'upload') {
    return (
      <>
        <style>{studentBgStyles}</style>
        <AnimatedBg />
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', padding:24, position:'relative', zIndex:1 }}>
          <div style={{ maxWidth:480, width:'100%', background:'rgba(255,255,255,0.92)', backdropFilter:'blur(18px)', borderRadius:32, padding:40, boxShadow:'0 20px 60px rgba(0,0,0,0.08)', border:'1px solid rgba(2,132,199,0.15)' }}>
            {/* Header */}
            <div style={{ textAlign:'center', marginBottom:32 }}>
              <div style={{ width:56, height:56, background:'#0284c7', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <svg width="28" height="28" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 style={{ fontFamily:"'Inter',sans-serif", fontSize:22, fontWeight:800, color:'#0f172a', marginBottom:6 }}>{activeAsgn.name}</h2>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#94a3b8', fontWeight:500 }}>
                Step 1 of 3 · Upload your assignment before starting
              </p>
            </div>

            {/* Explainer */}
            <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:14, padding:'14px 18px', marginBottom:28 }}>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#1d4ed8', marginBottom:6 }}>
                📋 How this viva works
              </p>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#1e40af', lineHeight:1.7, margin:0 }}>
                <strong>Step 1</strong> : Upload your assignment (this screen).<br />
                <strong>Step 2</strong> : Answer the standard viva questions.<br />
                <strong>Step 3</strong> : Answer follow-up questions based on your assignment.
              </p>
            </div>

            {/* File upload */}
            <input
              ref={assignmentFileInputRef}
              type="file"
              accept=".txt,.docx,.md,.py,.js,.ts,.java,.cpp,.c,.cs,.html,.css"
              style={{ display:'none' }}
              onChange={handleAssignmentUpload}
            />

            {!uploadingDoc ? (
              <>
                <button
                  onClick={() => assignmentFileInputRef.current?.click()}
                  style={{
                    width:'100%', padding:'16px', marginBottom:10,
                    background:'linear-gradient(135deg, #0284c7, #0369a1)',
                    color:'white', border:'none', borderRadius:16,
                    fontFamily:"'Inter',sans-serif", fontSize:15, fontWeight:700,
                    cursor:'pointer', boxShadow:'0 8px 24px rgba(99,102,241,0.3)',
                  }}
                >
                  📄 Upload Assignment
                </button>
                <p style={{ textAlign:'center', fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94a3b8', margin:'0 0 20px' }}>
                  Supported: .txt ·.docx · 
                </p>
                {followUpError && (
                  <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12, padding:'12px 16px', marginBottom:16, fontFamily:"'Inter',sans-serif", fontSize:13, color:'#dc2626' }}>
                    ⚠ {followUpError}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign:'center', padding:'24px 0' }}>
                <div style={{ width:40, height:40, border:'3px solid #e2e8f0', borderTopColor:'#4f46e5', borderRadius:'50%', margin:'0 auto 14px', animation:'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:14, color:'#64748b', margin:0 }}>Reading your document…</p>
              </div>
            )}

            {/* Cancel */}
            <button
              onClick={() => { setActiveAsgn(null); setExamPhase('upload'); setFollowUpError(''); }}
              style={{ width:'100%', padding:'12px', background:'none', border:'none', cursor:'pointer', fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:600, color:'#94a3b8' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </>
    );
  }

  // ─── GENERATING SCREEN (shown while Gemini runs, student picks mode here) ─
  if (activeAsgn && examPhase === 'generating') {
    const modes = ['text', 'voice'];
    const modeInfo: Record<string, { icon: string; label: string; desc: string; color: string }> = {
      text:  { icon: '⌨️', label: 'Text Mode',  desc: 'Type your answers. Camera + tab switching are monitored.',       color: '#0284c7' },
      voice: { icon: '🎙️', label: 'Voice Mode',  desc: 'Speak your answers via microphone. Camera + AI transcription.', color: '#0369a1' },
    };

    return (
      <>
        <style>{studentBgStyles}</style>
        <AnimatedBg />

        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', padding:24, position:'relative', zIndex:1 }}>
          <div style={{ maxWidth:520, width:'100%', background:'rgba(255,255,255,0.92)', backdropFilter:'blur(18px)', borderRadius:32, padding:40, boxShadow:'0 20px 60px rgba(0,0,0,0.08)', border:'1px solid rgba(2,132,199,0.15)' }}>
            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
              @keyframes pulse-glow { 0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0.3)} 50%{box-shadow:0 0 0 10px rgba(99,102,241,0)} }
              @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
              @keyframes bar { 0%,100%{height:6px} 50%{height:22px} }
            `}</style>

            {/* Loading banner */}
            <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', border:'1px solid #c7d2fe', borderRadius:20, padding:'20px 24px', marginBottom:32, display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ width:44, height:44, borderRadius:14, background:'white', border:'1px solid #c7d2fe', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {!followUpReady ? (
                  <div style={{ width:22, height:22, border:'2.5px solid #c7d2fe', borderTopColor:'#4670e5ff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                ) : (
                  <span style={{ fontSize:20 }}>✓</span>
                )}
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:700, color:'#4670e5ff', margin:'0 0 4px' }}>
                  {followUpReady ? 'Ready to begin' : 'Preparing your viva…'}
                </p>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#6366f1', margin:0 }}>
                  {followUpReady ? 'Select a mode and start whenever you are ready.' : 'This will only take a few seconds. Select your mode below while you wait.'}
                </p>
              </div>
              {!followUpReady && (
                <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:28, flexShrink:0 }}>
                  {[0,1,2,3,4].map(i => (
                    <div key={i} style={{
                      width:4, background:'#6366f1', borderRadius:2,
                      animation:`bar 1s ease-in-out infinite`,
                      animationDelay:`${i * 0.15}s`,
                      height:6,
                    }} />
                  ))}
                </div>
              )}
            </div>

            {/* Header */}
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <h2 style={{ fontFamily:"'Inter',sans-serif", fontSize:20, fontWeight:800, color:'#0f172a', marginBottom:4 }}>{activeAsgn.name}</h2>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#94a3b8', fontWeight:500 }}>
                Step 2 of 3 · Select your viva mode while the AI works
              </p>
            </div>

            {/* Time limit notice */}
            {(activeAsgn as any).timeLimitMinutes && (() => {
              const mins = (activeAsgn as any).timeLimitMinutes;
              const formatted = mins >= 60 ? `${Math.floor(mins/60)}h${mins%60>0?` ${mins%60}m`:''}` : `${mins} min`;
              return (
                <div style={{ background:'linear-gradient(135deg,rgba(220,38,38,0.07),rgba(220,38,38,0.04))', border:'1.5px solid rgba(220,38,38,0.25)', borderRadius:16, padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
                  <svg width={18} height={18} fill="none" stroke="#dc2626" viewBox="0 0 24 24" strokeWidth={2} style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>
                  <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#7f1d1d', margin:0, lineHeight:1.5 }}>
                    <strong style={{ color:'#dc2626' }}>⏱ {formatted} total time limit</strong> is shared across both rounds. Timer starts the moment you click Begin.
                  </p>
                </div>
              );
            })()}

            {/* Mode buttons */}
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:24 }}>
              {modes.map((m: string) => {
                const info = modeInfo[m];
                if (!info) return null;
                const isSelected = selectedMode === m;
                return (
                  <button
                    key={m}
                    onClick={() => setSelectedMode(m as any)}
                    style={{
                      display:'flex', alignItems:'center', gap:16, padding:'14px 18px',
                      background: isSelected ? '#eef2ff' : '#f8fafc',
                      border: `2px solid ${isSelected ? info.color : '#f1f5f9'}`,
                      borderRadius:16, cursor:'pointer', textAlign:'left', transition:'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize:24 }}>{info.icon}</span>
                    <div style={{ flex:1 }}>
                      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:700, color:'#1e293b', margin:0 }}>{info.label}</p>
                      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94a3b8', margin:'2px 0 0' }}>{info.desc}</p>
                    </div>
                    {isSelected && (
                      <div style={{ width:22, height:22, borderRadius:'50%', background:info.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <svg width="12" height="12" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Consent */}
            <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:14, padding:'14px 18px', marginBottom:24 }}>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#c2410c', marginBottom:6 }}>🔒 Session Monitoring Notice</p>
              <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#92400e', lineHeight:1.8 }}>
                {selectedMode === 'voice' ? (
                  <>
                    <p style={{ margin:'0 0 8px 0' }}>Your camera will be used for live proctoring and your microphone for answer transcription.</p>
                    <p style={{ margin:0 }}>By proceeding, you consent to this monitoring.</p>
                  </>
                ) : (
                  <>
                    <p style={{ margin:'0 0 8px 0' }}>Your camera will be used for live proctoring during this session. Tab switching is also logged.</p>
                    <p style={{ margin:0 }}>By proceeding, you consent to this monitoring.</p>
                  </>
                )}
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:10, marginTop:12, cursor:'pointer' }}>
                <input type="checkbox" checked={consentGiven} onChange={e => setConsentGiven(e.target.checked)} style={{ width:16, height:16, accentColor:'#c2410c', cursor:'pointer' }} />
                <span style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, color:'#92400e' }}>I understand and consent to the live monitoring of this session</span>
              </label>
            </div>

            {/* Start — enabled once mode + consent done. No need to wait for Gemini — it runs in background */}
            <button
              disabled={!selectedMode || !consentGiven}
              onClick={() => {
                if (!selectedMode || !consentGiven) return;
                setExamPhase('round1');
                startExam();
              }}
              style={{
                width:'100%', padding:'16px', borderRadius:16,
                border: selectedMode && consentGiven ? 'none' : '1.5px solid #cbd5e1',
                cursor: selectedMode && consentGiven ? 'pointer' : 'not-allowed',
                background: selectedMode && consentGiven
                  ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                  : 'rgba(241,245,249,0.95)',
                color: selectedMode && consentGiven ? 'white' : '#94a3b8',
                fontFamily:"'Inter',sans-serif", fontSize:15, fontWeight:800,
                boxShadow: selectedMode && consentGiven ? '0 8px 24px rgba(2,132,199,0.35)' : 'none',
                transition:'all 0.2s',
              }}
            >
              {selectedMode && consentGiven
                ? `Begin Round 1:  ${modeInfo[selectedMode]?.label || ''}`
                : !selectedMode
                  ? 'Select a mode to continue'
                  : 'Check the consent box to continue'}
            </button>

            <button
              onClick={() => { setActiveAsgn(null); setExamPhase('upload'); setSelectedMode(null); setConsentGiven(false); setFollowUpReady(false); setFollowUpQuestions([]); setAssignmentText(''); }}
              style={{ width:'100%', padding:'12px', marginTop:10, background:'none', border:'none', cursor:'pointer', fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:600, color:'#94a3b8' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </>      
    );
  }

  // ─── TRANSITIONING SCREEN (between round 1 and round 2) ─────────────────
  if (activeAsgn && examPhase === 'transitioning') {
    return (
      <>
        <style>{studentBgStyles}</style>
        <AnimatedBg />
        <div style={{
          position:'fixed', inset:0, background:'rgba(15,17,23,0.5)',
          display:'flex', alignItems:'center', justifyContent:'center',
          flexDirection:'column', zIndex:50, fontFamily:"'Inter',sans-serif",
        }}>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes fade-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
            @keyframes pulse-ring { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.15);opacity:0} }
          `}</style>

          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)', backgroundSize:'40px 40px', pointerEvents:'none' }} />

          <div style={{ position:'relative', zIndex:1, textAlign:'center', animation:'fade-up 0.5s ease forwards' }}>
            {/* Spinner with ring */}
            <div style={{ position:'relative', width:80, height:80, margin:'0 auto 32px' }}>
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid rgba(99,102,241,0.2)', animation:'pulse-ring 1.8s ease-in-out infinite' }} />
              <div style={{ position:'absolute', inset:6, borderRadius:'50%', border:'3px solid rgba(255,255,255,0.06)', borderTopColor:'#6366f1', animation:'spin 0.9s linear infinite' }} />
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="28" height="28" fill="none" stroke="rgba(255,255,255,0.5)" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
            </div>

            <p style={{ color:'#f1f5f9', fontSize:20, fontWeight:800, margin:'0 0 10px', letterSpacing:'-0.01em' }}>
              Round 2 is starting
            </p>
            <p style={{ color:'#475569', fontSize:14, margin:0 }}>
              Getting your follow-up questions ready…
            </p>
          </div>
        </div>
      </>
    );
  }

  // ─── ROUND 2 — follow-up questions ────────────────────────────────────────
  if (activeAsgn && examPhase === 'round2') {
    const r2Answered = followUpAnswers.filter(a => a.trim().length > 0).length;
    const allAnswered = r2Answered === followUpQuestions.length && followUpQuestions.length > 0;
    const r2Progress = followUpQuestions.length ? (r2Answered / followUpQuestions.length) * 100 : 0;

    return (
      <>
        <style>{studentBgStyles}</style>
        <AnimatedBg />         
        {/* Hidden canvas for camera proctoring */}
        <canvas ref={videoCanvasRef} style={{ display: 'none' }} />

        {/* Violation banner */}
        {showViolationBanner && (
          <div style={{
            position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 300, background: 'rgba(220,38,38,0.92)', border: '1px solid rgba(239,68,68,0.5)',
            borderRadius: 12, padding: '10px 20px',
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'white',
            letterSpacing: '0.05em', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' as const,
          }}>
            ⚠ {showViolationBanner}
          </div>
        )}

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
          .r2-page { display:flex; align-items:flex-start; gap:32px; margin:-24px -32px 0; padding:32px 32px 0; box-sizing:border-box; height:calc(100vh - 65px); position:relative; z-index:1; overflow:hidden; }          .r2-main { flex:1; min-width:0; font-family:'Inter',sans-serif; display:flex; flex-direction:column; height:100%; overflow:hidden; }
          .r2-card {
            background: rgba(255,255,255,0.82);
            backdrop-filter: blur(18px);
            border: 1px solid #f1f5f9;
            border-radius: 24px;
            padding: 28px;
            margin-bottom: 16px;
            transition: border-color 0.2s, box-shadow 0.2s;
          }
          .r2-card:focus-within {
            border-color: rgba(2,132,199,0.4);
            box-shadow: 0 0 0 4px rgba(2,132,199,0.06), 0 4px 20px rgba(0,0,0,0.04);
          }
          .r2-card.answered { border-color: rgba(2,132,199,0.2); }
          .r2-textarea {
            width: 100%;
            margin-top: 16px;
            padding: 16px;
            background: #f8fafc;
            border: 1.5px solid #f1f5f9;
            border-radius: 16px;
            outline: none;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            color: #1e293b;
            min-height: 120px;
            resize: vertical;
            transition: border-color 0.2s, box-shadow 0.2s;
            line-height: 1.6;
            box-sizing: border-box;
          }
           .r2-textarea:focus {
            border-color: rgba(2,132,199,0.5);
            box-shadow: 0 0 0 3px rgba(2,132,199,0.08);
            background: white;
          }
          .r2-submit-btn {
            width: 100%;
            padding: 18px;
            background: linear-gradient(135deg, #0284c7, #0369a1);
            color: white;
            border: none;
            border-radius: 20px;
            font-family: 'Inter', sans-serif;
            font-size: 15px;
            font-weight: 800;
            letter-spacing: 0.04em;
            cursor: pointer;
            margin-top: 8px;
            box-shadow: 0 8px 30px rgba(2,132,199,0.35);
            transition: transform 0.15s, box-shadow 0.15s;
          }
          .r2-submit-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(2,132,199,0.45); }
          .r2-submit-btn:active { transform: translateY(0); }
          .r2-submit-btn:disabled { background: #e2e8f0; color: #94a3b8; box-shadow: none; cursor: not-allowed; transform: none; }
          .r2-cam-sidebar { position:sticky; top:40px; align-self:flex-start; flex-shrink:0; width:240px; display:flex; flex-direction:column; gap:12px; }
          .r2-cam-feed-wrap { width:100%; aspect-ratio:4/3; border-radius:18px; overflow:hidden; border:1.5px solid #e2e8f0; background:#0a0a0f; box-shadow:0 8px 32px rgba(0,0,0,0.12); position:relative; }
          .r2-cam-student-card { background:white; border:1px solid #f1f5f9; border-radius:14px; padding:10px 16px; text-align:center; box-shadow:0 2px 12px rgba(0,0,0,0.05); }
          .r2-cam-viol-log { background:#fff5f5; border:1px solid #fecaca; border-radius:14px; padding:10px 14px; max-height:100px; overflow-y:auto; }
          .r2-mic-btn { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:10px 14px; border:1.5px solid #e2e8f0; border-radius:12px; background:#f8fafc; cursor:pointer; font-family:'Inter',sans-serif; font-size:12px; font-weight:600; color:#64748b; transition:all 0.15s; margin-top:10px; }
          .r2-mic-btn.listening { background:#f0fdf4; border-color:#86efac; color:#15803d; }
          .r2-mic-btn:hover:not(.listening) { background:rgba(2,132,199,0.06); border-color:rgba(2,132,199,0.3); color:#0284c7; }
          @keyframes r2CamBlink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        `}</style>

        <div className="r2-page">
          <div className="r2-main">
            {/* Header */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:24, paddingTop:0, flexShrink:0 }}>
              <div style={{ minWidth:0, flex:1 }}>
                <h2 style={{ fontSize:28, fontWeight:800, color:'#0f172a', letterSpacing:'-0.02em', lineHeight:1.1, margin:'0 0 10px' }}>{activeAsgn.name}</h2>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:500, letterSpacing:'0.1em', textTransform:'uppercase' as const, padding:'5px 12px', borderRadius:100, background:'#fef3c7', color:'#92400e', border:'1px solid #fde68a', whiteSpace:'nowrap' as const }}>
                    Round 2
                  </span>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:500, letterSpacing:'0.1em', textTransform:'uppercase' as const, padding:'5px 12px', borderRadius:100, background:'#fef3c7', color:'#92400e', border:'1px solid #fde68a', whiteSpace:'nowrap' as const }}>
                    ⚠ Monitoring Active
                  </span>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:500, letterSpacing:'0.1em', textTransform:'uppercase' as const, padding:'5px 12px', borderRadius:100, background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0', whiteSpace:'nowrap' as const }}>
                    📷 Camera Proctored
                  </span>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:500, letterSpacing:'0.1em', textTransform:'uppercase' as const, padding:'5px 12px', borderRadius:100, background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0', whiteSpace:'nowrap' as const }}>
                    📝 Follow-Up Questions
                  </span>
                  {examSecondsLeft !== null && (
                    <span style={{
                      fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:700,
                      letterSpacing:'0.1em', textTransform:'uppercase' as const,
                      padding:'5px 12px', borderRadius:100, whiteSpace:'nowrap' as const,
                      background: examSecondsLeft <= 60 ? 'rgba(220,38,38,0.1)' : examSecondsLeft <= 300 ? 'rgba(217,119,6,0.1)' : 'rgba(2,132,199,0.08)',
                      color: examSecondsLeft <= 60 ? '#dc2626' : examSecondsLeft <= 300 ? '#d97706' : '#0284c7',
                      border: `1px solid ${examSecondsLeft <= 60 ? 'rgba(220,38,38,0.3)' : examSecondsLeft <= 300 ? 'rgba(217,119,6,0.3)' : 'rgba(2,132,199,0.2)'}`,
                      animation: examSecondsLeft <= 60 ? 'timerPulse 1s ease-in-out infinite' : 'none',
                    }}>
                      ⏱ {examSecondsLeft <= 0 ? 'Time up!' : formatCountdown(examSecondsLeft)}
                    </span>
                  )}
                </div>
              </div>
              {/* Voice-mode students can switch back to the voice call UI */}
              {selectedMode === 'voice' && (
                <button
                  type="button"
                  onClick={() => { stopDictation(); stopTTS(); setVoiceMode(true); }}
                  style={{
                    display:'flex', alignItems:'center', gap:8, padding:'10px 18px',
                    background:'#0f172a', color:'white', border:'none', borderRadius:14,
                    fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700,
                    letterSpacing:'0.06em', textTransform:'uppercase' as const,
                    cursor:'pointer', whiteSpace:'nowrap' as const, flexShrink:0,
                    transition:'background 0.15s', boxShadow:'0 4px 12px rgba(0,0,0,0.15)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#0f172a')}
                >
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a3 3 0 003-3V7a3 3 0 00-6 0v4a3 3 0 003 3zm7-3a7 7 0 01-14 0m7 7v3m-4 0h8" />
                  </svg>
                  Switch to Voice
                </button>
              )}
            </div>

            {/* Progress */}
            <div style={{ background:'white', border:'1px solid #f1f5f9', borderRadius:20, padding:'16px 20px', marginBottom:16, display:'flex', alignItems:'center', gap:16, flexShrink:0 }}>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'#94a3b8', letterSpacing:'0.08em', whiteSpace:'nowrap' as const }}>Progress</span>
              <div style={{ flex:1, height:4, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:'100%', background:'linear-gradient(90deg,#0284c7,#38bdf8)', borderRadius:4, width:`${r2Progress}%`, transition:'width 0.5s cubic-bezier(0.4,0,0.2,1)', boxShadow:'0 0 8px rgba(2,132,199,0.4)' }} />
              </div>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'#0284c7', fontWeight:500, whiteSpace:'nowrap' as const }}>{r2Answered} / {followUpQuestions.length} answered</span>
            </div>

            <div style={{ flex:1, overflowY:'auto', paddingBottom:40 }}>
            {/* Questions */}
            {followUpQuestions.map((q, i) => {
              const hasAnswer = !!(followUpAnswers[i] && followUpAnswers[i].trim().length > 0);
              const isListeningHere = listeningIdx === i;
              return (
                <div key={i} className={`r2-card ${hasAnswer ? 'answered' : ''}`}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:0 }}>
                    <span style={{
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                      width:28, height:28, borderRadius:10, flexShrink:0, marginRight:12,
                      fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:500,
                      background: hasAnswer ? 'rgba(2,132,199,0.08)' : '#f8fafc',
                      border: `1px solid ${hasAnswer ? 'rgba(2,132,199,0.3)' : '#e2e8f0'}`,
                      color: hasAnswer ? '#0284c7' : '#64748b',
                    }}>{i + 1}</span>
                    <p style={{ fontSize:15, fontWeight:600, color:'#1e293b', lineHeight:1.5, flex:1, margin:0 }}>{q}</p>
                    {/* TTS read-aloud button */}
                    {ttsSupported && (
                      <button
                        type="button"
                        onClick={() => {
                          if (speakingIdx === i) { stopTTS(); return; }
                          stopTTS();
                          try {
                            const utter = new (window as any).SpeechSynthesisUtterance(q);
                            utter.lang = 'en-US'; utter.rate = 1; utter.pitch = 1;
                            utter.onend = () => setSpeakingIdx(null);
                            utter.onerror = () => setSpeakingIdx(null);
                            setSpeakingIdx(i);
                            window.speechSynthesis.speak(utter);
                          } catch { stopTTS(); }
                        }}
                        style={{ width:36, height:36, borderRadius:12, border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, background: speakingIdx === i ? '#fef2f2' : '#f8fafc', marginLeft:10, transition:'background 0.15s' }}
                      >
                        {speakingIdx === i ? (
                          <svg width="16" height="16" fill="none" stroke="#ef4444" viewBox="0 0 24 24" strokeWidth="2.5">
                            <rect x="6" y="6" width="4" height="12" rx="1" fill="#ef4444" stroke="none"/>
                            <rect x="14" y="6" width="4" height="12" rx="1" fill="#ef4444" stroke="none"/>
                          </svg>
                        ) : (
                          <svg width="16" height="16" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5l-4 4H4v6h3l4 4V5z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a4 4 0 010 7"/>
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  <div style={{ position:'relative' }}>
                    <textarea
                      className="r2-textarea"
                      placeholder="Type your answer here…"
                      value={followUpAnswers[i] || ''}
                      onBlur={() => {
                        const current = followUpAnswers[i] || '';
                        // Take snapshot on first blur so we have a baseline for edit detection
                        if (voiceSnapshotRef.current[activeAsgn.questions.length + i] === undefined) {
                          voiceSnapshotRef.current[activeAsgn.questions.length + i] = current;
                        }
                        if (current.trim().length > 0) {
                          blurTimeRef.current[activeAsgn.questions.length + i] = Date.now();
                        }
                      }}
                      onChange={e => {
                        const n = [...followUpAnswers]; n[i] = e.target.value; setFollowUpAnswers(n);

                        //  Edit-flag tracking (same logic as Round 1) 
                        const fuIdx = activeAsgn.questions.length + i;
                        if (replacedLockedRef.current[fuIdx]) return;
                        //voice ans stored
                        const snapshot = voiceSnapshotRef.current[fuIdx];
                        if (snapshot !== undefined && snapshot.trim().length > 0) {
                          //students new ans
                          const newVal = e.target.value.trim();
                          //students old ans for similarity check
                          const oldVal = snapshot.trim();
                          //if the text is changed now check for time away
                          if (newVal !== oldVal) {
                            setAnswerEditFlags(prev => {
                              const flags = [...prev];
                              //check how long the student was away
                              const blurredAt = blurTimeRef.current[fuIdx];
                              const awayMs = blurredAt ? Date.now() - blurredAt : 0;
                              //more than 30sec is abnormal so check further using both rules
                              const wasAwayLong = awayMs >= 30000;
                              //check word similarity
                              //split sentences into words
                              const oldWords = new Set(oldVal.toLowerCase().split(/\s+/).filter(Boolean));
                              const newWords = newVal.toLowerCase().split(/\s+/).filter(Boolean);
                              //count the length to check how many words are same
                              const overlap = newWords.filter((w: string) => oldWords.has(w)).length;
                              //convert to ratio e.g old words =5 and words matched 4 so 1 new word was added by the student 
                              //so now ration is 4/5 =0.8 (words similar)/old sentence len
                              //checking if its an edit or complete rewrite
                              //if there are no words in the answer box before and now there are then =1 meaning 100% rewritten answer
                              const overlapRatio = oldWords.size > 0 ? overlap / oldWords.size : 1;
                              //it means nothing matched so they chnage the entire answer
                              //4/6=0.66 means 66% of the answer is same and here checking if the student kept less than 15% of the original ans
                              const wordsRewritten = overlapRatio < 0.15;
                              //now checkign did the student change more than half of the ans
                              //4/6=0.66 0.66<0.5 no it means this is not a significant change hence its normal editing
                              const significantChange = overlapRatio < 0.5;
                              const isReplaced = wordsRewritten || (wasAwayLong && significantChange);
                              if (isReplaced) replacedLockedRef.current[fuIdx] = true;
                              flags[fuIdx] = isReplaced ? 'replaced' : 'edited';
                              return flags;
                            });
                          } else {
                            setAnswerEditFlags(prev => { const f = [...prev]; f[fuIdx] = 'none'; return f; });
                          }
                        }
                      }}
                    />
                    {answerEditFlags[activeAsgn.questions.length + i] === 'edited' && (
                      <span style={{ display:'inline-block', marginTop:6, fontSize:11, fontStyle:'italic', color:'#94a3b8', fontFamily:"'IBM Plex Mono',monospace" }}>
                        edited
                      </span>
                    )}
                    {answerEditFlags[activeAsgn.questions.length + i] === 'replaced' && (
                      <span style={{ display:'inline-block', marginTop:6, fontSize:11, fontStyle:'italic', color:'#ef4444', fontFamily:"'IBM Plex Mono',monospace" }}>
                        edited
                      </span>
                    )}
                  </div>
                  {/* Voice dictation button — only shown when student chose Voice mode */}
                  {speechSupported && selectedMode === 'voice' && (
                    <button
                      type="button"
                      className={`r2-mic-btn ${isListeningHere ? 'listening' : ''}`}
                      onClick={() => {
                        if (isListeningHere) {
                          stopDictation();
                        } else {
                          // Use startDictation but write to followUpAnswers instead of answers
                          // We reuse the same dictation engine, pointing at a temporary index
                          // by briefly swapping answers context. Instead, invoke directly:
                          stopDictation();
                          (async () => {
                            try {
                              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                              const mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg' });
                              mediaRecorderRef.current = mediaRecorder;
                              audioChunksRef.current = [];
                              setListeningIdx(i);
                              mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
                              mediaRecorder.onstop = async () => {
                                stream.getTracks().forEach(t => t.stop());
                                const blob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0]?.type || 'audio/webm' });
                                audioChunksRef.current = [];
                                setIsTranscribing(true);
                                try {
                                  const formData = new FormData();
                                  formData.append('file', blob, 'audio.webm');
                                  formData.append('model', 'whisper-1');
                                  formData.append('language', 'en');
                                  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${(window as any).__OPENAI_KEY__ || ''}` },
                                    body: formData,
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    const transcript = (data.text || '').trim();
                                    if (transcript) {
                                      setFollowUpAnswers(prev => { const n=[...prev]; n[i]=((n[i]||'').trim()+' '+transcript).trim(); return n; });
                                    }
                                  } else { throw new Error('Whisper failed'); }
                                } catch {
                                  // Fallback to browser STT
                                  if (SpeechRecognitionCtor) {
                                    const rec = new SpeechRecognitionCtor();
                                    recognitionRef.current = rec;
                                    rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = true;
                                    const base = (followUpAnswers[i] || '').trim();
                                    dictationRef.current = { index: i, base, final: '' };
                                    setListeningIdx(i);
                                    rec.onresult = (event: any) => {
                                      if (!dictationRef.current) return;
                                      let interim='', finalChunk='';
                                      for (let j=event.resultIndex; j<event.results.length; j++) {
                                        const t=(event.results[j][0]?.transcript||'').trim();
                                        if (event.results[j].isFinal) finalChunk+=' '+t; else interim+=' '+t;
                                      }
                                      if (finalChunk) dictationRef.current.final=(dictationRef.current.final+finalChunk).trim();
                                      const combined=`${dictationRef.current.base} ${dictationRef.current.final} ${interim}`.replace(/\s+/g,' ').trim();
                                      setFollowUpAnswers(prev => { const n=[...prev]; n[i]=combined; return n; });
                                    };
                                    rec.onend = () => {
                                      if (dictationRef.current) {
                                        const ft=`${dictationRef.current.base} ${dictationRef.current.final}`.replace(/\s+/g,' ').trim();
                                        setFollowUpAnswers(prev => { const n=[...prev]; n[i]=ft; return n; });
                                      }
                                      recognitionRef.current=null; dictationRef.current=null; setListeningIdx(null);
                                    };
                                    rec.onerror = () => stopDictation();
                                    try { rec.start(); } catch { stopDictation(); }
                                  }
                                } finally {
                                  setIsTranscribing(false);
                                }
                              };
                              mediaRecorder.start(250);
                            } catch (err: any) {
                              if (err?.name === 'NotAllowedError') alert('Microphone permission denied.');
                            }
                          })();
                        }
                      }}
                    >
                      {isTranscribing && isListeningHere ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                      ) : isListeningHere ? (
                        <svg width="14" height="14" fill="none" stroke="#15803d" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>
                      ) : (
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 14a3 3 0 003-3V7a3 3 0 00-6 0v4a3 3 0 003 3zm7-3a7 7 0 01-14 0m7 7v3m-4 0h8"/></svg>
                      )}
                      <span>
                        {isTranscribing && isListeningHere ? 'Transcribing…' : isListeningHere ? 'Stop recording' : 'Speak answer'}
                      </span>
                    </button>
                  )}
                  {selectedMode === 'voice' && isListeningHere && !isTranscribing && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#15803d', letterSpacing:'0.1em', textTransform:'uppercase' as const }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:'#15803d', display:'inline-block', animation:'blink 1s ease-in-out infinite' }} />
                      Recording…
                    </div>
                  )}
                </div>
              );
            })}

            <button
              className="r2-submit-btn"
              onClick={() => handleConfirmSubmit()}
              disabled={!allAnswered}
            >
              {allAnswered ? 'Finalize & Submit Final Exam' : `Answer all questions to submit (${followUpQuestions.length - r2Answered} remaining)`}
            </button>
            </div>{/* end scrollable questions area */}
          </div>{/* end r2-main */}

          {/* ── Camera sidebar ── */}
          <div className="r2-cam-sidebar">
            <div className="r2-cam-feed-wrap">
              <video ref={videoRef} autoPlay muted playsInline style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)' }} />
              <div style={{ position:'absolute', top:8, left:8, display:'flex', alignItems:'center', gap:5, background:'rgba(0,0,0,0.62)', borderRadius:8, padding:'4px 10px' }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444', boxShadow:'0 0 6px rgba(239,68,68,0.9)', animation:'r2CamBlink 1.2s ease-in-out infinite' }} />
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:'rgba(255,255,255,0.8)', letterSpacing:'0.08em' }}>PROCTORED</span>
              </div>
              <div style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.62)', borderRadius:8, padding:'4px 10px' }}>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color: lookAwaySeconds > 0 ? '#f59e0b' : '#22c55e' }}>
                  {lookAwaySeconds > 0 ? '👁 Away' : '👁 On-screen'}
                </span>
              </div>
            </div>

            <div className="r2-cam-student-card">
              <p style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:'#94a3b8', textTransform:'uppercase' as const, letterSpacing:'0.1em', margin:'0 0 2px' }}>Student</p>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:700, color:'#1e293b', margin:0 }}>{userName}</p>
            </div>

            {videoViolations.length > 0 && (
              <div className="r2-cam-viol-log">
                <p style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:'rgba(239,68,68,0.7)', textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:5 }}>
                  Flags ({videoViolations.length})
                </p>
                {[...videoViolations].reverse().map((v, i) => (
                  <p key={i} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'#dc2626', margin:'2px 0' }}>⚠ {v}</p>
                ))}
              </div>
            )}
          </div>{/* end r2-cam-sidebar */}
        </div>{/* end r2-page */}

        {/* Review modal for Round 2 */}
        {showReviewModal && activeAsgn && (
          <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(4px)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
            <div style={{ background:'white', borderRadius:28, padding:'36px 36px 28px', maxWidth:600, width:'100%', maxHeight:'80vh', overflowY:'auto', boxShadow:'0 32px 80px rgba(0,0,0,0.25)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
                <div style={{ width:44, height:44, borderRadius:14, background:'#4f46e5', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="22" height="22" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h2 style={{ fontFamily:"'Inter',sans-serif", fontSize:18, fontWeight:800, color:'#0f172a', margin:0 }}>Review Follow-Up Answers</h2>
                  <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94a3b8', margin:'4px 0 0' }}>Final check before submitting — you cannot change answers after this.</p>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:28 }}>
                {followUpQuestions.map((q, i) => (
                  <div key={i} style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:16, padding:'16px 18px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:700, color:'#d97706', background:'#fef3c7', border:'1px solid #fde68a', borderRadius:8, padding:'2px 8px' }}>FU{i+1}</span>
                      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, color:'#1e293b', margin:0, flex:1 }}>{q}</p>
                    </div>
                    <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color: followUpAnswers[i]?.trim() ? '#334155' : '#cbd5e1', fontStyle: followUpAnswers[i]?.trim() ? 'normal' : 'italic', margin:0, lineHeight:1.6 }}>
                      {followUpAnswers[i]?.trim() || 'No answer provided'}
                    </p>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:12 }}>
                <button onClick={() => setShowReviewModal(false)} style={{ flex:1, padding:'14px', background:'#f1f5f9', border:'none', borderRadius:16, fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:700, color:'#64748b', cursor:'pointer' }}>← Go Back</button>
                <button onClick={handleConfirmSubmit} style={{ flex:2, padding:'14px', background:'linear-gradient(135deg,#0284c7,#0369a1)', border:'none', borderRadius:16, fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:800, color:'white', cursor:'pointer', boxShadow:'0 6px 20px rgba(2,132,199,0.35)' }}>Confirm &amp; Submit</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ********************************MODE SELECTION + CONSENT MODAL *******************************************
  if (activeAsgn && !examStarted) {
    //const modes = (activeAsgn as any).allowedModes || ['text', 'voice'];
    //TESTING***
    const modes = ['text', 'voice'];
    //END
    const modeInfo: Record<string, { icon: string; label: string; desc: string; color: string }> = {
      text:  { icon: '⌨️', label: 'Text Mode',  desc: 'Type your answers. Camera + tab switching are monitored.',             color: '#0284c7' },
      voice: { icon: '🎙️', label: 'Voice Mode',  desc: 'Speak your answers via microphone. Camera + AI transcription.',        color: '#0369a1' },
    };

    return (
      <>
        <style>{studentBgStyles}</style>
        <AnimatedBg />      
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', padding:24, position:'relative', zIndex:1 }}>
          <div style={{ maxWidth:520, width:'100%', background:'rgba(255,255,255,0.92)', backdropFilter:'blur(18px)', borderRadius:32, padding:40, boxShadow:'0 20px 60px rgba(0,0,0,0.08)', border:'1px solid rgba(2,132,199,0.15)' }}>
            {/* Header */}
            <div style={{ textAlign:'center', marginBottom:32 }}>
              <div style={{ width:56, height:56, background:'#0284c7', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <svg width="28" height="28" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 style={{ fontFamily:"'Inter',sans-serif", fontSize:22, fontWeight:800, color:'#0f172a', marginBottom:6 }}>{activeAsgn.name}</h2>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#94a3b8', fontWeight:500 }}>
                {activeAsgn.questions.length} question{activeAsgn.questions.length !== 1 ? 's' : ''} · Select your viva mode to begin
              </p>
              {(activeAsgn as any).timeLimitMinutes && (
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:10, padding:'6px 14px', background:'rgba(2,132,199,0.08)', border:'1px solid rgba(2,132,199,0.2)', borderRadius:999 }}>
                  <svg width={12} height={12} fill="none" stroke="#0284c7" viewBox="0 0 24 24" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700, color:'#0284c7', letterSpacing:'0.06em' }}>
                    {(activeAsgn as any).timeLimitMinutes >= 60
                      ? `${Math.floor((activeAsgn as any).timeLimitMinutes/60)}h${(activeAsgn as any).timeLimitMinutes%60>0?` ${(activeAsgn as any).timeLimitMinutes%60}m`:''}`
                      : `${(activeAsgn as any).timeLimitMinutes} min`} time limit starts when you begin
                  </span>
                </div>
              )}
            </div>

            {/* Time limit notice — shown prominently before exam starts */}
            {(activeAsgn as any).timeLimitMinutes && (() => {
              const mins = (activeAsgn as any).timeLimitMinutes;
              const formatted = mins >= 60
                ? `${Math.floor(mins/60)}h${mins%60>0?` ${mins%60}m`:''}`
                : `${mins} min`;
              return (
                <div style={{ background:'linear-gradient(135deg,rgba(220,38,38,0.07),rgba(220,38,38,0.04))', border:'1.5px solid rgba(220,38,38,0.25)', borderRadius:16, padding:'16px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:'rgba(220,38,38,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width={20} height={20} fill="none" stroke="#dc2626" viewBox="0 0 24 24" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>
                  </div>
                  <div>
                    <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:800, color:'#dc2626', margin:'0 0 2px' }}>
                      ⏱ {formatted} total — shared across both rounds
                    </p>
                    <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#7f1d1d', margin:0, lineHeight:1.5 }}>
                      Your teacher has set a <strong>{formatted}</strong> time limit for this viva. The timer runs continuously across Round 1 and Round 2 combined. It starts the moment you click Begin.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Mode buttons */}
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:28 }}>
              {modes.map((m: string) => {
                const info = modeInfo[m];
                if (!info) return null;
                const isSelected = selectedMode === m;
                return (
                  <button
                    key={m}
                    onClick={() => setSelectedMode(m as any)}
                    style={{
                      display:'flex', alignItems:'center', gap:16, padding:'16px 20px',
                      background: isSelected ? '#eef2ff' : '#f8fafc',
                      border: `2px solid ${isSelected ? info.color : '#f1f5f9'}`,
                      borderRadius:18, cursor:'pointer', textAlign:'left', transition:'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize:28 }}>{info.icon}</span>
                    <div style={{ flex:1 }}>
                      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:700, color:'#1e293b', margin:0 }}>{info.label}</p>
                      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94a3b8', margin:'2px 0 0' }}>{info.desc}</p>
                    </div>
                    {isSelected && (
                      <div style={{ width:22, height:22, borderRadius:'50%', background:info.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <svg width="12" height="12" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Consent notice — always shown */}
            <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:14, padding:'14px 18px', marginBottom:24 }}>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#c2410c', marginBottom:6 }}>
                🔒 Session Monitoring Notice
              </p>
              <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#92400e', lineHeight:1.8 }}>
                {selectedMode === 'voice' ? (
                  <>
                    <p style={{ margin:'0 0 8px 0' }}>Your camera will be used for live proctoring and your microphone for answer transcription.</p>
                    <p style={{ margin:0 }}>By proceeding, you consent to this live monitoring.</p>
                  </>
                ) : (
                  <>
                    <p style={{ margin:'0 0 8px 0' }}>Your camera will be used for live proctoring during this session.</p>
                    <p style={{ margin:0 }}>By proceeding, you consent to this monitoring.</p>
                  </>
                )}
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:10, marginTop:12, cursor:'pointer' }}>
                <input type="checkbox" checked={consentGiven} onChange={e => setConsentGiven(e.target.checked)}
                  style={{ width:16, height:16, accentColor:'#c2410c', cursor:'pointer' }} />
                <span style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, color:'#92400e' }}>
                  I understand and consent to the live monitoring of this session
                </span>
              </label>
            </div>

            <button
              disabled={!selectedMode || !consentGiven}
              onClick={() => {
                if (!selectedMode || !consentGiven) return;
                startExam();
              }}
              style={{
                width:'100%', padding:'16px', borderRadius:18,
                border: selectedMode && consentGiven ? 'none' : '1.5px solid #cbd5e1',
                cursor: selectedMode && consentGiven ? 'pointer' : 'not-allowed',
                background: selectedMode && consentGiven
                  ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                  : 'rgba(241,245,249,0.95)',
                color: selectedMode && consentGiven ? 'white' : '#94a3b8',
                fontFamily:"'Inter',sans-serif", fontSize:15, fontWeight:800,
                boxShadow: selectedMode && consentGiven ? '0 8px 24px rgba(2,132,199,0.35)' : 'none',
                transition:'all 0.2s',
              }}
            >
              {selectedMode && consentGiven
                ? `Begin  ${modeInfo[selectedMode]?.label || ''}`
                : !selectedMode
                  ? 'Select a mode to continue'
                  : 'Check the consent box to continue'}
            </button>
          </div>
        </div>
      </>

    );
  }

  // ─── TEXT MODE (exam form) ────────────────────────────────────────────────
  if (activeAsgn && examStarted && !voiceMode) {
    const answeredCount = answers.filter(a => a && a.trim().length > 0).length;
    const examProgress = (answeredCount / activeAsgn.questions.length) * 100;

    return (
      <>
        <style>{studentBgStyles}</style>
        <AnimatedBg />      
        {/* Hidden canvas for frame capture (camera proctoring) */}
        <canvas ref={videoCanvasRef} style={{ display: 'none' }} />

        {/* ── Violation banner ── */}
        {showViolationBanner && (
          <div style={{
            position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 300, background: 'rgba(220,38,38,0.92)', border: '1px solid rgba(239,68,68,0.5)',
            borderRadius: 12, padding: '10px 20px',
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'white',
            letterSpacing: '0.05em', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
          }}>
            ⚠ {showViolationBanner}
          </div>
        )}

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');

          .exam-page {
            display: flex;
            align-items: flex-start;
            gap: 32px;
            /* Break out of Layout main padding (24px top, 32px sides) and use full remaining height */
            margin: -24px -32px 0;
            padding: 32px 32px 0;
            box-sizing: border-box;
            height: calc(100vh - 65px);
            position: relative;
            z-index: 1;
            overflow: hidden;
          }

          .exam-wrap {
            font-family: 'Inter', sans-serif;
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
          }

          .exam-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 32px;
            flex-shrink: 0;
          }

          .exam-title {
            font-size: 28px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.02em;
            line-height: 1.1;
          }

          .exam-meta {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 8px;
          }

          .exam-meta-chip {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 10px;
            font-weight: 500;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            padding: 5px 12px;
            border-radius: 100px;
          }

          .chip-monitor {
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fde68a;
          }

          .chip-nospeech {
            background: #f1f5f9;
            color: #64748b;
            border: 1px solid #e2e8f0;
          }

          .voice-call-btn {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 20px;
            background: #0f172a;
            color: white;
            border: none;
            border-radius: 16px;
            font-family: 'Inter', sans-serif;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            cursor: pointer;
            transition: background 0.15s, transform 0.1s;
            white-space: nowrap;
            flex-shrink: 0;
          }

          .voice-call-btn:hover { background: #1e293b; transform: translateY(-1px); }
          .voice-call-btn:active { transform: translateY(0); }

          .voice-call-btn-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #6366f1;
            box-shadow: 0 0 8px rgba(99,102,241,0.8);
            animation: pulse-dot 2s ease-in-out infinite;
          }

          .exam-progress-wrap {
            background: rgba(255,255,255,0.88);
            backdrop-filter: blur(18px);
            border: 1px solid #f1f5f9;
            border-radius: 20px;
            padding: 16px 20px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 16px;
            flex-shrink: 0;
          }

          .exam-progress-label {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            color: #94a3b8;
            letter-spacing: 0.08em;
            white-space: nowrap;
          }

          .exam-progress-track {
            flex: 1;
            height: 4px;
            background: #f1f5f9;
            border-radius: 4px;
            overflow: hidden;
          }

          .exam-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #0284c7, #38bdf8);
            border-radius: 4px;
            transition: width 0.5s cubic-bezier(0.4,0,0.2,1);
            box-shadow: 0 0 8px rgba(2,132,199,0.4);
          }

          .exam-progress-count {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            color: #0284c7;
            font-weight: 500;
            white-space: nowrap;
          }

          .q-card-exam {
            background: rgba(255,255,255,0.82);
            backdrop-filter: blur(18px);         
            border: 1px solid #f1f5f9;
            border-radius: 24px;
            padding: 28px;
            margin-bottom: 16px;
            transition: border-color 0.2s, box-shadow 0.2s;
            position: relative;
          }

          .q-card-exam:focus-within {
            border-color: rgba(2,132,199,0.4);
            box-shadow: 0 0 0 4px rgba(2,132,199,0.06), 0 4px 20px rgba(0,0,0,0.04);
          }

          .q-card-exam.answered {
            border-color: rgba(2,132,199,0.2);
          }

          .q-num-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            font-weight: 500;
            color: #64748b;
            flex-shrink: 0;
            margin-right: 12px;
          }

          .q-num-badge.answered {
            background: rgba(2,132,199,0.08);
            border-color: rgba(2,132,199,0.3);
            color: #0284c7;
          }

          .q-text {
            font-size: 15px;
            font-weight: 600;
            color: #1e293b;
            line-height: 1.5;
            flex: 1;
          }

          .q-tts-btn {
            width: 36px;
            height: 36px;
            border-radius: 12px;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            flex-shrink: 0;
            transition: background 0.15s, transform 0.1s;
          }

          .q-tts-btn:hover { transform: scale(1.08); }
          .q-tts-btn.idle { background: #f8fafc; }
          .q-tts-btn.speaking { background: #fef2f2; }

          .q-textarea {
            width: 100%;
            margin-top: 16px;
            padding: 16px 16px 16px 16px;
            background: #f8fafc;
            border: 1.5px solid #f1f5f9;
            border-radius: 16px;
            outline: none;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            font-weight: 400;
            color: #1e293b;
            min-height: 120px;
            resize: vertical;
            transition: border-color 0.2s, box-shadow 0.2s;
            line-height: 1.6;
            box-sizing: border-box;
          }

          .q-textarea:focus {
            border-color: rgba(2,132,199,0.5);
            box-shadow: 0 0 0 3px rgba(2,132,199,0.08);
            background: white;
          }

          .q-listening-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-family: 'IBM Plex Mono', monospace;
            font-size: 10px;
            font-weight: 500;
            color: #ef4444;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            margin-top: 8px;
          }

          .q-listening-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #ef4444;
            animation: blink 1s ease-in-out infinite;
          }

          .exam-submit-btn {
            width: 100%;
            padding: 18px;
            background: linear-gradient(135deg, #0284c7, #0369a1);
            color: white;
            border: none;
            border-radius: 20px;
            font-family: 'Inter', sans-serif;
            font-size: 15px;
            font-weight: 800;
            letter-spacing: 0.04em;
            cursor: pointer;
            margin-top: 8px;
            box-shadow: 0 8px 30px rgba(2,132,199,0.35);
            transition: transform 0.15s, box-shadow 0.15s;
          }

          .exam-submit-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(2,132,199,0.45);
          }

          .exam-submit-btn:active { transform: translateY(0); }

          .exam-cam-sidebar {
            position: sticky;
            top: 40px;
            align-self: flex-start;
            flex-shrink: 0;
            width: 240px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .exam-cam-feed-wrap {
            width: 100%;
            aspect-ratio: 4/3;
            border-radius: 18px;
            overflow: hidden;
            border: 1.5px solid #e2e8f0;
            background: #0a0a0f;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12);
            position: relative;
          }

          .exam-cam-student-card {
            background: white;
            border: 1px solid #f1f5f9;
            border-radius: 14px;
            padding: 10px 16px;
            text-align: center;
            box-shadow: 0 2px 12px rgba(0,0,0,0.05);
          }

          .exam-cam-viol-log {
            background: #fff5f5;
            border: 1px solid #fecaca;
            border-radius: 14px;
            padding: 10px 14px;
            max-height: 100px;
            overflow-y: auto;
          }

          @keyframes camBlink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        `}</style>

        <div className="exam-page">
          <div className="exam-wrap no-print">
          <div className="exam-header">
            <div>
              <h2 className="exam-title">{activeAsgn.name}</h2>
              <div className="exam-meta">
                <span className="exam-meta-chip chip-monitor">⚠ Monitoring Active</span>
                <span className="exam-meta-chip chip-nospeech">📷 Camera Proctored</span>
                {examSecondsLeft !== null && (
                  <span className="exam-meta-chip" style={{
                    background: examSecondsLeft <= 60 ? 'rgba(220,38,38,0.1)' : examSecondsLeft <= 300 ? 'rgba(217,119,6,0.1)' : 'rgba(2,132,199,0.08)',
                    color: examSecondsLeft <= 60 ? '#dc2626' : examSecondsLeft <= 300 ? '#d97706' : '#0284c7',
                    border: `1px solid ${examSecondsLeft <= 60 ? 'rgba(220,38,38,0.3)' : examSecondsLeft <= 300 ? 'rgba(217,119,6,0.3)' : 'rgba(2,132,199,0.2)'}`,
                    fontFamily:"'IBM Plex Mono',monospace", fontWeight: 700,
                    animation: examSecondsLeft <= 60 ? 'timerPulse 1s ease-in-out infinite' : 'none',
                  }}>
                    ⏱ {examSecondsLeft <= 0 ? 'Time up!' : formatCountdown(examSecondsLeft)}
                  </span>
                )}
              </div>
            </div>
            {/* Only original voice-mode students can switch back to voice */}
            {selectedMode === 'voice' && (
            <button
              type="button"
              onClick={() => { stopDictation(); stopTTS(); setVoiceMode(true); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px',
                background: '#0f172a',
                color: 'white',
                border: 'none',
                borderRadius: 14,
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                cursor: 'pointer',
                whiteSpace: 'nowrap' as const,
                flexShrink: 0,
                transition: 'background 0.15s, transform 0.1s',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
              onMouseLeave={e => (e.currentTarget.style.background = '#0f172a')}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a3 3 0 003-3V7a3 3 0 00-6 0v4a3 3 0 003 3zm7-3a7 7 0 01-14 0m7 7v3m-4 0h8" />
              </svg>
              Switch to Voice
            </button>
            )}
          </div>

          <div style={{ flex:1, overflowY:'auto', paddingBottom:40 }}>
          <div className="exam-progress-wrap">
            <span className="exam-progress-label">Progress</span>
            <div className="exam-progress-track">
              <div className="exam-progress-fill" style={{ width: `${examProgress}%` }} />
            </div>
            <span className="exam-progress-count">{answeredCount} / {activeAsgn.questions.length} answered</span>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            {activeAsgn.questions.map((q, i) => {
              const hasAnswer = !!(answers[i] && answers[i].trim().length > 0);
              return (
                <div key={q.id} className={`q-card-exam ${hasAnswer ? 'answered' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                    <span className={`q-num-badge ${hasAnswer ? 'answered' : ''}`}>{i + 1}</span>
                    <p className="q-text">{q.question}</p>
                    {ttsSupported && (
                      <button
                        type="button"
                        onClick={() => speakQuestion(i)}
                        title={speakingIdx === i ? 'Stop audio' : 'Read aloud'}
                        className={`q-tts-btn ${speakingIdx === i ? 'speaking' : 'idle'}`}
                        style={{ marginLeft: 10 }}
                      >
                        {speakingIdx === i ? (
                          <svg width="16" height="16" fill="none" stroke="#ef4444" viewBox="0 0 24 24" strokeWidth="2.5">
                            <rect x="6" y="6" width="4" height="12" rx="1" fill="#ef4444" stroke="none"/>
                            <rect x="14" y="6" width="4" height="12" rx="1" fill="#ef4444" stroke="none"/>
                          </svg>
                        ) : (
                          <svg width="16" height="16" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5l-4 4H4v6h3l4 4V5z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a4 4 0 010 7"/>
                          </svg>
                        )}
                      </button>
                    )}
                  </div>

                  {ttsSupported && speakingIdx === i && (
                    <div className="q-listening-label" style={{ marginTop: 8 }}>
                      <span className="q-listening-dot" /> Speaking — click to stop
                    </div>
                  )}

                  <div style={{ position: 'relative' }}>
                    <textarea
                      className="q-textarea"
                      required
                      placeholder="Type your answer here…"
                      value={answers[i] || ''}
                      onBlur={() => {
                        const current = answers[i] || '';
                        // First blur — take snapshot of the original answer
                        if (voiceSnapshotRef.current[i] === undefined) {
                          voiceSnapshotRef.current[i] = current;
                        }
                        // Record the time the student left this field (only if they had typed something)
                        if (current.trim().length > 0) {
                          blurTimeRef.current[i] = Date.now();
                        }
                      }}
                      onChange={(e) => {
                        const next = [...answers];
                        next[i] = e.target.value;
                        setAnswers(next);

                        // Don't downgrade a question already locked as 'replaced'
                        if (replacedLockedRef.current[i]) return;

                        const snapshot = voiceSnapshotRef.current[i];
                        if (snapshot !== undefined && snapshot.trim().length > 0) {
                          const newVal = e.target.value.trim();
                          const oldVal = snapshot.trim();
                          if (newVal !== oldVal) {
                            setAnswerEditFlags(prev => {
                              const flags = [...prev];

                              // ── Time-away signal ──────────────────────────────
                              // If student was away from this field for 8+ seconds
                              // before coming back to edit, treat it as a replacement
                              // regardless of word overlap (they likely looked something up)
                              const blurredAt = blurTimeRef.current[i];
                              const awayMs = blurredAt ? Date.now() - blurredAt : 0;
                              const wasAwayLong = awayMs >= 30000;

                              // ── Word overlap signal ───────────────────────────
                              const oldWords = new Set(oldVal.toLowerCase().split(/\s+/).filter(Boolean));
                              const newWords = newVal.toLowerCase().split(/\s+/).filter(Boolean);
                              const overlap = newWords.filter(w => oldWords.has(w)).length;
                              const overlapRatio = oldWords.size > 0 ? overlap / oldWords.size : 1;
                              // 'replaced' only if almost nothing from the original remains (less than 15%)
                              const wordsRewritten = overlapRatio < 0.15;

                              // time away alone is NOT enough  student might just be reading other questions.
                              // Only use it as a signal when combined with significant content change (< 50% overlap)
                              const significantChange = overlapRatio < 0.5;
                              const isReplaced = wordsRewritten || (wasAwayLong && significantChange);
                              if (isReplaced) replacedLockedRef.current[i] = true;
                              flags[i] = isReplaced ? 'replaced' : 'edited';
                              return flags;
                            });
                          } else {
                            // student reverted to original — clear flag (unless already locked)
                            setAnswerEditFlags(prev => { const f = [...prev]; f[i] = 'none'; return f; });
                          }
                        }
                      }}
                    />
                    {/*  "Edited" label  shown only once, after voice→text switch and in text mode*/}
                    {answerEditFlags[i] === 'edited' && (
                      <span style={{ display:'inline-block', marginTop:6, fontSize:11, fontStyle:'italic', color:'#94a3b8', fontFamily:"'IBM Plex Mono',monospace" }}>
                        edited
                      </span>
                    )}
                    {answerEditFlags[i] === 'replaced' && (
                      <span style={{ display:'inline-block', marginTop:6, fontSize:11, fontStyle:'italic', color:'#ef4444', fontFamily:"'IBM Plex Mono',monospace" }}>
                        edited
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            <button type="submit" className="exam-submit-btn">
              Finalize &amp; Submit Round 1
            </button>
          </form>
          </div>{/* end scrollable questions area */}
        </div>{/* end exam-wrap */}

          {/* ── Camera sidebar ── */}
          <div className="exam-cam-sidebar">
            {/* Camera feed */}
            <div className="exam-cam-feed-wrap">
              <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.62)', borderRadius: 8, padding: '4px 10px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.9)', animation: 'camBlink 1.2s ease-in-out infinite' }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.08em' }}>PROCTORED</span>
              </div>
              <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.62)', borderRadius: 8, padding: '4px 10px' }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: lookAwaySeconds > 0 ? '#f59e0b' : '#22c55e' }}>
                  {lookAwaySeconds > 0 ? '👁 Away' : '👁 On-screen'}
                </span>
              </div>
            </div>

            {/* Student label */}
            <div className="exam-cam-student-card">
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.1em', margin: '0 0 2px' }}>Student</p>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, color: '#1e293b', margin: 0 }}>{userName}</p>
            </div>

            {/* Violation log */}
            {videoViolations.length > 0 && (
              <div className="exam-cam-viol-log">
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: 'rgba(239,68,68,0.7)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 5 }}>
                  Flags ({videoViolations.length})
                </p>
                {[...videoViolations].reverse().map((v, i) => (
                  <p key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#dc2626', margin: '2px 0' }}>⚠ {v}</p>
                ))}
              </div>
            )}
          </div>{/* end exam-cam-sidebar */}
        </div>{/* end exam-page */}

        {/* ── Review Modal ───────────────────────────────────────────────────── */}
        {showReviewModal && activeAsgn && (
          <div style={{
            position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(4px)',
            zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:24
          }}>
            <div style={{
              background:'white', borderRadius:28, padding:'36px 36px 28px', maxWidth:600, width:'100%',
              maxHeight:'80vh', overflowY:'auto', boxShadow:'0 32px 80px rgba(0,0,0,0.25)'
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
                <div style={{ width:44, height:44, borderRadius:14, background:'#4f46e5', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="22" height="22" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontFamily:"'Inter',sans-serif", fontSize:18, fontWeight:800, color:'#0f172a', margin:0 }}>Review Your Answers</h2>
                  <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94a3b8', margin:'4px 0 0' }}>Check everything before submitting — you cannot change answers after this.</p>
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:28 }}>
                {activeAsgn.questions.map((q, i) => (
                  <div key={q.id} style={{ background:'rgba(2,132,199,0.03)', border:'1px solid rgba(2,132,199,0.08)', borderRadius:18, padding:'18px 20px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:700, color:'#0284c7', background:'rgba(2,132,199,0.08)', border:'1px solid rgba(2,132,199,0.2)', borderRadius:8, padding:'2px 8px' }}>Q{i+1}</span>
                      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:600, color:'#1e293b', margin:0, flex:1 }}>{q.question}</p>
                    </div>
                    <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color: answers[i]?.trim() ? '#334155' : '#cbd5e1', fontStyle: answers[i]?.trim() ? 'normal' : 'italic', margin:'0 0 6px', lineHeight:1.6 }}>
                      {answers[i]?.trim() || 'No answer provided'}
                    </p>
                    {/* edit status badge */}
                    {answerEditFlags[i] === 'edited' && (
                      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontStyle:'italic', color:'#94a3b8' }}>edited</span>
                    )}
                    {answerEditFlags[i] === 'replaced' && (
                      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontStyle:'italic', color:'#ef4444' }}>edited</span>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', gap:12 }}>
                <button
                  onClick={() => setShowReviewModal(false)}
                  style={{ flex:1, padding:'14px', background:'#f1f5f9', border:'none', borderRadius:16, fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:700, color:'#64748b', cursor:'pointer' }}
                >
                  ← Go Back &amp; Edit
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  style={{ flex:2, padding:'14px', background:'linear-gradient(135deg,#0284c7,#0369a1)', border:'none', borderRadius:16, fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:800, color:'white', cursor:'pointer', boxShadow:'0 6px 20px rgba(2,132,199,0.35)' }}
                >
                  Confirm &amp; Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const gradedSubs = myAssignments
    .map(a => ({ a, sub: a.submissions.find(s => s.studentName === userName) }))
    .filter(({ sub }) => sub && sub.status === 'Graded');

  const avgScore = gradedSubs.length > 0
    ? gradedSubs.reduce((acc, { sub }) => {
        const s = (sub!.results?.reduce((r, b) => r + b.score, 0) || 0) / (sub!.results?.length || 1);
        return acc + s;
      }, 0) / gradedSubs.length
    : null;

  return (
    <>
      <style>{studentBgStyles}</style>
      <AnimatedBg />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');

        .dash-root {
          font-family: 'Inter', sans-serif;
          padding: 8px 0 60px;
          position: relative;
          z-index: 1;
        }

        .dash-welcome {
          background: linear-gradient(135deg, rgba(2,132,199,0.08) 0%, rgba(14,165,233,0.05) 100%);
          border-radius: 28px;
          padding: 36px 40px;
          margin-bottom: 36px;
          position: relative;
          overflow: hidden;
          border: 1.5px solid rgba(2,132,199,0.13);
          box-shadow: 0 8px 40px rgba(15,23,42,0.08);
          backdrop-filter: blur(18px);
        }

        .dash-welcome-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 50% 80% at 90% 50%, rgba(2,132,199,0.07) 0%, transparent 70%),
            radial-gradient(ellipse 30% 60% at 10% 50%, rgba(14,165,233,0.05) 0%, transparent 70%);
        }

        .dash-welcome-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(2,132,199,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(2,132,199,0.04) 1px, transparent 1px);
          background-size: 32px 32px;
        }

        .dash-welcome-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .dash-greeting {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: #64748b;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .dash-username {
          font-size: 32px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
          line-height: 1;
        }

        .dash-username span {
          background: linear-gradient(135deg, #0284c7, #0369a1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .dash-welcome-stats {
          display: flex;
          gap: 20px;
          flex-shrink: 0;
        }

        .dash-stat {
          text-align: center;
          background: rgba(255,255,255,0.6);
          border: 1px solid rgba(2,132,199,0.12);
          border-radius: 16px;
          padding: 14px 20px;
          min-width: 80px;
        }

        .dash-stat-val {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1;
        }

        .dash-stat-val.indigo { color: #0284c7; }

        .dash-stat-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          color: #94a3b8;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-top: 4px;
        }

        .dash-section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .dash-section-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #94a3b8;
        }

        .dash-section-line {
          flex: 1;
          height: 1px;
          background: rgba(2,132,199,0.1);
        }

        .asgn-card {
           background: rgba(255,255,255,0.82);
          backdrop-filter: blur(18px);
          border: 1px solid #f1f5f9;
          border-radius: 24px;
          padding: 24px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
          position: relative;
          overflow: hidden;
        }

        .asgn-card::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: linear-gradient(to bottom, #0284c7, #38bdf8);
          border-radius: 3px 0 0 3px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .asgn-card:hover {
          border-color: rgba(2,132,199,0.2);
          box-shadow: 0 4px 20px rgba(2,132,199,0.1);
          transform: translateY(-1px);
        }

        .asgn-card:hover::before { opacity: 1; }

        .asgn-card.submitted { background: #fafafa; }

        .asgn-icon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .asgn-icon.active { background: #eef2ff; border-color: #c7d2fe; }

        .asgn-name {
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 4px;
        }

        .asgn-meta {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          color: #94a3b8;
          letter-spacing: 0.08em;
        }

        .asgn-start-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #0284c7;
          color: white;
          border: none;
          border-radius: 14px;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 4px 12px rgba(99,102,241,0.25);
        }

        .asgn-start-btn:hover {
          background: #0369a1;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(2,132,199,0.35);
        }

        .asgn-submitted-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          color: #16a34a;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          flex-shrink: 0;
        }

        .empty-state {
          background: white;
          border: 1.5px dashed #e2e8f0;
          border-radius: 24px;
          padding: 56px 24px;
          text-align: center;
          grid-column: 1 / -1;
        }

        .empty-icon {
          width: 52px;
          height: 52px;
          background: #f8fafc;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }

        .empty-text {
          font-size: 14px;
          font-weight: 600;
          color: #94a3b8;
        }

        .empty-subtext {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: #cbd5e1;
          margin-top: 4px;
          letter-spacing: 0.06em;
        }

        .hist-card {
           background: rgba(255,255,255,0.82);
          backdrop-filter: blur(18px);
          border: 1px solid #f1f5f9;
          border-radius: 28px;
          overflow: hidden;
          transition: box-shadow 0.2s;
        }

        .hist-card:hover { box-shadow: 0 4px 24px rgba(0,0,0,0.06); }

        .hist-card-header {
          padding: 28px 32px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 1px solid #f8fafc;
        }

        .hist-asgn-name {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.01em;
        }

        .hist-status-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 6px;
        }

        .hist-status-badge {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 8px;
        }

        .badge-graded { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .badge-pending { background: #fefce8; color: #a16207; border: 1px solid #fde68a; }

        .hist-score-block {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          flex-shrink: 0;
        }

        .score-circle {
          position: relative;
          width: 76px;
          height: 76px;
        }

        .score-circle svg {
          transform: rotate(-90deg);
        }

        .score-circle-val {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .score-num {
          font-size: 20px;
          font-weight: 800;
          color: #0284c7;
          line-height: 1;
        }

        .score-denom {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          color: #94a3b8;
          letter-spacing: 0.06em;
        }

        .hist-dl-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
        }

        .hist-dl-btn:hover {
          background: rgba(2,132,199,0.06);
          border-color: rgba(2,132,199,0.3);
          color: #0284c7;
        }

        .hist-results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1px;
          background: rgba(2,132,199,0.05);
        }

        .result-cell {
          background: rgba(255,255,255,0.9);
          padding: 20px 24px;
        }

        .result-cell-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .result-q-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          color: #94a3b8;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .result-score-pill {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          padding: 3px 10px;
          border-radius: 8px;
        }

        .result-score-high { background: #f0fdf4; color: #16a34a; }
        .result-score-mid { background: #fefce8; color: #a16207; }
        .result-score-low { background: #fef2f2; color: #dc2626; }

        .result-answer {
          font-size: 12px;
          color: #94a3b8;
          font-style: italic;
          margin-bottom: 8px;
          line-height: 1.5;
        }

        .result-feedback {
          font-size: 13px;
          color: #374151;
          font-weight: 500;
          line-height: 1.5;
        }

        .pending-placeholder {
          padding: 32px;
          text-align: center;
        }

        .pending-text {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: #94a3b8;
          letter-spacing: 0.08em;
        }
      `}</style>

      <div className="dash-root no-print">

        <div className="dash-welcome">
          <div className="dash-welcome-bg" />
          <div className="dash-welcome-grid" />
          <div className="dash-welcome-content">
            <div>
              <p className="dash-greeting">Welcome back</p>
              <h1 className="dash-username">
                {userName.split(' ')[0]}<span>.</span>
              </h1>
            </div>
            <div className="dash-welcome-stats">
              <div className="dash-stat">
                <div className="dash-stat-val">{myClasses.length}</div>
                <div className="dash-stat-label">Classes</div>
              </div>
              <div className="dash-stat">
                <div className="dash-stat-val">
                  {myAssignments.filter(a => a.submissions.some(s => s.studentName === userName)).length}
                </div>
                <div className="dash-stat-label">Submitted</div>
              </div>
              {avgScore !== null && (
                <div className="dash-stat">
                  <div className="dash-stat-val indigo">{avgScore.toFixed(1)}</div>
                  <div className="dash-stat-label">Avg Score</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, background: 'rgba(241,245,249,0.9)', backdropFilter:'blur(8px)', padding: '6px', borderRadius: 16, width: 'fit-content', marginBottom: 32, position:'relative', zIndex:2 }}>
          <button onClick={() => setActiveTab('assessments')}
            style={{ padding: '8px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
              background: activeTab === 'assessments' ? 'white' : 'transparent',
              color: activeTab === 'assessments' ? '#0284c7' : '#94a3b8',
              boxShadow: activeTab === 'assessments' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            Assessments
          </button>
          <button onClick={() => setActiveTab('classes')}
            style={{ position: 'relative', padding: '8px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
              background: activeTab === 'classes' ? 'white' : 'transparent',
              color: activeTab === 'classes' ? '#0284c7' : '#94a3b8',
              boxShadow: activeTab === 'classes' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            My Classes
            {myPendingClasses.length > 0 && (
              <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, background: '#f59e0b', borderRadius: '50%' }} />
            )}
          </button>
          <button onClick={() => setActiveTab('contest')}
            style={{ position: 'relative', padding: '8px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
              background: activeTab === 'contest' ? 'white' : 'transparent',
              color: activeTab === 'contest' ? '#0284c7' : '#94a3b8',
              boxShadow: activeTab === 'contest' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            Contest Grade
          </button>
        </div>

        {activeTab === 'classes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div style={{ background: 'rgba(255,255,255,0.88)', backdropFilter:'blur(18px)', border: '1px solid rgba(2,132,199,0.12)', borderRadius: 24, padding: '24px 28px' }}>
              <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Join a Class</h3>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Enter the 6-character join code your teacher shared with you.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  placeholder="e.g. AB12CD"
                  maxLength={6}
                  style={{ flex: 1, padding: '12px 16px', background: '#f8fafc', border: '1.5px solid #f1f5f9', borderRadius: 14, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#1e293b', outline: 'none' }}
                  value={joinCodeInput}
                  onChange={e => { setJoinCodeInput(e.target.value.toUpperCase()); setJoinCodeError(''); setJoinCodeSuccess(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
                />
                <button onClick={handleJoinByCode}
                  style={{ padding: '12px 24px', background: '#0284c7', color: 'white', border: 'none', borderRadius: 14, fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Request to Join
                </button>
              </div>
              {joinCodeError && <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#ef4444', marginTop: 8, fontWeight: 500 }}>{joinCodeError}</p>}
              {joinCodeSuccess && <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#16a34a', marginTop: 8, fontWeight: 500 }}>{joinCodeSuccess}</p>}
            </div>

            {myPendingClasses.filter(c => c.pendingRequests.find(r => r.userId === userId && r.method === 'email')).length > 0 && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 24, padding: '20px 24px' }}>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" fill="none" stroke="#1e40af" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Teacher Invite
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {myPendingClasses
                    .filter(c => c.pendingRequests.find(r => r.userId === userId && r.method === 'email'))
                    .map(cls => (
                      <div key={cls.id} style={{ background: 'white', border: '1px solid #bfdbfe', borderRadius: 14, padding: '12px 16px' }}>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                          You were invited to <strong>{cls.name}</strong>
                        </p>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          by {cls.teacherName}{cls.subject ? ` · ${cls.subject}` : ''} — awaiting approval
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {myPendingClasses.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 24, padding: '20px 24px' }}>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                  ⏳ Pending Approval ({myPendingClasses.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {myPendingClasses.map(cls => (
                    <div key={cls.id} style={{ background: 'white', border: '1px solid #fde68a', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{cls.name}</p>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#94a3b8' }}>{cls.teacherName}{cls.subject ? ` · ${cls.subject}` : ''}</p>
                      </div>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, color: '#d97706', background: '#fef3c7', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Awaiting</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="dash-section-header">
                <span className="dash-section-title">Enrolled Classes ({myClasses.length})</span>
                <div className="dash-section-line" />
              </div>
              {myClasses.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <svg width="24" height="24" fill="none" stroke="#cbd5e1" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <p className="empty-text">Not enrolled in any classes yet</p>
                  <p className="empty-subtext">Enter a join code above to request access</p>
                </div>
              ) : selectedClassId ? (() => {
                const cls = myClasses.find(c => c.id === selectedClassId);
                if (!cls) return null;
                const clsAsgns = myAssignments.filter(a => a.classId === cls.id);
                const activeAsgns = clsAsgns.filter(a => !a.submissions.some(s => s.studentName === userName));
                const submittedAsgns = clsAsgns.filter(a => a.submissions.some(s => s.studentName === userName));
                return (
                  <div>
                    <button onClick={() => setSelectedClassId(null)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: '#64748b', padding: '0 0 16px 0' }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                      All Classes
                    </button>
                    <div style={{ background: 'rgba(255,255,255,0.88)', backdropFilter:'blur(12px)', border: '1px solid rgba(2,132,199,0.1)', borderRadius: 22, padding: '24px 28px', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 14, background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 20, fontFamily: "'Inter', sans-serif", flexShrink: 0 }}>{cls.name.charAt(0)}</div>
                        <div>
                          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>{cls.name}</p>
                          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>{cls.teacherName}{cls.subject ? ` · ${cls.subject}` : ''}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f8fafc' }}>
                        <div style={{ background: 'rgba(2,132,199,0.06)', borderRadius: 12, padding: '10px 18px', textAlign: 'center' }}>
                          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 700, color: '#0284c7', margin: 0 }}>{activeAsgns.length}</p>
                          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: '#94a3b8', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active</p>
                        </div>
                        <div style={{ background: 'rgba(5,150,105,0.06)', borderRadius: 12, padding: '10px 18px', textAlign: 'center' }}>
                          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 700, color: '#059669', margin: 0 }}>{submittedAsgns.length}</p>
                          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: '#94a3b8', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Submitted</p>
                        </div>
                      </div>
                    </div>
                    {activeAsgns.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Active</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {activeAsgns.sort((a, b) => b.createdAt - a.createdAt).map(a => (
                            <div key={a.id} style={{ background: 'white', border: '1px solid #e0e7ff', borderRadius: 16, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                              <div>
                                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, color: '#1e293b', margin: 0 }}>{a.name}</p>
                                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{a.questions.length} question{a.questions.length !== 1 ? 's' : ''}</p>
                              </div>
                              <button onClick={() => { setActiveAsgn(a); setAnswers(new Array(a.questions.length).fill('')); setViolations(0); setSelectedMode(null); setConsentGiven(false); }}
                                style={{ padding: '8px 18px', background: '#0284c7', color: 'white', border: 'none', borderRadius: 12, fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                                Begin
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {submittedAsgns.length > 0 && (
                      <div>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Submitted</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {submittedAsgns.sort((a, b) => {
                            const sA = a.submissions.find(s => s.studentName === userName);
                            const sB = b.submissions.find(s => s.studentName === userName);
                            return (sB?.submittedAt || 0) - (sA?.submittedAt || 0);
                          }).map(a => {
                            const mySub = a.submissions.find(s => s.studentName === userName)!;
                            const avg = mySub.status === 'Graded' && mySub.results
                              ? ((mySub.results.reduce((r, b) => r + b.score, 0)) / mySub.results.length).toFixed(1) : null;
                            return (
                              <div key={a.id} style={{ background: 'white', border: '1px solid #f1f5f9', borderRadius: 16, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <div>
                                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, color: '#1e293b', margin: 0 }}>{a.name}</p>
                                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>
                                    {new Date(mySub.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </p>
                                </div>
                                {avg !== null ? (
                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 800, color: parseFloat(avg) >= 7 ? '#16a34a' : parseFloat(avg) >= 4 ? '#d97706' : '#dc2626' }}>
                                    {avg}<span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>/10</span>
                                  </span>
                                ) : (
                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#d97706', background: '#fefce8', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' as const }}>Pending</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {clsAsgns.length === 0 && (
                      <div className="empty-state">
                        <p className="empty-text">No assignments posted yet</p>
                        <p className="empty-subtext">Your teacher hasn't published any assignments for this class</p>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {myClasses.map(cls => {
                    const clsAsgns = myAssignments.filter(a => a.classId === cls.id);
                    const activeCount = clsAsgns.filter(a => !a.submissions.some(s => s.studentName === userName)).length;
                    const memberData = cls.members.find(m => m.userId === userId);
                    const isNew = memberData && (Date.now() - memberData.joinedAt < 24 * 60 * 60 * 1000);
                    return (
                      <button key={cls.id} onClick={() => setSelectedClassId(cls.id)}
                        style={{ background: 'white', border: '1px solid #f1f5f9', borderRadius: 22, padding: '20px 24px', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s', width: '100%' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(2,132,199,0.3)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(2,132,199,0.1)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f1f5f9'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 13, background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16, fontFamily: "'Inter', sans-serif", flexShrink: 0 }}>{cls.name.charAt(0)}</div>
                          <div>
                            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, color: '#1e293b', lineHeight: 1.2, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                              {cls.name}
                              {isNew && <span style={{ fontSize: 9, background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>New</span>}
                            </p>
                            {cls.subject && <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{cls.subject}</p>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f8fafc', paddingTop: 12 }}>
                          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#94a3b8', fontWeight: 500, margin: 0 }}>
                            {cls.teacherName} · {clsAsgns.length} assignment{clsAsgns.length !== 1 ? 's' : ''}
                          </p>
                          {activeCount > 0 && (
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, color: '#0284c7', background: 'rgba(2,132,199,0.08)', border: '1px solid rgba(2,132,199,0.2)', padding: '3px 8px', borderRadius: 6 }}>
                              {activeCount} active
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'assessments' && <>

        <div style={{ marginBottom: 40 }}>
          <div className="dash-section-header">
            <span className="dash-section-title">Active Assessments</span>
            <div className="dash-section-line" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {myAssignments.filter(a => !a.submissions.some(s => s.studentName === userName)).length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg width="24" height="24" fill="none" stroke="#cbd5e1" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="empty-text">No active tests found</p>
                <p className="empty-subtext">Check back when your teacher publishes an assessment</p>
              </div>
            ) : (
              [...myAssignments]
                .filter(a => !a.submissions.some(s => s.studentName === userName))
                .sort((a, b) => b.createdAt - a.createdAt)
                .map(a => (
                  <div key={a.id} className="asgn-card">
                    <div className="asgn-icon active">
                      <svg width="20" height="20" fill="none" stroke="#6366f1" viewBox="0 0 24 24" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="asgn-name">{a.name}</div>
                      <div className="asgn-meta">
                        {a.questions.length} question{a.questions.length !== 1 ? 's' : ''} · {appData.classes.find(c => c.id === a.classId)?.name || ''}
                      </div>
                    </div>
                    <button
                      className="asgn-start-btn"
                      onClick={() => { setActiveAsgn(a); setAnswers(new Array(a.questions.length).fill('')); setViolations(0); setSelectedMode(null); setConsentGiven(false); }}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" fill="white" />
                      </svg>
                      Begin
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>

        <div>
          <div className="dash-section-header">
            <span className="dash-section-title">Evaluation History</span>
            <div className="dash-section-line" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myAssignments.every(a => !a.submissions.find(s => s.studentName === userName)) ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg width="24" height="24" fill="none" stroke="#cbd5e1" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="empty-text">No submissions yet</p>
                <p className="empty-subtext">Your results will appear here after you submit an assessment</p>
              </div>
            ) : (
              [...myAssignments]
                .filter(a => a.submissions.find(s => s.studentName === userName))
                .sort((a, b) => {
                  const subA = a.submissions.find(s => s.studentName === userName);
                  const subB = b.submissions.find(s => s.studentName === userName);
                  return (subB?.submittedAt || 0) - (subA?.submittedAt || 0);
                })
                .map(a => {
                  const mySub = a.submissions.find(s => s.studentName === userName)!;
                  const finalScore = mySub.status === 'Graded'
                    ? (mySub.results?.reduce((acc, b) => acc + b.score, 0) || 0) / (mySub.results?.length || 1)
                    : null;
                  const scoreRadius = 28;
                  const circumference = 2 * Math.PI * scoreRadius;
                  const scorePct = finalScore !== null ? finalScore / 10 : 0;
                  const isExpanded = expandedHistoryId === mySub.id;

                  return (
                    <div key={mySub.id} style={{ background: 'rgba(255,255,255,0.88)', backdropFilter:'blur(18px)', border: '1px solid rgba(2,132,199,0.1)', borderRadius: 20, overflow: 'hidden', transition: 'box-shadow 0.2s' }}>
                      {/* ── Accordion Header — always visible ── */}
                      <button
                        type="button"
                        onClick={() => setExpandedHistoryId(isExpanded ? null : mySub.id)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer', gap: 16, textAlign: 'left' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                          {/* Status dot */}
                          <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: mySub.status === 'Graded' ? '#16a34a' : '#f59e0b' }} />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600, color: mySub.status === 'Graded' ? '#16a34a' : '#d97706', background: mySub.status === 'Graded' ? '#f0fdf4' : '#fefce8', border: `1px solid ${mySub.status === 'Graded' ? '#bbf7d0' : '#fde68a'}`, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                                {mySub.status === 'Graded' ? '✓ Graded' : '⏳ Pending'}
                              </span>
                              {/* violation count is intentionally not shown to students — visible to teacher only */}
                              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#94a3b8' }}>
                                {new Date(mySub.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                          {/* Score pill in header */}
                          {finalScore !== null && (
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 800, color: finalScore >= 7 ? '#16a34a' : finalScore >= 4 ? '#d97706' : '#dc2626' }}>
                              {finalScore.toFixed(1)}<span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>/10</span>
                            </span>
                          )}
                          {/* Chevron */}
                          <svg width="18" height="18" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="2" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* ── Expanded content ── */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid #f8fafc' }}>
                          {mySub.status === 'Graded' && finalScore !== null && (
                            <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(2,132,199,0.06)', background: 'rgba(2,132,199,0.02)' }}>
                              <div className="score-circle">
                                <svg width="76" height="76" viewBox="0 0 76 76">
                                  <circle cx="38" cy="38" r={scoreRadius} fill="none" stroke="#f1f5f9" strokeWidth="5" />
                                  <circle cx="38" cy="38" r={scoreRadius} fill="none" stroke="url(#scoreGrad2)" strokeWidth="5" strokeLinecap="round"
                                    strokeDasharray={circumference} strokeDashoffset={circumference * (1 - scorePct)}
                                    style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
                                  />
                                  <defs>
                                    <linearGradient id="scoreGrad2" x1="0" y1="0" x2="1" y2="1">
                                      <stop offset="0%" stopColor="#0284c7" />
                                      <stop offset="100%" stopColor="#38bdf8" />
                                    </linearGradient>
                                  </defs>
                                </svg>
                                <div className="score-circle-val">
                                  <span className="score-num">{finalScore.toFixed(1)}</span>
                                  <span className="score-denom">/10</span>
                                </div>
                              </div>
                              <button className="hist-dl-btn" onClick={() => downloadPersonalReport(a, mySub)}>
                                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                                </svg>
                                Download Report
                              </button>
                            </div>
                          )}

                          {mySub.status === 'Graded' && mySub.results ? (
                            <div className="hist-results-grid">
                              {mySub.results.map((res, i) => {
                                const scoreClass = res.score >= 7 ? 'result-score-high' : res.score >= 4 ? 'result-score-mid' : 'result-score-low';
                                return (
                                  <div key={i} className="result-cell">
                                    <div className="result-cell-top">
                                      <span className="result-q-label">Q{i + 1}</span>
                                      <span className={`result-score-pill ${scoreClass}`}>{res.score}/10</span>
                                    </div>
                                    <p className="result-answer">"{mySub.answers[i] || '[No answer]'}"</p>
                                    <p className="result-feedback">{res.feedback}</p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="pending-placeholder">
                              <p className="pending-text">Awaiting teacher review — results will appear here once graded</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>
        </>}

        {/* ── Contest Grade Tab ─────────────────────────────────────────────── */}
        {activeTab === 'contest' && (
          <div style={{ maxWidth: 600 }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 800, color: '#1e293b', margin: '0 0 6px' }}>Contest a Grade</h2>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#64748b', margin: 0 }}>
                You can request a grade review within <strong>7 days</strong> of it being graded. Provide a clear reason so your teacher can review it fairly.
              </p>
            </div>

            {contestSuccess && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '14px 18px', marginBottom: 20, fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                ✓ {contestSuccess}
              </div>
            )}

            <div style={{ background: 'rgba(255,255,255,0.88)', backdropFilter:'blur(18px)', border: '1px solid rgba(2,132,199,0.12)', borderRadius: 22, padding: '28px' }}>
              {/* Step 1: Select Class */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
                  1. Select Class
                </label>
                <select
                  value={contestClassId}
                  onChange={e => { setContestClassId(e.target.value); setContestAsgnId(''); }}
                  style={{ width: '100%', padding: '12px 16px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 14, fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#1e293b', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="">— Choose a class —</option>
                  {myClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.subject ? ` · ${c.subject}` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Step 2: Select Assignment — only shows graded ones within 7 days */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
                  2. Select Graded Assignment
                </label>
                {!contestClassId ? (
                  <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 14, fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#cbd5e1' }}>Select a class first</div>
                ) : contestableAssignments.length === 0 ? (
                  <div style={{ padding: '14px 16px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 14, fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#92400e' }}>
                    No contestable assignments. Either none are graded yet, or the 7 day window has passed.
                  </div>
                ) : (
                  <select
                    value={contestAsgnId}
                    onChange={e => setContestAsgnId(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 14, fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#1e293b', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">— Choose an assignment —</option>
                    {contestableAssignments.map(a => {
                      const mySub = a.submissions.find(s => s.studentId === userId || s.studentName === userName)!;
                      const avg = mySub.results ? (mySub.results.reduce((acc, r) => acc + r.score, 0) / mySub.results.length).toFixed(1) : '?';
                      //check if student already submitted a contest for this assignment
                      const alreadyContested = (appData.contestRequests || []).some(
                        r => r.assignmentId === a.id && r.studentId === userId && r.status !== 'rejected'
                      );
                      return (
                        <option key={a.id} value={a.id} disabled={alreadyContested}>
                          {a.name} — Score: {avg}/10{alreadyContested ? ' (already contested)' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Step 3: Reason */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
                  3. Your Reason
                </label>
                <textarea
                  value={contestReason}
                  onChange={e => setContestReason(e.target.value)}
                  placeholder="Explain why you believe your grade should be reviewed. Be specific — mention which question(s) and why you feel the feedback was inaccurate."
                  rows={5}
                  style={{ width: '100%', padding: '14px 16px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 14, fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#1e293b', resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
                />
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                  {contestReason.length}/500 characters
                </p>
              </div>

              <button
                onClick={handleSubmitContest}
                disabled={!contestAsgnId || !contestReason.trim() || contestSubmitting}
                style={{ width: '100%', padding: '14px', background: contestAsgnId && contestReason.trim() ? '#0284c7' : '#e2e8f0', color: contestAsgnId && contestReason.trim() ? 'white' : '#94a3b8', border: 'none', borderRadius: 14, fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, cursor: contestAsgnId && contestReason.trim() ? 'pointer' : 'not-allowed', transition: 'background 0.2s' }}
              >
                {contestSubmitting ? 'Submitting…' : 'Submit Contest Request'}
              </button>
            </div>

            {/* Show past contest requests made by this student */}
            {(appData.contestRequests || []).filter(r => r.studentId === userId).length > 0 && (
              <div style={{ marginTop: 28 }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Your Past Requests</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(appData.contestRequests || []).filter(r => r.studentId === userId).map(r => (
                    <div key={r.id} style={{ background: 'white', border: '1px solid #f1f5f9', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                      <div>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>{r.assignmentName}</p>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#94a3b8', margin: 0 }}>
                          Submitted {new Date(r.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                        {r.status === 'approved' && r.teacherNote && (
                          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#15803d', marginTop: 6, fontStyle: 'italic' }}>Teacher note: {r.teacherNote}</p>
                        )}
                        {r.status === 'rejected' && r.teacherNote && (
                          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#dc2626', marginTop: 6, fontStyle: 'italic' }}>Reason: {r.teacherNote}</p>
                        )}
                      </div>
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                        background: r.status === 'approved' ? '#f0fdf4' : r.status === 'rejected' ? '#fef2f2' : '#fefce8',
                        color: r.status === 'approved' ? '#15803d' : r.status === 'rejected' ? '#dc2626' : '#92400e',
                        border: `1px solid ${r.status === 'approved' ? '#bbf7d0' : r.status === 'rejected' ? '#fecaca' : '#fde68a'}`,
                      }}>
                        {r.status === 'approved' ? '✓ Approved' : r.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
};

export default StudentDashboard;