import React, { useState, useRef, useEffect } from 'react';
import * as mammoth from 'mammoth';
import { AppData, Class, Assignment, QuestionPair, JoinRequest } from '../types';
import { gradeSubmission, parseMarkingScheme } from '../services/geminiService';
import {
  createClass as dbCreateClass,
  deleteClass as dbDeleteClass,
  addPendingRequest,
  deletePendingRequest,
  addMember,
  removeMember,
  createAssignment as dbCreateAssignment,
  updateAssignmentStatus,
  updateAssignmentTimeLimit as dbUpdateAssignmentTimeLimit,
  deleteAssignment as dbDeleteAssignment,
  createSubmission,
  updateSubmissionGrade,
  updateContestRequest,
  getViolationScreenshots,
} from '../services/supabase';
import { db, auth } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface TeacherDashboardProps {
  appData: AppData;
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
  teacherId: string;
  teacherName: string;
}

type Tab = 'classes' | 'assignments' | 'grades' | 'contests';
type ClassView = 'list' | 'detail';
type QuestionInputMode = 'manual' | 'upload';

const generateJoinCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

/* ─── animated background (mirrors Login) ─── */
const AnimatedBg: React.FC = () => {
  const orbs = [
    { w: 520, h: 520, bg: '#bae6fd', top: '-8%',  left: '-6%',  dur: '18s', delay: '0s'   },
    { w: 380, h: 380, bg: '#a7f3d0', top: '50%',  right: '-5%', dur: '22s', delay: '-7s'  },
    { w: 300, h: 300, bg: '#67e8f9', bottom:'-7%',left: '38%',  dur: '16s', delay: '-4s'  },
    { w: 240, h: 240, bg: '#6ee7b7', top: '18%',  left: '58%',  dur: '24s', delay: '-11s' },
    { w: 200, h: 200, bg: '#bae6fd', top: '70%',  left: '20%',  dur: '20s', delay: '-8s'  },
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
    { s:50,  top:'77%', left:'6%',  c:'rgba(5,150,105,0.2)', dur:'18s' },
    { s:90,  top:'58%', left:'57%', c:'rgba(14,165,233,0.15)',dur:'20s' },
  ];
  const squares = [
    { s:14, top:'20%', left:'4%',  c:'rgba(2,132,199,0.18)',  dur:'6s',   dl:'0s'  },
    { s:10, top:'66%', left:'90%', c:'rgba(5,150,105,0.18)', dur:'7.5s', dl:'-2s' },
    { s:18, top:'44%', left:'2%',  c:'rgba(14,165,233,0.13)',dur:'8s',   dl:'-4s' },
    { s:8,  top:'8%',  left:'50%', c:'rgba(16,185,129,0.18)',dur:'5.5s', dl:'-1s' },
  ];
  return (
    <div style={{
      position:'fixed',inset:0,overflow:'hidden',zIndex:0,pointerEvents:'none',
      background:'linear-gradient(135deg,#e0f2fe 0%,#ecfdf5 45%,#f0fdf4 70%,#e0f2fe 100%)',
    }}>
      {orbs.map((o,i)=>(
        <div key={i} style={{
          position:'absolute',borderRadius:'50%',filter:'blur(60px)',opacity:0.45,
          width:o.w,height:o.h,background:o.bg,top:(o as any).top,
          left:(o as any).left,right:(o as any).right,bottom:(o as any).bottom,
          animation:`vpFloat ${o.dur} linear infinite`,animationDelay:o.delay,
        }}/>
      ))}
      {dots.map((d,i)=>(
        <div key={i} style={{
          position:'absolute',borderRadius:'50%',
          width:d.s,height:d.s,top:d.top,left:d.left,background:d.c,
          animation:`vpPulse ${d.dur} ease-in-out infinite`,animationDelay:d.dl,
        }}/>
      ))}
      {rings.map((r,i)=>(
        <div key={i} style={{
          position:'absolute',borderRadius:'50%',border:`1.5px solid ${r.c}`,
          width:r.s,height:r.s,top:r.top,left:r.left,
          animation:`vpSpin ${r.dur} linear infinite`,
        }}/>
      ))}
      {squares.map((s,i)=>(
        <div key={i} style={{
          position:'absolute',borderRadius:3,background:s.c,
          width:s.s,height:s.s,top:s.top,left:s.left,
          animation:`vpDrift ${s.dur} ease-in-out infinite`,animationDelay:s.dl,
        }}/>
      ))}
    </div>
  );
};

/* ─── shared card shell ─── */
const Card: React.FC<{children:React.ReactNode;style?:React.CSSProperties;className?:string}> = ({children,style,className})=>(
  <div className={className} style={{
    background:'rgba(255,255,255,0.82)',backdropFilter:'blur(18px)',
    borderRadius:24,border:'1.5px solid rgba(2,132,199,0.13)',
    boxShadow:'0 8px 40px rgba(15,23,42,0.08)',
    ...style,
  }}>{children}</div>
);

const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(18px)',
    borderRadius: 24,
    border: '1.5px solid rgba(2,132,199,0.13)',
    boxShadow: '0 4px 24px rgba(2,132,199,0.07)',
    overflow: 'hidden',
  };

/* ─── pill badge ─── */
const Badge:React.FC<{color?:string;bg?:string;border?:string;children:React.ReactNode}> = ({color='#0284c7',bg='rgba(2,132,199,0.08)',border='rgba(2,132,199,0.2)',children})=>(
  <span style={{
    display:'inline-flex',alignItems:'center',
    fontSize:9,fontWeight:800,letterSpacing:'0.14em',textTransform:'uppercase',
    padding:'3px 10px',borderRadius:999,
    color,background:bg,border:`1px solid ${border}`,
    fontFamily:"'DM Sans',sans-serif",
  }}>{children}</span>
);

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ appData, setAppData, teacherId, teacherName }) => {
  const [tab, setTab] = useState<Tab>('classes');
  const [classView, setClassView] = useState<ClassView>('list');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassSubject, setNewClassSubject] = useState('');

  const [addEmailInput, setAddEmailInput] = useState('');
  const [addEmailError, setAddEmailError] = useState('');
  const [isAddingEmail, setIsAddingEmail] = useState(false);

  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [newAsgnName, setNewAsgnName] = useState('');
  const [newAsgnClassId, setNewAsgnClassId] = useState('');
  const [newAsgnTimeLimit, setNewAsgnTimeLimit] = useState<number | null>(null);
  const [newAsgnTimeLimitCustom, setNewAsgnTimeLimitCustom] = useState('');
  const [questions, setQuestions] = useState<{ question: string; modelAnswer: string }[]>([{ question: '', modelAnswer: '' }]);
  const [questionInputMode, setQuestionInputMode] = useState<QuestionInputMode>('manual');

  const [uploadedFileName, setUploadedFileName] = useState('');
  const [docParseStatus, setDocParseStatus] = useState<'idle'|'parsing'|'done'|'error'>('idle');
  const [docParseError, setDocParseError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [gradingSubId, setGradingSubId] = useState<string | null>(null);
  const [gradingAsgnId, setGradingAsgnId] = useState<string | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [feedbacks, setFeedbacks] = useState<string[]>([]);
  const [autoGrading, setAutoGrading] = useState(false);

  const [gradeAllAsgnId, setGradeAllAsgnId] = useState<string | null>(null);
  const [gradeAllProgress, setGradeAllProgress] = useState<{current:number;total:number;studentName:string;done:boolean;errors:string[]}|null>(null);

  const [reviewingContestId, setReviewingContestId] = useState<string | null>(null);
  const [contestEditScores, setContestEditScores] = useState<number[]>([]);
  const [contestTeacherNote, setContestTeacherNote] = useState<string>('');
  const [rejectingContestId, setRejectingContestId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<string>('');

  // Violation screenshots: keyed by submissionId → string[] of public URLs
  const [violationScreenshots, setViolationScreenshots] = useState<Record<string, string[]>>({});
  const [loadingScreenshots, setLoadingScreenshots] = useState<Record<string, boolean>>({});

  const fetchScreenshots = async (submissionId: string) => {
    if (violationScreenshots[submissionId] !== undefined) return; // already fetched
    setLoadingScreenshots(prev => ({ ...prev, [submissionId]: true }));
    const urls = await getViolationScreenshots(submissionId);
    setViolationScreenshots(prev => ({ ...prev, [submissionId]: urls }));
    setLoadingScreenshots(prev => ({ ...prev, [submissionId]: false }));
  };

  const myClasses = appData.classes.filter(c => c.teacherId === teacherId);
  const myAssignments = appData.assignments.filter(a => a.teacherId === teacherId);

  useEffect(() => {
    setAddEmailInput(''); setAddEmailError(''); setIsAddingEmail(false);
  }, [selectedClassId]);

  /* ─── shared input style ─── */
  const inp: React.CSSProperties = {
    width:'100%',padding:'11px 15px',
    background:'rgba(200,210,220,0.22)',
    border:'1.5px solid rgba(150,170,190,0.35)',
    borderRadius:12,fontSize:13,
    fontFamily:"'DM Sans',sans-serif",
    color:'#0f172a',outline:'none',boxSizing:'border-box',
    transition:'border-color .2s,background .2s',
  };
  const lbl: React.CSSProperties = {
    display:'block',fontSize:10,fontWeight:800,
    color:'#475569',textTransform:'uppercase',
    letterSpacing:'0.16em',marginBottom:5,
    fontFamily:"'DM Sans',sans-serif",
  };
  const btnPrimary: React.CSSProperties = {
    padding:'11px 22px',
    background:'linear-gradient(135deg,#0284c7,#0369a1)',
    color:'#fff',border:'none',borderRadius:12,
    fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:800,
    cursor:'pointer',letterSpacing:'0.06em',
    boxShadow:'0 4px 18px rgba(2,132,199,0.32)',
    transition:'opacity .15s,transform .15s',
  };

  /* ─── doc upload handler ─── */
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadedFileName(file.name); setDocParseStatus('parsing'); setDocParseError('');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await (mammoth as any).extractRawText({ arrayBuffer });
      const rawText = result.value?.trim();
      if (!rawText) { setDocParseStatus('error'); setDocParseError('Document appears empty.'); return; }
      const parsed = await parseMarkingScheme(rawText.substring(0, 6000));
      if (Array.isArray(parsed) && parsed.length > 0) {
        setQuestions(parsed.map((p: any) => ({ question: String(p.question||'').trim(), modelAnswer: String(p.modelAnswer||'').trim() })));
        setDocParseStatus('done');
      } else throw new Error('Empty result');
    } catch {
      try {
        const lines = (await (mammoth as any).extractRawText({ arrayBuffer: await (e.target.files![0]).arrayBuffer() })).value.split('\n').filter((l:string)=>l.trim());
        const parsed: { question:string; modelAnswer:string }[] = [];
        let currentQ = '';
        for (const line of lines) {
          const t = line.trim();
          if (/^(\d+[\.):]|Q\d*[\.):])/i.test(t)) {
            if (currentQ) parsed.push({ question: currentQ, modelAnswer:'' });
            currentQ = t.replace(/^(\d+[\.):]|Q\d*[\.):])\s*/i,'');
          } else if (/^(ans(wer)?|a[\.):])/i.test(t) && currentQ) {
            parsed.push({ question: currentQ, modelAnswer: t.replace(/^(ans(wer)?|a[\.):])\s*/i,'') });
            currentQ = '';
          }
        }
        if (currentQ) parsed.push({ question: currentQ, modelAnswer:'' });
        if (parsed.length > 0) { setQuestions(parsed); setDocParseStatus('done'); }
        else { setDocParseStatus('error'); setDocParseError('Could not detect questions. Number them (1. / Q1:) or connect Gemini API.'); }
      } catch { setDocParseStatus('error'); setDocParseError('Failed to parse document. Make sure it is a valid .docx file.'); }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    const newClass: Class = {
      id: generateId(), name: newClassName.trim(), subject: newClassSubject.trim(),
      teacherId, teacherName, joinCode: generateJoinCode(), members: [], pendingRequests: [], createdAt: Date.now(),
    };
    await dbCreateClass({ id:newClass.id,name:newClass.name,subject:newClass.subject,teacher_id:teacherId,teacher_name:teacherName,join_code:newClass.joinCode,created_at:newClass.createdAt });
    setAppData(prev=>({...prev,classes:[...prev.classes,newClass]}));
    setNewClassName(''); setNewClassSubject(''); setShowCreateClass(false);
  };

  const handleApproveRequest = async (classId:string, req:JoinRequest) => {
    await deletePendingRequest(classId,req.userId);
    await addMember({class_id:classId,user_id:req.userId,name:req.name,email:req.email,joined_at:Date.now()});
    setAppData(prev=>({...prev,classes:prev.classes.map(c=>c.id!==classId?c:{...c,pendingRequests:c.pendingRequests.filter(r=>r.userId!==req.userId),members:[...c.members,{userId:req.userId,name:req.name,email:req.email,joinedAt:Date.now()}]})}));
  };
  const handleRejectRequest = async (classId:string, userId:string) => {
    await deletePendingRequest(classId,userId);
    setAppData(prev=>({...prev,classes:prev.classes.map(c=>c.id!==classId?c:{...c,pendingRequests:c.pendingRequests.filter(r=>r.userId!==userId)})}));
  };
  const handleRemoveMember = async (classId:string, userId:string) => {
    await removeMember(classId,userId);
    setAppData(prev=>({...prev,classes:prev.classes.map(c=>c.id!==classId?c:{...c,members:c.members.filter(m=>m.userId!==userId)})}));
  };

  /*const handleAddByEmail = async (classId:string) => {
    if (isAddingEmail) return;
    const email = addEmailInput.trim().toLowerCase(); if (!email) return;
    const cls = appData.classes.find(c=>c.id===classId); if (!cls) return;
    if (cls.members.some(m=>m.email.toLowerCase()===email)) { setAddEmailError('This student is already a member.'); return; }
    setIsAddingEmail(true); setAddEmailError('');
    try {
      const q = query(collection(db,'users'),where('email','==',email));
      const snap = await getDocs(q);
      if (snap.empty) { setAddEmailError(`No account found with "${email}". They must sign up first.`); setIsAddingEmail(false); return; }
      const studentDoc = snap.docs[0];
      const studentData = studentDoc.data() as {name:string;email:string;role:string};
      const studentUid = studentDoc.id;
      if (studentData.role!=='student'&&studentData.role!=='STUDENT') { setAddEmailError('User found, but they are not registered as a student.'); setIsAddingEmail(false); return; }
      if (cls.pendingRequests.some(r=>r.userId===studentUid)) await deletePendingRequest(classId,studentUid);
      await addMember({class_id:classId,user_id:studentUid,name:studentData.name,email:studentData.email,joined_at:Date.now()});
      setAppData(prev=>({...prev,classes:prev.classes.map(c=>c.id!==classId?c:{...c,pendingRequests:c.pendingRequests.filter(r=>r.userId!==studentUid),members:[...c.members,{userId:studentUid,name:studentData.name,email:studentData.email,joinedAt:Date.now()}]})}));
      setAddEmailInput(''); setAddEmailError('');
      alert(`✓ ${studentData.name} has been added to the class successfully.`);
    } catch(err) { console.error(err); setAddEmailError('Something went wrong. Check the console for details.'); }
    finally { setIsAddingEmail(false); }
  };*/

  //NEW ADDITION -FASEEHA
  const handleAddByEmail = async (classId: string) => {
    if (isAddingEmail) return;

    const emailInput = addEmailInput.trim().toLowerCase();
    if (!emailInput) return;

    const cls = appData.classes.find(c => c.id === classId);
    if (!cls) return;

    if (cls.members.some(m => m.email.toLowerCase() === emailInput)) {
      setAddEmailError('This student is already a member.');
      return;
    }

    setIsAddingEmail(true);
    setAddEmailError('');

    try {
      // FIX: If Firebase is still "waking up", wait for it
      if (!auth.currentUser) {
        console.log("Waiting for Firebase session...");
        await new Promise((resolve) => {
          const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe();
            resolve(user);
          });
          // Timeout after 2 seconds so it doesn't hang forever
          setTimeout(resolve, 2000);
        });
      }

      // Final check
      if (!auth.currentUser) {
        throw new Error("Authentication failed. Please refresh the page.");
      }

      // Query Firebase
      const q = query(collection(db, 'users'), where('email', '==', emailInput));
      const snap = await getDocs(q);

      if (snap.empty) {
        setAddEmailError(`No account found with "${emailInput}".`);
        setIsAddingEmail(false);
        return;
      }

      const studentDoc = snap.docs[0];
      const studentData = studentDoc.data() as any;
      const studentUid = studentDoc.id;

      // Role check (lowercase or uppercase)
      const userRole = studentData.role?.toLowerCase();
      if (userRole !== 'student') {
        setAddEmailError('This user is not registered as a student.');
        setIsAddingEmail(false);
        return;
      }

      // Remove from pending if they were there
      if (cls.pendingRequests.some(r => r.userId === studentUid)) {
        await deletePendingRequest(classId, studentUid);
      }

      // Add member to Supabase
      await addMember({
        class_id: classId,
        user_id: studentUid,
        name: studentData.name,
        email: studentData.email,
        joined_at: Date.now()
      });

      // Update UI state
      setAppData(prev => ({
        ...prev,
        classes: prev.classes.map(c => 
          c.id !== classId ? c : {
            ...c,
            pendingRequests: c.pendingRequests.filter(r => r.userId !== studentUid),
            members: [...c.members, { userId: studentUid, name: studentData.name, email: studentData.email, joinedAt: Date.now() }]
          }
        )
      }));

      setAddEmailInput('');
      alert(`✓ ${studentData.name} added successfully.`);

    } catch (err: any) {
      console.error("Firebase Query Error:", err);
      setAddEmailError(err.message || 'Something went wrong.');
    } finally {
      setIsAddingEmail(false);
    }
  };
//-------------------------------------ENDING HERE -FS
  const handleCreateAssignment = async () => {
    if (!newAsgnName.trim()||!newAsgnClassId) return;
    const newAsgn: Assignment = {
      id:generateId(),name:newAsgnName.trim(),
      questions:questions.filter(q=>q.question.trim()).map(q=>({id:generateId(),question:q.question.trim(),modelAnswer:q.modelAnswer.trim()})),
      submissions:[],classId:newAsgnClassId,teacherId,status:'Draft',createdAt:Date.now(),
      timeLimitMinutes: newAsgnTimeLimit,
    };
    await dbCreateAssignment({id:newAsgn.id,name:newAsgn.name,class_id:newAsgn.classId,teacher_id:teacherId,status:'Draft',questions:newAsgn.questions,created_at:newAsgn.createdAt,time_limit_minutes:newAsgnTimeLimit});
    setAppData(prev=>({...prev,assignments:[...prev.assignments,newAsgn]}));
    setNewAsgnName(''); setNewAsgnClassId(''); setNewAsgnTimeLimit(null); setNewAsgnTimeLimitCustom('');
    setQuestions([{question:'',modelAnswer:''}]);
    setQuestionInputMode('manual'); setDocParseStatus('idle'); setUploadedFileName(''); setDocParseError('');
    setShowCreateAssignment(false);
  };

  const handlePublishToggle = async (asgnId:string) => {
    const asgn = appData.assignments.find(a=>a.id===asgnId); if (!asgn) return;
    const newStatus = asgn.status==='Draft'?'Published':'Draft';
    await updateAssignmentStatus(asgnId,newStatus);
    setAppData(prev=>({...prev,assignments:prev.assignments.map(a=>a.id!==asgnId?a:{...a,status:newStatus})}));
  };
  const handleDeleteAssignment = async (asgnId:string) => {
    if (!confirm('Delete this assignment? All submissions will be lost.')) return;
    await dbDeleteAssignment(asgnId);
    setAppData(prev=>({...prev,assignments:prev.assignments.filter(a=>a.id!==asgnId)}));
  };
//CHANGED HERE
  const startGrading = (asgnId: string, subId: string, numQ: number) => {
    const asgn = appData.assignments.find(a => a.id === asgnId);
    const sub = asgn?.submissions.find(s => s.id === subId);
    const followUpCount = ((sub as any)?.followUpQuestions?.length) || 0;
    const total = numQ + followUpCount;
    setGradingAsgnId(asgnId);
    setGradingSubId(subId);
    setScores(new Array(total).fill(5));
    setFeedbacks(new Array(total).fill(''));
    // Pre-load violation screenshots if the student had any violations
    if (sub && sub.violations > 0) fetchScreenshots(subId);
  };

  const autoGrade = async () => {
    if (!gradingAsgnId || !gradingSubId) return;
    const asgn = appData.assignments.find(a => a.id === gradingAsgnId);
    const sub = asgn?.submissions.find(s => s.id === gradingSubId);
    if (!asgn || !sub) return;
    setAutoGrading(true);
    try {
      const followUpQs: string[] = (sub as any).followUpQuestions || [];
      const allQuestions = [
        ...asgn.questions.map(q => ({ ...q, isFollowUp: false })),
        ...followUpQs.map(q => ({ id: '', question: q, modelAnswer: '', isFollowUp: true })),
      ];
      const results = await gradeSubmission(allQuestions, sub.answers);
      setScores(results.map(r => r.score));
      setFeedbacks(results.map(r => r.feedback));
    } catch (err) {
      alert('Auto-grade failed: ' + String(err));
    } finally {
      setAutoGrading(false);
    }
  };

  const submitGrade = async () => {
    if (!gradingAsgnId||!gradingSubId) return;
    const results = scores.map((score,i)=>({score,feedback:feedbacks[i]||'Good attempt.'}));
    await updateSubmissionGrade(gradingSubId,results);
    setAppData(prev=>({...prev,assignments:prev.assignments.map(a=>a.id!==gradingAsgnId?a:{...a,submissions:a.submissions.map(s=>s.id!==gradingSubId?s:{...s,status:'Graded',results})})}));
    setGradingAsgnId(null); setGradingSubId(null);
  };

  const downloadMasterReport = (asgn: Assignment) => {
    const cls = myClasses.find(c=>c.id===asgn.classId);
    const timestamp = new Date().toLocaleString();
    const gradedSubs = asgn.submissions.filter(s=>s.status==='Graded');
    const classAvg = gradedSubs.length>0
      ?(gradedSubs.reduce((acc,s)=>acc+(s.results?.reduce((r,b)=>r+b.score,0)||0)/(s.results?.length||1),0)/gradedSubs.length).toFixed(1)
      :'N/A';
      //CHANGED HHERE
    const studentRows = asgn.submissions.map((sub, idx) => {
      const avg = sub.status === 'Graded' && sub.results
        ? (sub.results.reduce((r, b) => r + b.score, 0) / sub.results.length).toFixed(1) : 'Pending';
      const followUpQs: string[] = (sub as any).followUpQuestions || [];
      const r1Count = asgn.questions.length;
      const r1Rows = sub.status === 'Graded' && sub.results
        ? sub.results.slice(0, r1Count).map((r, i) => `
            <tr style="background:${i % 2 === 0 ? '#f8fafc' : 'white'}">
              <td style="padding:8px 12px;font-size:11pt;color:#6366f1;font-weight:700;">Q${i + 1}</td>
              <td style="padding:8px 12px;font-size:11pt;color:#1e293b;">${asgn.questions[i]?.question || ''}</td>
              <td style="padding:8px 12px;font-size:11pt;color:#475569;">${sub.answers[i] || '<em>No answer</em>'}</td>
              <td style="padding:8px 12px;font-size:11pt;font-weight:bold;color:${r.score >= 7 ? '#16a34a' : r.score >= 4 ? '#d97706' : '#dc2626'};">${r.score}/10</td>
              <td style="padding:8px 12px;font-size:11pt;color:#64748b;font-style:italic;">${r.feedback}</td>
            </tr>`).join('')
        : `<tr><td colspan="5" style="padding:12px;color:#94a3b8;font-style:italic;">Not yet graded</td></tr>`;
      const r2Rows = followUpQs.length > 0 && sub.status === 'Graded' && sub.results
        ? `<tr><td colspan="5" style="padding:8px 12px;background:#fef9c3;font-size:9pt;font-weight:800;color:#92400e;text-transform:uppercase;letter-spacing:0.08em;">Round 2 · Follow-Up Questions</td></tr>` +
          followUpQs.map((q, i) => {
            const ansIdx = r1Count + i;
            const r = sub.results?.[ansIdx];
            return `
              <tr style="background:${i % 2 === 0 ? '#fffbeb' : '#fefce8'}">
                <td style="padding:8px 12px;font-size:11pt;color:#d97706;font-weight:700;">F${i + 1}</td>
                <td style="padding:8px 12px;font-size:11pt;color:#1e293b;">${q}</td>
                <td style="padding:8px 12px;font-size:11pt;color:#475569;">${sub.answers[ansIdx] || '<em>No answer</em>'}</td>
                <td style="padding:8px 12px;font-size:11pt;font-weight:bold;color:${r ? (r.score >= 7 ? '#16a34a' : r.score >= 4 ? '#d97706' : '#dc2626') : '#94a3b8'};">${r ? r.score + '/10' : '—'}</td>
                <td style="padding:8px 12px;font-size:11pt;color:#64748b;font-style:italic;">${r?.feedback || '—'}</td>
              </tr>`;
          }).join('')
        : '';
        //MASTER REPORT -FS
    return `
      <div style="page-break-inside:avoid;margin-bottom:32px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:${sub.violations > 0 ? '#fef2f2' : '#f8fafc'};padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <span style="font-size:10pt;color:#94a3b8;font-weight:600;">#${idx + 1}</span>
            <span style="font-size:14pt;font-weight:800;color:#0f172a;margin-left:12px;">${sub.studentName}</span>
          </div>
          <div style="display:flex;gap:16px;align-items:center;">
            <span style="font-size:10pt;color:#64748b;">${new Date(sub.submittedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
            <span style="font-size:13pt;font-weight:900;color:${avg==='Pending'?'#d97706':parseFloat(avg)>=7?'#16a34a':parseFloat(avg)>=4?'#d97706':'#dc2626'};">${avg==='Pending'?'— Pending':avg+' / 10'}</span>
            ${sub.violations > 0 ? `<span style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:3px 10px;border-radius:20px;font-size:9pt;font-weight:700;">⚠ ${sub.violations} VIOLATION${sub.violations>1?'S':''}</span>` : ''}
          </div>
        </div>
        ${sub.violations > 0 ? `<div style="background:#fff7ed;border-bottom:1px solid #fed7aa;padding:10px 20px;font-size:10pt;color:#c2410c;font-weight:600;">Security Alert: Tab switching detected — ${sub.violations} violation${sub.violations>1?'s':''} recorded</div>` : ''}
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#0284c7;">
            <th style="padding:10px 12px;text-align:left;font-size:9pt;color:white;font-weight:700;text-transform:uppercase;width:5%;">#</th>
            <th style="padding:10px 12px;text-align:left;font-size:9pt;color:white;font-weight:700;text-transform:uppercase;width:25%;">Question</th>
            <th style="padding:10px 12px;text-align:left;font-size:9pt;color:white;font-weight:700;text-transform:uppercase;width:35%;">Student Answer</th>
            <th style="padding:10px 12px;text-align:left;font-size:9pt;color:white;font-weight:700;text-transform:uppercase;width:8%;">Score</th>
            <th style="padding:10px 12px;text-align:left;font-size:9pt;color:white;font-weight:700;text-transform:uppercase;width:27%;">Feedback</th>
          </tr></thead>
          <tbody>${r1Rows}${r2Rows}</tbody>
        </table>
      </div>`;    }).join('');
    const docContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>VivaPro Report</title><style>body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;}</style></head><body><div style="text-align:center;border-bottom:4px solid #0284c7;padding-bottom:24px;margin-bottom:32px;"><div style="font-size:28pt;font-weight:900;color:#0284c7;">VivaPro</div><div style="font-size:14pt;font-weight:700;">Master Assessment Report</div><div style="font-size:10pt;color:#94a3b8;margin-top:6px;">Confidential — Teacher Copy · ${timestamp}</div></div><p><b>Assignment:</b> ${asgn.name}</p><p><b>Class:</b> ${cls?.name||'—'}</p><p><b>Class Average:</b> ${classAvg}${classAvg!=='N/A'?' / 10':''}</p><p><b>Total Submissions:</b> ${asgn.submissions.length}</p><h2>Detailed Breakdown</h2>${studentRows}</body></html>`;
    const blob = new Blob(['\ufeff',docContent],{type:'application/msword'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href=url; link.download=`${asgn.name}_Master_Report.doc`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  };

  const handleGradeAll = async (asgnId:string) => {
    const asgn = appData.assignments.find(a=>a.id===asgnId); if (!asgn) return;
    const pending = asgn.submissions.filter(s=>s.status==='Pending');
    if (pending.length===0) { alert('No pending submissions to grade.'); return; }
    setGradeAllAsgnId(asgnId);
    setGradeAllProgress({current:0,total:pending.length,studentName:'',done:false,errors:[]});
    const errors: string[] = [];
    for (let i=0;i<pending.length;i++) {
      const sub = pending[i];
      setGradeAllProgress(p=>p?{...p,current:i+1,studentName:sub.studentName}:null);
      try {
        const followUpQs: string[] = (sub as any).followUpQuestions || [];
        const allQuestions = [
          ...asgn.questions.map(q => ({ ...q, isFollowUp: false })),
          ...followUpQs.map(q => ({ id: '', question: q, modelAnswer: '', isFollowUp: true })),
        ];
        const results = await gradeSubmission(allQuestions, sub.answers);
        await updateSubmissionGrade(sub.id, results);
        setAppData(prev=>({...prev,assignments:prev.assignments.map(a=>a.id!==asgnId?a:{...a,submissions:a.submissions.map(s=>s.id!==sub.id?s:{...s,status:'Graded',results})})}));
      } catch(err) { errors.push(`${sub.studentName}: ${String(err)}`); }
      if (i<pending.length-1) await new Promise(res=>setTimeout(res,800));
    }
    setGradeAllProgress(p=>p?{...p,done:true,errors}:null);
  };
  const closeGradeAllModal = () => { setGradeAllAsgnId(null); setGradeAllProgress(null); };

  const startContestReview = (contestId:string) => {
    const contest = (appData.contestRequests||[]).find(r=>r.id===contestId); if (!contest) return;
    const asgn = appData.assignments.find(a=>a.id===contest.assignmentId);
    const sub = asgn?.submissions.find(s=>s.id===contest.submissionId);
    if (!sub?.results) return;
    const followUpQs: string[] = (sub as any).followUpQuestions || [];
    const totalExpected = asgn!.questions.length + followUpQs.length;
    const initScores = Array.from({length: totalExpected}, (_,i) => sub.results![i]?.score ?? 5);
    setReviewingContestId(contestId);
    setContestEditScores(initScores);
    setContestTeacherNote('');
    // Pre-load violation screenshots for the contested submission
    if (sub.violations > 0) fetchScreenshots(contest.submissionId);
  };
  const handleApproveContest = async () => {
    if (!reviewingContestId) return;
    const contest = (appData.contestRequests||[]).find(r=>r.id===reviewingContestId); if (!contest) return;
    const asgn = appData.assignments.find(a=>a.id===contest.assignmentId);
    const sub = asgn?.submissions.find(s=>s.id===contest.submissionId);
    if (!asgn||!sub?.results) return;
    const updatedResults = sub.results.map((r,i)=>({score:contestEditScores[i]??r.score,feedback:r.feedback}));
    await updateSubmissionGrade(sub.id,updatedResults);
    await updateContestRequest(reviewingContestId,'approved',contestTeacherNote.trim()||undefined);
    setAppData(prev=>({...prev,assignments:prev.assignments.map(a=>a.id!==contest.assignmentId?a:{...a,submissions:a.submissions.map(s=>s.id!==contest.submissionId?s:{...s,results:updatedResults})}),contestRequests:(prev.contestRequests||[]).map(r=>r.id!==reviewingContestId?r:{...r,status:'approved' as const,teacherNote:contestTeacherNote.trim()||undefined})}));
    setReviewingContestId(null); setContestEditScores([]); setContestTeacherNote('');
  };
  const handleRejectContest = async (contestId:string, note:string) => {
    await updateContestRequest(contestId,'rejected',note.trim()||undefined);
    setAppData(prev=>({...prev,contestRequests:(prev.contestRequests||[]).map(r=>r.id!==contestId?r:{...r,status:'rejected' as const,teacherNote:note.trim()||undefined})}));
    setRejectingContestId(null); setRejectNote('');
  };

  const selectedClass = myClasses.find(c=>c.id===selectedClassId);
  const totalPending = myClasses.reduce((acc,c)=>acc+c.pendingRequests.length,0);
  const totalPendingSubs = myAssignments.reduce((acc,a)=>acc+a.submissions.filter(s=>s.status==='Pending').length,0);
  const pendingContests = (appData.contestRequests||[]).filter(r=>r.teacherId===teacherId&&r.status==='pending').length;

  /* ── avatar initials ── */
  const initials = teacherName.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);

  /* ── GradeAll modal ── */
  const GradeAllModal = () => {
    if (!gradeAllProgress) return null;
    const pct = gradeAllProgress.total>0?Math.round((gradeAllProgress.current/gradeAllProgress.total)*100):0;
    return (
      <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.5)',backdropFilter:'blur(8px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <Card style={{padding:40,maxWidth:440,width:'100%',borderRadius:28}}>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:28}}>
            <div style={{width:48,height:48,borderRadius:16,background:'linear-gradient(135deg,#0284c7,#0369a1)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px rgba(2,132,199,0.35)'}}>
              <svg width={22} height={22} fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
            </div>
            <div>
              <div style={{fontFamily:"'Nunito',sans-serif",fontSize:18,fontWeight:900,color:'#0f172a'}}>{gradeAllProgress.done?'Grading Complete!':'AI Grading in Progress…'}</div>
              <div style={{fontSize:12,color:'#64748b',fontFamily:"'DM Sans',sans-serif",marginTop:2}}>
                {gradeAllProgress.done?`${gradeAllProgress.total-gradeAllProgress.errors.length} / ${gradeAllProgress.total} graded successfully`:`${gradeAllProgress.current} of ${gradeAllProgress.total} — ${gradeAllProgress.studentName}`}
              </div>
            </div>
          </div>
          <div style={{height:10,background:'rgba(2,132,199,0.1)',borderRadius:999,overflow:'hidden',marginBottom:10}}>
            <div style={{height:'100%',background:'linear-gradient(90deg,#0284c7,#38bdf8)',borderRadius:999,width:`${gradeAllProgress.done?100:pct}%`,transition:'width .5s ease'}}/>
          </div>
          <div style={{textAlign:'center',fontSize:12,fontWeight:800,color:'#0284c7',fontFamily:"'DM Sans',sans-serif",marginBottom:24}}>{pct}%</div>
          {gradeAllProgress.errors.length>0&&(
            <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:14,padding:'12px 16px',marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:800,color:'#dc2626',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:6}}>Errors</div>
              {gradeAllProgress.errors.map((e,i)=><div key={i} style={{fontSize:12,color:'#dc2626'}}>{e}</div>)}
            </div>
          )}
          {gradeAllProgress.done?(
            <button onClick={closeGradeAllModal} style={{...btnPrimary,width:'100%',padding:'13px'}}>Done ✓</button>
          ):(
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:12,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>
              <svg width={16} height={16} fill="none" viewBox="0 0 24 24" style={{animation:'spin 1s linear infinite',color:'#0284c7'}}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" opacity=".75"/></svg>
              Please wait — do not close this window
            </div>
          )}
        </Card>
      </div>
    );
  };

  /* ════════════════════════════════════════
     GRADING VIEW
  ════════════════════════════════════════ */
  if (gradingAsgnId && gradingSubId) {
    const asgn = myAssignments.find(a=>a.id===gradingAsgnId)!;
    const sub = asgn?.submissions.find(s=>s.id===gradingSubId)!;
    return (
      <>
        <style>{globalStyles}</style>
        <AnimatedBg />
        <div style={{position:'relative',zIndex:1,maxWidth:760,margin:'0 auto',padding:'32px 20px'}}>
          <button onClick={()=>{setGradingAsgnId(null);setGradingSubId(null);}} style={{display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:700,color:'#475569',background:'none',border:'none',cursor:'pointer',marginBottom:24,fontFamily:"'DM Sans',sans-serif",padding:0}}>
            <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            Back to Grades
          </button>
          <Card style={{overflow:'hidden'}}>
            <div style={{padding:'28px 32px',borderBottom:'1.5px solid rgba(2,132,199,0.08)',background:'linear-gradient(135deg,rgba(2,132,199,0.04),rgba(56,189,248,0.04))'}}>
              <div style={{fontSize:10,fontWeight:800,color:'#0284c7',textTransform:'uppercase',letterSpacing:'0.18em',fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>{asgn.name}</div>
              <div style={{fontFamily:"'Nunito',sans-serif",fontSize:22,fontWeight:900,color:'#0f172a'}}>Grading: {sub.studentName}</div>
              {sub.violations>0&&(
                <span style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:8,fontSize:11,fontWeight:700,color:'#dc2626',background:'#fef2f2',border:'1px solid #fecaca',padding:'4px 12px',borderRadius:999}}>
                  ⚠ {sub.violations} security violation{sub.violations>1?'s':''} recorded
                </span>
              )}
              {/* ── Violation Screenshots ── */}
              {sub.violations>0&&(
                <div style={{marginTop:14}}>
                  {loadingScreenshots[sub.id]?(
                    <div style={{fontSize:11,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>Loading violation screenshots…</div>
                  ):(violationScreenshots[sub.id]?.length??0)>0?(
                    <div>
                      <div style={{fontSize:10,fontWeight:800,color:'#dc2626',textTransform:'uppercase',letterSpacing:'0.14em',fontFamily:"'DM Sans',sans-serif",marginBottom:8}}>
                        📷 Violation Screenshots ({violationScreenshots[sub.id].length})
                        <span style={{marginLeft:8,fontSize:9,fontWeight:600,color:'#94a3b8',textTransform:'none',letterSpacing:0}}>Auto-deleted after 7 days</span>
                      </div>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {violationScreenshots[sub.id].map((url,idx)=>(
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer" style={{display:'block',border:'2px solid #fecaca',borderRadius:10,overflow:'hidden',cursor:'pointer',transition:'border-color .15s',flexShrink:0}}
                            onMouseOver={e=>e.currentTarget.style.borderColor='#ef4444'}
                            onMouseOut={e=>e.currentTarget.style.borderColor='#fecaca'}>
                            <img src={url} alt={`Violation ${idx+1}`} style={{width:120,height:80,objectFit:'cover',display:'block'}}/>
                          </a>
                        ))}
                      </div>
                    </div>
                  ):(violationScreenshots[sub.id] !== undefined)?(
                    <div style={{fontSize:11,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>No screenshots stored for this submission.</div>
                  ):null}
                </div>
              )}
              <div style={{marginTop:16}}>
                <button onClick={autoGrade} disabled={autoGrading} style={{...btnPrimary,display:'inline-flex',alignItems:'center',gap:8,opacity:autoGrading?.6:1,cursor:autoGrading?'not-allowed':'pointer'}}>
                  {autoGrading?(
                    <><svg width={14} height={14} fill="none" viewBox="0 0 24 24" style={{animation:'spin 1s linear infinite'}}><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" opacity=".25"/><path fill="white" d="M4 12a8 8 0 018-8v8H4z" opacity=".75"/></svg>Grading…</>
                  ):(
                    <><svg width={14} height={14} fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>AI Auto-Grade</>
                  )}
                </button>
                <span style={{fontSize:11,color:'#94a3b8',marginLeft:10,fontFamily:"'DM Sans',sans-serif"}}>AI suggests scores — you can adjust before saving.</span>
              </div>
            </div>
            <div style={{padding:'28px 32px',display:'flex',flexDirection:'column',gap:28}}>
              {asgn.questions.map((q,i)=>(
                <div key={q.id} style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                  <div style={{width:30,height:30,borderRadius:10,background:'linear-gradient(135deg,rgba(2,132,199,0.12),rgba(56,189,248,0.12))',border:'1.5px solid rgba(2,132,199,0.2)',color:'#0284c7',fontSize:11,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>{i+1}</div>
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:700,color:'#0f172a'}}>{q.question}</div>
                    <div style={{background:'rgba(15,23,42,0.03)',borderRadius:12,padding:'12px 14px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{...lbl,margin:0}}>Student's Answer</span>
                        {(()=>{const flag=((sub as any).answerEditFlags||[])[i];if(flag==='replaced')return <span style={{fontSize:9,fontWeight:800,color:'#dc2626',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:6,padding:'2px 7px',letterSpacing:'0.05em',textTransform:'uppercase' as const}}>✎ Replaced</span>;if(flag==='edited')return <span style={{fontSize:9,fontWeight:800,color:'#92400e',background:'#fefce8',border:'1px solid #fde68a',borderRadius:6,padding:'2px 7px',letterSpacing:'0.05em',textTransform:'uppercase' as const}}>✎ Edited</span>;return null;})()}
                      </div>
                      <div style={{fontSize:13,color:'#334155',fontFamily:"'DM Sans',sans-serif"}}>{sub.answers[i]||<span style={{fontStyle:'italic',color:'#94a3b8'}}>No answer provided</span>}</div>
                      {(()=>{const flag=((sub as any).answerEditFlags||[])[i];const original=((sub as any).originalAnswers||[])[i];if((flag==='edited'||flag==='replaced')&&original?.trim())return(<div style={{marginTop:8,paddingTop:8,borderTop:'1px dashed rgba(2,132,199,0.15)'}}><div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase' as const,letterSpacing:'0.1em',marginBottom:3}}>Original</div><div style={{fontSize:12,color:'#94a3b8',fontStyle:'italic'}}>{original}</div></div>);return null;})()}
                    </div>
                    <div style={{background:'rgba(2,132,199,0.05)',border:'1.5px solid rgba(2,132,199,0.12)',borderRadius:12,padding:'12px 14px'}}>
                      <div style={{...lbl,margin:'0 0 4px',color:'#0284c7'}}>Model Answer</div>
                      <div style={{fontSize:13,color:'#0369a1',fontFamily:"'DM Sans',sans-serif"}}>{q.modelAnswer||'—'}</div>
                    </div>
                    <div style={{display:'flex',gap:12,alignItems:'flex-end'}}>
                      <div>
                        <label style={lbl}>Score (0–10)</label>
                        <input type="number" min={0} max={10} value={scores[i]??5}
                          onChange={e=>{const n=[...scores];n[i]=Math.min(10,Math.max(0,Number(e.target.value)));setScores(n);}}
                          style={{...inp,width:72,textAlign:'center',fontWeight:800,fontSize:15}} className="vp-input"/>
                      </div>
                      <div style={{flex:1}}>
                        <label style={lbl}>Feedback</label>
                        <input type="text" placeholder="Write feedback…" value={feedbacks[i]??''}
                          onChange={e=>{const n=[...feedbacks];n[i]=e.target.value;setFeedbacks(n);}}
                          style={inp} className="vp-input"/>
                      </div>
                    </div>
                  </div>
                </div>
              ))} 
              {/* ── CHANGED HERE -FS*/}
                  
              {/* ── Round 2 Follow-Up Questions ── */}
                  {(() => {
                    const followUpQs: string[] = (sub as any).followUpQuestions || [];
                    if (followUpQs.length === 0) return null;
                    const r1Count = asgn.questions.length;
                    return (
                      <div>
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-gray-100" />
                          <span className="text-xs font-bold text-amber-600 uppercase tracking-widest bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-full">
                            Round 2 · Follow-Up Questions
                          </span>
                          <div className="flex-1 h-px bg-gray-100" />
                        </div>
                        <p className="text-xs text-gray-400 mb-4">
                          These questions were generated from the student's uploaded assignment.
                        </p>
                        <div className="space-y-6">
                          {followUpQs.map((q, i) => {
                            const answerIdx = r1Count + i;
                            return (
                              <div key={i} className="space-y-3">
                                <div className="flex items-start gap-3">
                                  <span className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                    F{i + 1}
                                  </span>
                                  <div className="flex-1 space-y-3">
                                    <p className="font-semibold text-gray-800">{q}</p>
                                    <div className="bg-gray-50 rounded-xl p-3">
                                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Student's Answer</p>
                                      <p className="text-sm text-gray-700">
                                        {sub.answers[answerIdx] || <span className="italic text-gray-400">No answer provided</span>}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div>
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1">Score (0–10)</label>
                                        <input
                                          type="number" min={0} max={10}
                                          className="w-20 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                                          value={scores[answerIdx] ?? 5}
                                          onChange={e => {
                                            const n = [...scores];
                                            n[answerIdx] = Math.min(10, Math.max(0, Number(e.target.value)));
                                            setScores(n);
                                          }}
                                        />
                                      </div>
                                      <div className="flex-1">
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-1">Feedback</label>
                                        <input
                                          type="text"
                                          placeholder="Write feedback…"
                                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                          value={feedbacks[answerIdx] ?? ''}
                                          onChange={e => {
                                            const n = [...feedbacks];
                                            n[answerIdx] = e.target.value;
                                            setFeedbacks(n);
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
              <button onClick={submitGrade} className="vp-submit" style={{...btnPrimary,width:'100%',padding:'15px',fontSize:14,borderRadius:14,marginTop:4}}>
                Save Grades & Publish to Student →
              </button>
            </div>
          </Card>
        </div>
      </>
    );
  }

  /* ════════════════════════════════════════
     CLASS DETAIL VIEW
  ════════════════════════════════════════ */
  if (tab==='classes'&&classView==='detail'&&selectedClass) {
    const classAssignments = myAssignments.filter(a=>a.classId===selectedClass.id);
    return (
      <>
        <style>{globalStyles}</style>
        <AnimatedBg />
        <div style={{position:'relative',zIndex:1,maxWidth:860,margin:'0 auto',padding:'32px 20px',display:'flex',flexDirection:'column',gap:20}}>
          <button onClick={()=>{setClassView('list');setSelectedClassId(null);}} style={{display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:700,color:'#475569',background:'none',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",padding:0,width:'fit-content'}}>
            <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            All Classes
          </button>

          <Card>
            <div style={{padding:'28px 32px'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:20,flexWrap:'wrap'}}>
                <div style={{display:'flex',alignItems:'center',gap:14}}>
                  <div style={{width:52,height:52,borderRadius:16,background:'linear-gradient(135deg,#0284c7,#0369a1)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontFamily:"'Nunito',sans-serif",fontSize:22,fontWeight:900,boxShadow:'0 4px 16px rgba(2,132,199,0.3)'}}>
                    {selectedClass.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{fontFamily:"'Nunito',sans-serif",fontSize:22,fontWeight:900,color:'#0f172a'}}>{selectedClass.name}</div>
                    {selectedClass.subject&&<div style={{fontSize:12,color:'#64748b',fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{selectedClass.subject}</div>}
                    <div style={{display:'flex',gap:10,marginTop:8,flexWrap:'wrap'}}>
                      <Badge>{selectedClass.members.length} student{selectedClass.members.length!==1?'s':''}</Badge>
                      <Badge color="#059669" bg="rgba(5,150,105,0.08)" border="rgba(5,150,105,0.2)">{classAssignments.length} assignment{classAssignments.length!==1?'s':''}</Badge>
                    </div>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.16em',fontFamily:"'DM Sans',sans-serif",marginBottom:6}}>Join Code</div>
                  <div style={{background:'linear-gradient(135deg,rgba(2,132,199,0.08),rgba(56,189,248,0.08))',border:'2px solid rgba(2,132,199,0.2)',borderRadius:14,padding:'10px 20px'}}>
                    <span style={{fontFamily:'monospace',fontSize:22,fontWeight:900,color:'#0284c7',letterSpacing:'0.2em'}}>{selectedClass.joinCode}</span>
                  </div>
                  <div style={{fontSize:11,color:'#94a3b8',marginTop:4,fontFamily:"'DM Sans',sans-serif"}}>Share with students</div>
                </div>
              </div>
            </div>
          </Card>

          {selectedClass.pendingRequests.filter(r=>r.method==='code').length>0&&(
            <Card style={{border:'1.5px solid rgba(245,158,11,0.3)'}}>
              <div style={{padding:'20px 24px'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:'#f59e0b',display:'inline-block',animation:'vpPulse 1.5s ease-in-out infinite'}}/>
                  <span style={{fontSize:11,fontWeight:800,color:'#92400e',textTransform:'uppercase',letterSpacing:'0.14em',fontFamily:"'DM Sans',sans-serif"}}>
                    {selectedClass.pendingRequests.filter(r=>r.method==='code').length} Pending Request{selectedClass.pendingRequests.filter(r=>r.method==='code').length>1?'s':''}
                  </span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {selectedClass.pendingRequests.filter(r=>r.method==='code').map(req=>(
                    <div key={req.userId} style={{background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:36,height:36,borderRadius:12,background:'rgba(245,158,11,0.15)',color:'#92400e',fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {req.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:'#0f172a',fontFamily:"'DM Sans',sans-serif"}}>{req.name}</div>
                          <div style={{fontSize:11,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>{req.email}</div>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <button onClick={()=>handleApproveRequest(selectedClass.id,req)} style={{padding:'7px 16px',background:'#059669',color:'white',border:'none',borderRadius:10,fontSize:11,fontWeight:800,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",letterSpacing:'0.06em'}}>Approve</button>
                        <button onClick={()=>handleRejectRequest(selectedClass.id,req.userId)} style={{padding:'7px 16px',background:'rgba(15,23,42,0.06)',color:'#475569',border:'none',borderRadius:10,fontSize:11,fontWeight:800,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Decline</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          <Card>
            <div style={{padding:'20px 24px'}}>
              <div style={{fontSize:11,fontWeight:800,color:'#0f172a',textTransform:'uppercase',letterSpacing:'0.14em',fontFamily:"'DM Sans',sans-serif",marginBottom:14}}>Add Student by Email</div>
              <div style={{display:'flex',gap:10}}>
                <input type="email" placeholder="student@email.com" value={addEmailInput} onChange={e=>setAddEmailInput(e.target.value)}
                  style={{...inp,flex:1}} className="vp-input"/>
                <button onClick={()=>handleAddByEmail(selectedClass.id)} disabled={isAddingEmail}
                  style={{...btnPrimary,opacity:isAddingEmail?.6:1,flexShrink:0}}>
                  {isAddingEmail?'Adding…':'Add Student'}
                </button>
              </div>
              {addEmailError&&<div style={{fontSize:12,color:'#dc2626',marginTop:8,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{addEmailError}</div>}
            </div>
          </Card>

          <Card>
            <div style={{padding:'20px 24px'}}>
              <div style={{fontSize:11,fontWeight:800,color:'#0f172a',textTransform:'uppercase',letterSpacing:'0.14em',fontFamily:"'DM Sans',sans-serif",marginBottom:14}}>
                Students ({selectedClass.members.length})
              </div>
              {selectedClass.members.length===0?(
                <div style={{textAlign:'center',padding:'28px 0',fontSize:13,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>No students yet.</div>
              ):(
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {selectedClass.members.map(m=>(
                    <div key={m.userId} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'rgba(2,132,199,0.04)',borderRadius:12,border:'1px solid rgba(2,132,199,0.08)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:34,height:34,borderRadius:11,background:'linear-gradient(135deg,rgba(2,132,199,0.15),rgba(56,189,248,0.15))',color:'#0284c7',fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:'#0f172a',fontFamily:"'DM Sans',sans-serif"}}>{m.name}</div>
                          <div style={{fontSize:11,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>{m.email}</div>
                        </div>
                      </div>
                      <button onClick={()=>handleRemoveMember(selectedClass.id,m.userId)}
                        style={{padding:8,background:'none',border:'none',cursor:'pointer',color:'#cbd5e1',borderRadius:10,transition:'all .15s'}}
                        onMouseOver={e=>(e.currentTarget.style.color='#dc2626',e.currentTarget.style.background='#fef2f2')}
                        onMouseOut={e=>(e.currentTarget.style.color='#cbd5e1',e.currentTarget.style.background='none')}>
                        <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </>
    );
  }

  /* ════════════════════════════════════════
     MAIN DASHBOARD
  ════════════════════════════════════════ */
  const tabIcons: Record<Tab,React.ReactNode> = {
    classes: <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/><path strokeLinecap="round" strokeLinejoin="round" d="M16 3v4M8 3v4M3 11h18"/></svg>,
    assignments: <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
    grades: <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
    contests: <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  };

  return (
    <>
      <style>{globalStyles}</style>
      <AnimatedBg />
      <GradeAllModal />

      
      <div style={{position:'relative',zIndex:1,maxWidth:960,margin:'0 auto',padding:'32px 20px 40px'}}>
        
        

        {/* tabs */}
        <div style={{display:'flex',gap:2,background:'rgba(2,132,199,0.06)',padding:'4px',borderRadius:14,border:'1px solid rgba(2,132,199,0.1)'}}>
          {(['classes','assignments','grades','contests'] as Tab[]).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              display:'flex',alignItems:'center',gap:6,
              padding:'7px 16px',
              borderRadius:10,border:'none',
              background:tab===t?'white':'transparent',
              color:tab===t?'#0284c7':'#64748b',
              fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:800,
              letterSpacing:'0.08em',textTransform:'uppercase',
              cursor:'pointer',transition:'all .18s',
              boxShadow:tab===t?'0 2px 10px rgba(2,132,199,0.15)':'none',
              position:'relative',
            }}>
              {tabIcons[t]}
              {t}
              {t==='classes'&&totalPending>0&&<span style={{position:'absolute',top:-4,right:-4,width:16,height:16,borderRadius:'50%',background:'#f59e0b',color:'white',fontSize:9,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center'}}>{totalPending}</span>}
              {t==='grades'&&totalPendingSubs>0&&<span style={{position:'absolute',top:-4,right:-4,width:16,height:16,borderRadius:'50%',background:'#dc2626',color:'white',fontSize:9,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center'}}>{totalPendingSubs}</span>}
              {t==='contests'&&pendingContests>0&&<span style={{position:'absolute',top:-4,right:-4,width:16,height:16,borderRadius:'50%',background:'#0284c7',color:'white',fontSize:9,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center'}}>{pendingContests}</span>}
            </button>
          ))}
        </div>

        
         

        {/* avatar */}
        
      </div>

      {/* ── main content ── */}

      {/* Welcome banner */}
          <div style={{ ...card, padding: '22px 28px', marginBottom: 24, background: 'linear-gradient(135deg, rgba(2,132,199,0.08) 0%, rgba(14,165,233,0.05) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 26, color: '#0f172a', margin: '0 0 6px' }}>Welcome back, {teacherName.split(' ')[0]}</p>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, color: '#64748b', margin: 0 }}>
                {totalPendingSubs > 0 ? `You have ${totalPendingSubs} submission${totalPendingSubs !== 1 ? 's' : ''} waiting to be graded.` : 'Everything is up to date.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {[{ label: 'Classes', value: myClasses.length, color: '#0284c7' }, { label: 'Assignments', value: myAssignments.length, color: '#0369a1' }, { label: 'Pending Grades', value: totalPendingSubs, color: totalPendingSubs > 0 ? '#dc2626' : '#059669' }].map(stat => (
                <div key={stat.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.6)', borderRadius: 14, padding: '10px 16px', border: '1px solid rgba(2,132,199,0.12)' }}>
                  <div style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 22, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

      <div style={{position:'relative',zIndex:1,maxWidth:960,margin:'0 auto',padding:'32px 20px 40px'}}>

        {/* ════ CLASSES TAB ════ */}
        {tab==='classes'&&(
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontFamily:"'Nunito',sans-serif",fontSize:26,fontWeight:900,color:'#0f172a'}}>My Classes</div>
                <div style={{fontSize:12,color:'#64748b',fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{myClasses.length} active class{myClasses.length!==1?'es':''}</div>
              </div>
              <button onClick={()=>setShowCreateClass(true)} className="vp-submit" style={{...btnPrimary,display:'flex',alignItems:'center',gap:8}}>
                <svg width={14} height={14} fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                New Class
              </button>
            </div>

            {showCreateClass&&(
              <Card style={{padding:'24px 28px'}}>
                <div style={{fontFamily:"'Nunito',sans-serif",fontSize:17,fontWeight:900,color:'#0f172a',marginBottom:18}}>Create New Class</div>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div><label style={lbl}>Class Name</label><input className="vp-input" type="text" placeholder="e.g. Advanced Biology" value={newClassName} onChange={e=>setNewClassName(e.target.value)} style={inp}/></div>
                  <div><label style={lbl}>Subject (optional)</label><input className="vp-input" type="text" placeholder="e.g. Biology" value={newClassSubject} onChange={e=>setNewClassSubject(e.target.value)} style={inp}/></div>
                  <div style={{display:'flex',gap:10,marginTop:4}}>
                    <button onClick={()=>setShowCreateClass(false)} style={{flex:1,padding:'12px',background:'rgba(15,23,42,0.05)',color:'#475569',border:'none',borderRadius:12,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,cursor:'pointer'}}>Cancel</button>
                    <button onClick={handleCreateClass} className="vp-submit" style={{...btnPrimary,flex:2,padding:'12px',textAlign:'center' as const}}>Create Class</button>
                  </div>
                </div>
              </Card>
            )}

            {myClasses.length===0?(
              <Card style={{padding:'64px 32px',textAlign:'center'}}>
                <div style={{fontSize:40,marginBottom:12}}>🏫</div>
                <div style={{fontFamily:"'Nunito',sans-serif",fontSize:18,fontWeight:900,color:'#0f172a',marginBottom:6}}>No classes yet</div>
                <div style={{fontSize:13,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>Create your first class above to get started.</div>
              </Card>
            ):(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:16}}>
                {myClasses.map(cls=>(
                  <button key={cls.id} onClick={()=>{setSelectedClassId(cls.id);setClassView('detail');}}
                    style={{background:'rgba(255,255,255,0.82)',backdropFilter:'blur(18px)',borderRadius:20,border:'1.5px solid rgba(2,132,199,0.13)',boxShadow:'0 4px 20px rgba(15,23,42,0.07)',padding:'22px 22px 18px',textAlign:'left',cursor:'pointer',transition:'all .2s',outline:'none'}}
                    onMouseOver={e=>{e.currentTarget.style.boxShadow='0 8px 32px rgba(2,132,199,0.18)';e.currentTarget.style.borderColor='rgba(2,132,199,0.3)';e.currentTarget.style.transform='translateY(-2px)';}}
                    onMouseOut={e=>{e.currentTarget.style.boxShadow='0 4px 20px rgba(15,23,42,0.07)';e.currentTarget.style.borderColor='rgba(2,132,199,0.13)';e.currentTarget.style.transform='translateY(0)';}}>
                    <div
  style={{
    minWidth: 70,
    height: 44,
    padding: '0 16px',
    borderRadius: 14,
    background: 'linear-gradient(135deg,#0284c7,#0369a1)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontFamily: "'Nunito',sans-serif",
    fontSize: 15,
    fontWeight: 900,
    marginBottom: 14,
    boxShadow: '0 4px 12px rgba(2,132,199,0.3)',
    letterSpacing: '0.03em'
  }}
>
  {cls.name}
</div>
                    <div style={{fontFamily:"'Nunito',sans-serif",fontSize:16,fontWeight:900,color:'#0f172a',marginBottom:4}}>{cls.subject}</div>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <Badge>{cls.members.length} student{cls.members.length!==1?'s':''}</Badge>
                      {cls.pendingRequests.length>0&&<Badge color="#92400e" bg="rgba(245,158,11,0.1)" border="rgba(245,158,11,0.25)">{cls.pendingRequests.length} pending</Badge>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ ASSIGNMENTS TAB ════ */}
        {tab==='assignments'&&(
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontFamily:"'Nunito',sans-serif",fontSize:26,fontWeight:900,color:'#0f172a'}}>Assignments</div>
                <div style={{fontSize:12,color:'#64748b',fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{myAssignments.length} total</div>
              </div>
              <button onClick={()=>setShowCreateAssignment(true)} className="vp-submit" style={{...btnPrimary,display:'flex',alignItems:'center',gap:8}}>
                <svg width={14} height={14} fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                New Assignment
              </button>
            </div>

            {showCreateAssignment&&(
              <Card style={{padding:'28px 32px'}}>
                <div style={{fontFamily:"'Nunito',sans-serif",fontSize:18,fontWeight:900,color:'#0f172a',marginBottom:20}}>Create New Assignment</div>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div><label style={lbl}>Assignment Title</label><input className="vp-input" type="text" placeholder="e.g. Chapter 5 Quiz" value={newAsgnName} onChange={e=>setNewAsgnName(e.target.value)} style={inp}/></div>
                  <div>
                    <label style={lbl}>Class</label>
                    <select value={newAsgnClassId} onChange={e=>setNewAsgnClassId(e.target.value)} style={{...inp,cursor:'pointer'}}>
                      <option value="">Select a class…</option>
                      {myClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* ── Time Limit picker ── */}
                  <div>
                    <label style={lbl}>⏱ Time Limit <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,color:'#94a3b8'}}>(per student, from when they start)</span></label>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                      {[
                        {label:'No Limit', value: null},
                        {label:'20 min',   value: 20},
                        {label:'30 min',   value: 30},
                        {label:'45 min',   value: 45},
                        {label:'1 hr',     value: 60},
                        {label:'1.5 hr',   value: 90},
                        {label:'2 hr',     value: 120},
                        {label:'Custom',   value: -1},
                      ].map(opt => {
                        const isCustomMode = opt.value === -1;
                        const isActive = isCustomMode
                          ? (newAsgnTimeLimit !== null && ![20,30,45,60,90,120].includes(newAsgnTimeLimit!))
                          : newAsgnTimeLimit === opt.value;
                        return (
                          <button
                            key={String(opt.value)}
                            type="button"
                            onClick={() => {
                              if (isCustomMode) {
                                setNewAsgnTimeLimitCustom('');
                                setNewAsgnTimeLimit(-1 as any); // flag to show input
                              } else {
                                setNewAsgnTimeLimit(opt.value as number | null);
                                setNewAsgnTimeLimitCustom('');
                              }
                            }}
                            style={{
                              padding:'7px 14px',border:'1.5px solid',borderRadius:10,
                              fontSize:12,fontWeight:700,cursor:'pointer',
                              fontFamily:"'DM Sans',sans-serif",letterSpacing:'0.04em',
                              transition:'all .15s',
                              background: isActive ? 'linear-gradient(135deg,#0284c7,#0369a1)' : 'rgba(2,132,199,0.05)',
                              color: isActive ? 'white' : '#0284c7',
                              borderColor: isActive ? '#0284c7' : 'rgba(2,132,199,0.2)',
                              boxShadow: isActive ? '0 3px 10px rgba(2,132,199,0.25)' : 'none',
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Custom minutes input */}
                    {(newAsgnTimeLimit !== null && newAsgnTimeLimit !== undefined && ![20,30,45,60,90,120].includes(newAsgnTimeLimit as number) && newAsgnTimeLimit !== null) && (
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <input
                          type="number" min={1} max={300} placeholder="Enter minutes…"
                          value={newAsgnTimeLimitCustom}
                          onChange={e => {
                            const v = e.target.value;
                            setNewAsgnTimeLimitCustom(v);
                            const n = parseInt(v, 10);
                            setNewAsgnTimeLimit(isNaN(n) || n < 1 ? null : n);
                          }}
                          style={{...inp, width:160}}
                          className="vp-input"
                        />
                        <span style={{fontSize:12,color:'#64748b',fontFamily:"'DM Sans',sans-serif"}}>minutes</span>
                      </div>
                    )}
                    {newAsgnTimeLimit && newAsgnTimeLimit > 0 && (
                      <div style={{marginTop:6,fontSize:11,color:'#0284c7',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                        ✓ Each student will have {newAsgnTimeLimit >= 60 ? `${Math.floor(newAsgnTimeLimit/60)}h${newAsgnTimeLimit%60>0?` ${newAsgnTimeLimit%60}m`:''}` : `${newAsgnTimeLimit} min`} from when they open the exam.
                      </div>
                    )}
                  </div>

                  {/* mode toggle */}
                  <div style={{display:'flex',gap:6,background:'rgba(2,132,199,0.06)',padding:4,borderRadius:12}}>
                    {(['manual','upload'] as QuestionInputMode[]).map(m=>(
                      <button key={m} onClick={()=>setQuestionInputMode(m)} style={{
                        flex:1,padding:'9px 0',border:'none',borderRadius:9,
                        background:questionInputMode===m?'white':'transparent',
                        color:questionInputMode===m?'#0284c7':'#64748b',
                        fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:800,
                        letterSpacing:'0.06em',textTransform:'uppercase' as const,cursor:'pointer',
                        boxShadow:questionInputMode===m?'0 2px 8px rgba(2,132,199,0.15)':'none',
                        transition:'all .18s',
                      }}>
                        {m==='manual'?'✍ Manual Entry':'📄 Upload .docx'}
                      </button>
                    ))}
                  </div>

                  {/* ── UPLOAD mode ── */}
                  {questionInputMode==='upload'&&(
                    <div>
                      <input ref={fileInputRef} type="file" accept=".docx" style={{display:'none'}} onChange={handleDocUpload}/>
                      <button onClick={()=>fileInputRef.current?.click()} style={{
                        width:'100%',padding:'20px',border:'2px dashed rgba(2,132,199,0.3)',borderRadius:14,
                        background:'rgba(2,132,199,0.03)',cursor:'pointer',
                        fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,
                        color:uploadedFileName?'#0284c7':'#94a3b8',
                        transition:'all .2s',
                      }}
                      onMouseOver={e=>{e.currentTarget.style.borderColor='rgba(2,132,199,0.5)';e.currentTarget.style.background='rgba(2,132,199,0.06)';}}
                      onMouseOut={e=>{e.currentTarget.style.borderColor='rgba(2,132,199,0.3)';e.currentTarget.style.background='rgba(2,132,199,0.03)';}}>
                        {uploadedFileName||'Click to upload .docx marking scheme'}
                      </button>

                      {/* ── BIG parse status banner ── */}
                      {docParseStatus==='parsing'&&(
                        <div style={{
                          marginTop:14,padding:'20px 24px',
                          background:'linear-gradient(135deg,rgba(2,132,199,0.08),rgba(56,189,248,0.08))',
                          border:'2px solid rgba(2,132,199,0.2)',borderRadius:16,
                          display:'flex',alignItems:'center',gap:16,
                        }}>
                          <div style={{
                            width:44,height:44,borderRadius:14,
                            background:'linear-gradient(135deg,#0284c7,#38bdf8)',
                            display:'flex',alignItems:'center',justifyContent:'center',
                            flexShrink:0,boxShadow:'0 4px 16px rgba(2,132,199,0.35)',
                          }}>
                            <svg width={22} height={22} fill="none" viewBox="0 0 24 24" style={{animation:'spin 1s linear infinite'}}>
                              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" opacity=".25"/>
                              <path fill="white" d="M4 12a8 8 0 018-8v8H4z" opacity=".85"/>
                            </svg>
                          </div>
                          <div>
                            <div style={{fontFamily:"'Nunito',sans-serif",fontSize:16,fontWeight:900,color:'#0284c7'}}>Parsing Document…</div>
                            <div style={{fontSize:12,color:'#64748b',fontFamily:"'DM Sans',sans-serif",marginTop:2}}>AI is extracting questions and model answers from <strong>{uploadedFileName}</strong></div>
                          </div>
                          <div style={{marginLeft:'auto',display:'flex',gap:4}}>
                            {[0,1,2].map(i=>(
                              <div key={i} style={{
                                width:8,height:8,borderRadius:'50%',background:'#0284c7',
                                animation:`vpPulse 1.2s ease-in-out infinite`,animationDelay:`${i*0.2}s`,
                              }}/>
                            ))}
                          </div>
                        </div>
                      )}

                      {docParseStatus==='done'&&(
                        <div style={{
                          marginTop:14,padding:'18px 22px',
                          background:'linear-gradient(135deg,rgba(5,150,105,0.07),rgba(52,211,153,0.07))',
                          border:'2px solid rgba(5,150,105,0.25)',borderRadius:16,
                          display:'flex',alignItems:'center',gap:14,
                        }}>
                          <div style={{width:40,height:40,borderRadius:12,background:'linear-gradient(135deg,#059669,#34d399)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 4px 14px rgba(5,150,105,0.3)'}}>
                            <svg width={20} height={20} fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                          </div>
                          <div>
                            <div style={{fontFamily:"'Nunito',sans-serif",fontSize:15,fontWeight:900,color:'#059669'}}>Parsed Successfully!</div>
                            <div style={{fontSize:12,color:'#047857',fontFamily:"'DM Sans',sans-serif",marginTop:1}}>{questions.length} question{questions.length!==1?'s':''} extracted from {uploadedFileName}</div>
                          </div>
                          <Badge color="#059669" bg="rgba(5,150,105,0.1)" border="rgba(5,150,105,0.25)" >{questions.length} Q</Badge>
                        </div>
                      )}

                      {docParseStatus==='error'&&(
                        <div style={{
                          marginTop:14,padding:'18px 22px',
                          background:'linear-gradient(135deg,rgba(220,38,38,0.06),rgba(251,191,36,0.06))',
                          border:'2px solid rgba(220,38,38,0.2)',borderRadius:16,
                          display:'flex',alignItems:'center',gap:14,
                        }}>
                          <div style={{width:40,height:40,borderRadius:12,background:'linear-gradient(135deg,#dc2626,#f87171)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 4px 14px rgba(220,38,38,0.25)'}}>
                            <svg width={20} height={20} fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          </div>
                          <div>
                            <div style={{fontFamily:"'Nunito',sans-serif",fontSize:15,fontWeight:900,color:'#dc2626'}}>Parse Failed</div>
                            <div style={{fontSize:12,color:'#b91c1c',fontFamily:"'DM Sans',sans-serif",marginTop:1}}>{docParseError}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── MANUAL mode ── */}
                  {questionInputMode==='manual'&&(
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {questions.map((q,i)=>(
                        <div key={i} style={{background:'rgba(2,132,199,0.04)',border:'1.5px solid rgba(2,132,199,0.1)',borderRadius:14,padding:'14px 16px',display:'flex',flexDirection:'column',gap:8}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                            <span style={{width:24,height:24,borderRadius:8,background:'linear-gradient(135deg,#0284c7,#38bdf8)',color:'white',fontSize:11,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</span>
                            <span style={{fontSize:11,fontWeight:700,color:'#0284c7',fontFamily:"'DM Sans',sans-serif",textTransform:'uppercase',letterSpacing:'0.1em'}}>Question {i+1}</span>
                          </div>
                          <input type="text" placeholder={`Question ${i+1}`} value={q.question} onChange={e=>{const n=[...questions];n[i].question=e.target.value;setQuestions(n);}} style={inp} className="vp-input"/>
                          <input type="text" placeholder="Model answer (optional)" value={q.modelAnswer} onChange={e=>{const n=[...questions];n[i].modelAnswer=e.target.value;setQuestions(n);}} style={{...inp,background:'rgba(2,132,199,0.03)'}} className="vp-input"/>
                        </div>
                      ))}
                      <button onClick={()=>setQuestions([...questions,{question:'',modelAnswer:''}])} style={{
                        padding:'12px',border:'2px dashed rgba(2,132,199,0.25)',borderRadius:12,
                        background:'transparent',cursor:'pointer',
                        fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:700,
                        color:'#94a3b8',transition:'all .2s',
                      }}
                      onMouseOver={e=>{e.currentTarget.style.borderColor='rgba(2,132,199,0.5)';e.currentTarget.style.color='#0284c7';}}
                      onMouseOut={e=>{e.currentTarget.style.borderColor='rgba(2,132,199,0.25)';e.currentTarget.style.color='#94a3b8';}}>
                        + Add Question
                      </button>
                    </div>
                  )}

                  <div style={{display:'flex',gap:10,marginTop:4}}>
                    <button onClick={()=>{setShowCreateAssignment(false);setQuestions([{question:'',modelAnswer:''}]);setQuestionInputMode('manual');setDocParseStatus('idle');setUploadedFileName('');setDocParseError('');setNewAsgnTimeLimit(null);setNewAsgnTimeLimitCustom('');}}
                      style={{flex:1,padding:'12px',background:'rgba(15,23,42,0.05)',color:'#475569',border:'none',borderRadius:12,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,cursor:'pointer'}}>Cancel</button>
                    <button onClick={handleCreateAssignment} className="vp-submit" style={{...btnPrimary,flex:2,padding:'12px',textAlign:'center' as const}}>Save as Draft</button>
                  </div>
                </div>
              </Card>
            )}

            {myAssignments.length===0?(
              <Card style={{padding:'64px 32px',textAlign:'center'}}>
                <div style={{fontSize:40,marginBottom:12}}>📋</div>
                <div style={{fontFamily:"'Nunito',sans-serif",fontSize:18,fontWeight:900,color:'#0f172a',marginBottom:6}}>No assignments yet</div>
                <div style={{fontSize:13,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>Create your first assignment above.</div>
              </Card>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {myAssignments.map(a=>{
                  const cls = myClasses.find(c=>c.id===a.classId);
                  const pendingSubs = a.submissions.filter(s=>s.status==='Pending').length;
                  return (
                    <Card key={a.id} style={{padding:'18px 22px',display:'flex',alignItems:'center',gap:16}}>
                      <div style={{width:40,height:40,borderRadius:12,background:a.status==='Published'?'linear-gradient(135deg,#059669,#34d399)':'linear-gradient(135deg,#94a3b8,#64748b)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <svg width={18} height={18} fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                          <span style={{fontFamily:"'Nunito',sans-serif",fontSize:15,fontWeight:900,color:'#0f172a'}}>{a.name}</span>
                          <Badge color={a.status==='Published'?'#059669':'#64748b'} bg={a.status==='Published'?'rgba(5,150,105,0.08)':'rgba(100,116,139,0.08)'} border={a.status==='Published'?'rgba(5,150,105,0.2)':'rgba(100,116,139,0.2)'}>{a.status}</Badge>
                          {pendingSubs>0&&<Badge color="#dc2626" bg="rgba(220,38,38,0.08)" border="rgba(220,38,38,0.2)">{pendingSubs} to grade</Badge>}
                        </div>
                        <div style={{fontSize:11,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>
                          {cls?.name||'Unknown class'} · {a.questions.length} question{a.questions.length!==1?'s':''} · {a.submissions.length} submission{a.submissions.length!==1?'s':''}
                          {(a as any).timeLimitMinutes ? (
                            <span style={{marginLeft:8,display:'inline-flex',alignItems:'center',gap:3,color:'#0284c7',fontWeight:700}}>
                              · ⏱ {(a as any).timeLimitMinutes >= 60 ? `${Math.floor((a as any).timeLimitMinutes/60)}h${(a as any).timeLimitMinutes%60>0?` ${(a as any).timeLimitMinutes%60}m`:''}` : `${(a as any).timeLimitMinutes} min`}
                            </span>
                          ) : (
                            <span style={{marginLeft:8,color:'#cbd5e1'}}>· No limit</span>
                          )}
                        </div>
                      </div>
                      <div style={{display:'flex',gap:8,flexShrink:0}}>
                        <button onClick={()=>handlePublishToggle(a.id)} style={{
                          padding:'8px 16px',border:'none',borderRadius:10,cursor:'pointer',
                          fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:800,letterSpacing:'0.06em',
                          background:a.status==='Draft'?'linear-gradient(135deg,#0284c7,#0369a1)':'rgba(15,23,42,0.06)',
                          color:a.status==='Draft'?'white':'#475569',
                          boxShadow:a.status==='Draft'?'0 3px 12px rgba(2,132,199,0.28)':'none',
                          transition:'all .15s',
                        }}>
                          {a.status==='Draft'?'Publish':'Unpublish'}
                        </button>
                        <button onClick={()=>handleDeleteAssignment(a.id)} style={{padding:8,background:'none',border:'none',cursor:'pointer',color:'#cbd5e1',borderRadius:10,transition:'all .15s'}}
                          onMouseOver={e=>{e.currentTarget.style.color='#dc2626';e.currentTarget.style.background='#fef2f2';}}
                          onMouseOut={e=>{e.currentTarget.style.color='#cbd5e1';e.currentTarget.style.background='none';}}>
                          <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ GRADES TAB ════ */}
        {tab==='grades'&&(
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            <div>
              <div style={{fontFamily:"'Nunito',sans-serif",fontSize:26,fontWeight:900,color:'#0f172a'}}>Submissions & Grades</div>
              <div style={{fontSize:12,color:'#64748b',fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{totalPendingSubs} pending grade{totalPendingSubs!==1?'s':''}</div>
            </div>

            {myAssignments.every(a=>a.submissions.length===0)?(
              <Card style={{padding:'64px 32px',textAlign:'center'}}>
                <div style={{fontSize:40,marginBottom:12}}>📊</div>
                <div style={{fontFamily:"'Nunito',sans-serif",fontSize:18,fontWeight:900,color:'#0f172a',marginBottom:6}}>No submissions yet</div>
                <div style={{fontSize:13,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>Publish an assignment and students will submit here.</div>
              </Card>
            ):(
              myAssignments.filter(a=>a.submissions.length>0).map(a=>{
                const cls = myClasses.find(c=>c.id===a.classId);
                const pendingSubs = a.submissions.filter(s=>s.status==='Pending');
                const gradedSubs = a.submissions.filter(s=>s.status==='Graded');
                const allGraded = a.submissions.length>0&&pendingSubs.length===0;
                const chartData = gradedSubs.map(s=>({
                  name:s.studentName.split(' ')[0],
                  score:parseFloat(((s.results?.reduce((r,b)=>r+b.score,0)||0)/(s.results?.length||1)).toFixed(1)),
                  hasViolation:s.violations>0,
                }));
                const classAvg = chartData.length>0?(chartData.reduce((acc,d)=>acc+d.score,0)/chartData.length).toFixed(1):null;
                return (
                  <Card key={a.id} style={{overflow:'hidden'}}>
                    <div style={{padding:'18px 22px',borderBottom:'1.5px solid rgba(2,132,199,0.07)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',background:'linear-gradient(135deg,rgba(2,132,199,0.03),rgba(56,189,248,0.03))'}}>
                      <div>
                        <div style={{fontFamily:"'Nunito',sans-serif",fontSize:16,fontWeight:900,color:'#0f172a'}}>{a.name}</div>
                        <div style={{fontSize:11,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{cls?.name||'—'} · {a.submissions.length} submission{a.submissions.length!==1?'s':''}</div>
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                        <Badge color={a.status==='Published'?'#059669':'#64748b'} bg={a.status==='Published'?'rgba(5,150,105,0.08)':'rgba(100,116,139,0.08)'} border={a.status==='Published'?'rgba(5,150,105,0.2)':'rgba(100,116,139,0.2)'}>{a.status}</Badge>
                        {allGraded&&(
                          <button onClick={()=>downloadMasterReport(a)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'#0f172a',color:'white',border:'none',borderRadius:10,fontSize:11,fontWeight:800,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",letterSpacing:'0.06em'}}>
                            <svg width={13} height={13} fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
                            Master Report
                          </button>
                        )}
                        {pendingSubs.length>0&&(
                          <button onClick={()=>handleGradeAll(a.id)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'linear-gradient(135deg,#0284c7,#0369a1)',color:'white',border:'none',borderRadius:10,fontSize:11,fontWeight:800,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",letterSpacing:'0.06em',boxShadow:'0 3px 12px rgba(2,132,199,0.28)'}}>
                            <svg width={13} height={13} fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
                            Grade All ({pendingSubs.length})
                          </button>
                        )}
                      </div>
                    </div>

                    {allGraded&&chartData.length>0&&(
                      <div style={{padding:'18px 22px',borderBottom:'1.5px solid rgba(2,132,199,0.07)',background:'rgba(2,132,199,0.02)'}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
                          <div>
                            <div style={{fontSize:10,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.14em',fontFamily:"'DM Sans',sans-serif"}}>Class Performance</div>
                            <div style={{fontSize:13,fontWeight:700,color:'#0f172a',fontFamily:"'DM Sans',sans-serif",marginTop:2}}>
                              Class Average: <span style={{color:'#0284c7'}}>{classAvg} / 10</span>
                            </div>
                          </div>
                          <div style={{display:'flex',gap:12,fontSize:10,fontWeight:700,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>
                            <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:10,height:10,borderRadius:3,background:'#0284c7',display:'inline-block'}}/> ≥7 Pass</span>
                            <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:10,height:10,borderRadius:3,background:'#f59e0b',display:'inline-block'}}/> ≥4 Partial</span>
                            <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:10,height:10,borderRadius:3,background:'#f87171',display:'inline-block'}}/> &lt;4</span>
                          </div>
                        </div>
                        <div style={{overflowX:'auto'}}>
                          <svg width={Math.max(chartData.length*60,320)} height={185} style={{display:'block',minWidth:'100%'}}>
                            {[0,2,4,6,8,10].map(v=>{
                              const y=140-(v/10)*120;
                              return (<g key={v}><line x1={32} y1={y} x2={Math.max(chartData.length*60,320)-8} y2={y} stroke="#f1f5f9" strokeWidth={1}/><text x={26} y={y+4} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{v}</text></g>);
                            })}
                            {classAvg&&<line x1={32} y1={140-(parseFloat(classAvg)/10)*120} x2={Math.max(chartData.length*60,320)-8} y2={140-(parseFloat(classAvg)/10)*120} stroke="#0284c7" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.5}/>}
                            {chartData.map((d,i)=>{
                              const barH=Math.max((d.score/10)*120,4);
                              const x=38+i*60; const y=140-barH;
                              const color=d.hasViolation?'#f87171':d.score>=7?'#0284c7':d.score>=4?'#f59e0b':'#f87171';
                              return (<g key={i}><rect x={x} y={y} width={38} height={barH} rx={6} fill={color} opacity={0.85}/><text x={x+19} y={y-5} textAnchor="middle" fontSize={9} fontWeight="700" fill={color} fontFamily="monospace">{d.score}</text><text x={x+19} y={158} textAnchor="middle" fontSize={9} fill="#64748b" fontFamily="sans-serif">{d.name.length>7?d.name.slice(0,7)+'…':d.name}</text>{d.hasViolation&&<text x={x+19} y={171} textAnchor="middle" fontSize={9} fill="#ef4444">⚠</text>}</g>);
                            })}
                            <line x1={32} y1={20} x2={32} y2={140} stroke="#e2e8f0" strokeWidth={1}/>
                            <line x1={32} y1={140} x2={Math.max(chartData.length*60,320)-8} y2={140} stroke="#e2e8f0" strokeWidth={1}/>
                          </svg>
                        </div>
                      </div>
                    )}

                    <div>
                      {a.submissions.map(sub=>{
                        const avg = sub.status==='Graded'&&sub.results?(sub.results.reduce((acc,r)=>acc+r.score,0)/sub.results.length).toFixed(1):null;
                        return (
                          <div key={sub.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'14px 22px',borderBottom:'1px solid rgba(2,132,199,0.05)',transition:'background .15s'}}
                            onMouseOver={e=>e.currentTarget.style.background='rgba(2,132,199,0.03)'}
                            onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                            <div style={{display:'flex',alignItems:'center',gap:10}}>
                              <div style={{width:36,height:36,borderRadius:11,background:'linear-gradient(135deg,rgba(2,132,199,0.12),rgba(56,189,248,0.12))',border:'1.5px solid rgba(2,132,199,0.15)',color:'#0284c7',fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                {sub.studentName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{fontSize:13,fontWeight:700,color:'#0f172a',fontFamily:"'DM Sans',sans-serif"}}>{sub.studentName}</div>
                                <div style={{fontSize:11,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>
                                  {new Date(sub.submittedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                                  {sub.violations>0&&<span style={{marginLeft:8,color:'#dc2626',fontWeight:700}}>⚠ {sub.violations} violation{sub.violations>1?'s':''}</span>}
                                </div>
                              </div>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:10}}>
                              {avg!==null?(
                                <span style={{fontFamily:"'Nunito',sans-serif",fontSize:17,fontWeight:900,color:'#0284c7'}}>{avg}<span style={{fontSize:11,color:'#94a3b8',fontWeight:400}}>/10</span></span>
                              ):(
                                <Badge color="#d97706" bg="rgba(245,158,11,0.08)" border="rgba(245,158,11,0.2)">Pending</Badge>
                              )}
                              <button onClick={()=>startGrading(a.id,sub.id,a.questions.length)} style={{
                                padding:'7px 14px',border:'1.5px solid rgba(2,132,199,0.2)',borderRadius:10,
                                background:'rgba(2,132,199,0.05)',color:'#0284c7',
                                fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:800,cursor:'pointer',
                                transition:'all .15s',
                              }}
                              onMouseOver={e=>{e.currentTarget.style.background='rgba(2,132,199,0.12)';}}
                              onMouseOut={e=>{e.currentTarget.style.background='rgba(2,132,199,0.05)';}}>
                                {sub.status==='Graded'?'Re-grade':'Grade'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* ════ CONTESTS TAB ════ */}
        {tab==='contests'&&(
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            <div>
              <div style={{fontFamily:"'Nunito',sans-serif",fontSize:26,fontWeight:900,color:'#0f172a'}}>Grade Contests</div>
              <div style={{fontSize:12,color:'#64748b',fontFamily:"'DM Sans',sans-serif",marginTop:2}}>Students can contest grades within 7 days. Review and respond below.</div>
            </div>

            {/* approve contest modal */}
            {reviewingContestId&&(()=>{
              const contest=(appData.contestRequests||[]).find(r=>r.id===reviewingContestId)!;
              const asgn=appData.assignments.find(a=>a.id===contest.assignmentId)!;
              const sub=asgn?.submissions.find(s=>s.id===contest.submissionId)!;
              if (!asgn||!sub) return null;
              return (
                <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.5)',backdropFilter:'blur(8px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
                  <Card style={{padding:'32px',maxWidth:620,width:'100%',borderRadius:28,maxHeight:'90vh',overflowY:'auto'}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22}}>
                      <div>
                        <div style={{fontSize:10,fontWeight:800,color:'#0284c7',textTransform:'uppercase',letterSpacing:'0.16em',fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>{asgn.name}</div>
                        <div style={{fontFamily:"'Nunito',sans-serif",fontSize:20,fontWeight:900,color:'#0f172a'}}>Editing grades for {contest.studentName}</div>
                        <div style={{fontSize:12,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif",marginTop:2}}>Adjust scores below — feedback stays the same.</div>
                      </div>
                      <button onClick={()=>setReviewingContestId(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',padding:4}}>
                        <svg width={18} height={18} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                    <div style={{background:'rgba(2,132,199,0.06)',border:'1.5px solid rgba(2,132,199,0.15)',borderRadius:14,padding:'14px 16px',marginBottom:20}}>
                      <div style={{fontSize:10,fontWeight:800,color:'#0284c7',textTransform:'uppercase',letterSpacing:'0.14em',fontFamily:"'DM Sans',sans-serif",marginBottom:6}}>Student's Reason</div>
                      <div style={{fontSize:13,color:'#4c1d95',fontFamily:"'DM Sans',sans-serif"}}>{contest.reason}</div>
                    </div>
                    {/* ── Violation Screenshots ── */}
                    {sub.violations>0&&(
                      <div style={{marginBottom:20}}>
                        <div style={{fontSize:10,fontWeight:800,color:'#dc2626',textTransform:'uppercase',letterSpacing:'0.14em',fontFamily:"'DM Sans',sans-serif",marginBottom:8}}>
                          📷 Violation Screenshots
                          <span style={{marginLeft:8,fontSize:9,fontWeight:600,color:'#94a3b8',textTransform:'none',letterSpacing:0}}>Auto-deleted after 7 days</span>
                        </div>
                        {loadingScreenshots[sub.id]?(
                          <div style={{fontSize:11,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>Loading screenshots…</div>
                        ):(violationScreenshots[sub.id]?.length??0)>0?(
                          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                            {violationScreenshots[sub.id].map((url,idx)=>(
                              <a key={idx} href={url} target="_blank" rel="noopener noreferrer" style={{display:'block',border:'2px solid #fecaca',borderRadius:10,overflow:'hidden',cursor:'pointer',flexShrink:0,transition:'border-color .15s'}}
                                onMouseOver={e=>e.currentTarget.style.borderColor='#ef4444'}
                                onMouseOut={e=>e.currentTarget.style.borderColor='#fecaca'}>
                                <img src={url} alt={`Violation ${idx+1}`} style={{width:130,height:88,objectFit:'cover',display:'block'}}/>
                              </a>
                            ))}
                          </div>
                        ):(violationScreenshots[sub.id]!==undefined)?(
                          <div style={{fontSize:11,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>No screenshots stored (may have expired).</div>
                        ):(
                          <button onClick={()=>fetchScreenshots(sub.id)} style={{fontSize:11,fontWeight:700,color:'#0284c7',background:'rgba(2,132,199,0.07)',border:'1.5px solid rgba(2,132,199,0.2)',borderRadius:8,padding:'5px 14px',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                            Load Screenshots
                          </button>
                        )}
                      </div>
                    )}
                    <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:20}}>
                      {asgn.questions.map((q,i)=>(
                        <div key={q.id} style={{background:'rgba(2,132,199,0.03)',border:'1.5px solid rgba(2,132,199,0.1)',borderRadius:14,padding:'14px 16px'}}>
                          <div style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:10}}>
                            <span style={{width:24,height:24,borderRadius:7,background:'rgba(2,132,199,0.12)',color:'#0284c7',fontSize:10,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</span>
                            <span style={{fontSize:13,fontWeight:700,color:'#0f172a',fontFamily:"'DM Sans',sans-serif"}}>{q.question}</span>
                          </div>
                          <div style={{marginLeft:34,display:'flex',flexDirection:'column',gap:8}}>
                            <div style={{background:'white',borderRadius:10,padding:'10px 12px'}}>
                              <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>Student's Answer</div>
                              <div style={{fontSize:12,color:'#334155',fontFamily:"'DM Sans',sans-serif"}}>{sub.answers[i]||<span style={{fontStyle:'italic',color:'#94a3b8'}}>No answer</span>}</div>
                            </div>
                            {sub.results?.[i]&&<div style={{fontSize:11,color:'#94a3b8',fontStyle:'italic',fontFamily:"'DM Sans',sans-serif"}}>Original AI feedback: {sub.results[i].feedback}</div>}
                            <div style={{display:'flex',alignItems:'center',gap:10}}>
                              <label style={{...lbl,margin:0}}>New Score</label>
                              <input type="number" min={0} max={10}
                                value={contestEditScores[i]??sub.results?.[i]?.score??5}
                                onChange={e=>{const n=[...contestEditScores];n[i]=Math.min(10,Math.max(0,Number(e.target.value)));setContestEditScores(n);}}
                                style={{...inp,width:72,textAlign:'center',fontWeight:800}} className="vp-input"/>
                              {sub.results?.[i]&&contestEditScores[i]!==sub.results[i].score&&(
                                <span style={{fontSize:11,fontWeight:700,color:'#0284c7',fontFamily:"'DM Sans',sans-serif"}}>{sub.results[i].score} → {contestEditScores[i]}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {/* ── Follow-Up Questions (Round 2) ── */}
                      {(()=>{
                        const followUpQs: string[] = (sub as any).followUpQuestions || [];
                        if (followUpQs.length === 0) return null;
                        const r1Count = asgn.questions.length;
                        return (
                          <>
                            <div style={{display:'flex',alignItems:'center',gap:10,margin:'6px 0 10px'}}>
                              <div style={{flex:1,height:1,background:'rgba(217,119,6,0.2)'}}/>
                              <span style={{fontSize:9,fontWeight:800,color:'#92400e',textTransform:'uppercase',letterSpacing:'0.14em',fontFamily:"'DM Sans',sans-serif",background:'rgba(254,243,199,0.8)',border:'1px solid rgba(217,119,6,0.2)',padding:'3px 12px',borderRadius:999}}>
                                Round 2 · Follow-Up Questions
                              </span>
                              <div style={{flex:1,height:1,background:'rgba(217,119,6,0.2)'}}/>
                            </div>
                            {followUpQs.map((q, i) => {
                              const answerIdx = r1Count + i;
                              return (
                                <div key={i} style={{background:'rgba(217,119,6,0.04)',border:'1.5px solid rgba(217,119,6,0.18)',borderRadius:14,padding:'14px 16px'}}>
                                  <div style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:10}}>
                                    <span style={{width:24,height:24,borderRadius:7,background:'rgba(217,119,6,0.12)',color:'#d97706',fontSize:10,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>F{i+1}</span>
                                    <span style={{fontSize:13,fontWeight:700,color:'#0f172a',fontFamily:"'DM Sans',sans-serif"}}>{q}</span>
                                  </div>
                                  <div style={{marginLeft:34,display:'flex',flexDirection:'column',gap:8}}>
                                    <div style={{background:'white',borderRadius:10,padding:'10px 12px'}}>
                                      <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>Student's Answer</div>
                                      <div style={{fontSize:12,color:'#334155',fontFamily:"'DM Sans',sans-serif"}}>{sub.answers[answerIdx]||<span style={{fontStyle:'italic',color:'#94a3b8'}}>No answer</span>}</div>
                                    </div>
                                    {sub.results?.[answerIdx]&&<div style={{fontSize:11,color:'#94a3b8',fontStyle:'italic',fontFamily:"'DM Sans',sans-serif"}}>Original AI feedback: {sub.results[answerIdx].feedback}</div>}
                                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                                      <label style={{...lbl,margin:0}}>New Score</label>
                                      <input type="number" min={0} max={10}
                                        value={contestEditScores[answerIdx]??sub.results?.[answerIdx]?.score??5}
                                        onChange={e=>{const n=[...contestEditScores];n[answerIdx]=Math.min(10,Math.max(0,Number(e.target.value)));setContestEditScores(n);}}
                                        style={{...inp,width:72,textAlign:'center',fontWeight:800}} className="vp-input"/>
                                      {sub.results?.[answerIdx]&&contestEditScores[answerIdx]!==sub.results[answerIdx].score&&(
                                        <span style={{fontSize:11,fontWeight:700,color:'#d97706',fontFamily:"'DM Sans',sans-serif"}}>{sub.results[answerIdx].score} → {contestEditScores[answerIdx]}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                    <div style={{marginBottom:18}}>
                      <label style={lbl}>Note to Student (optional)</label>
                      <input type="text" placeholder="e.g. Reviewed Q2 — partial credit added" value={contestTeacherNote} onChange={e=>setContestTeacherNote(e.target.value)} style={inp} className="vp-input"/>
                    </div>
                    <div style={{display:'flex',gap:10}}>
                      <button onClick={()=>setReviewingContestId(null)} style={{flex:1,padding:'12px',background:'rgba(15,23,42,0.05)',color:'#475569',border:'none',borderRadius:12,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,cursor:'pointer'}}>Cancel</button>
                      <button onClick={handleApproveContest} className="vp-submit" style={{...btnPrimary,flex:2,padding:'12px',background:'linear-gradient(135deg,#0284c7,#0369a1)',boxShadow:'0 4px 16px rgba(2,132,199,0.3)',textAlign:'center' as const}}>Save & Approve Contest</button>
                    </div>
                  </Card>
                </div>
              );
            })()}

            {/* reject modal */}
            {rejectingContestId&&!reviewingContestId&&(()=>{
              const rc=(appData.contestRequests||[]).find(r=>r.id===rejectingContestId); if (!rc) return null;
              return (
                <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.5)',backdropFilter:'blur(8px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
                  <Card style={{padding:'32px',maxWidth:480,width:'100%',borderRadius:28}}>
                    <div style={{fontFamily:"'Nunito',sans-serif",fontSize:19,fontWeight:900,color:'#0f172a',marginBottom:4}}>Reject Contest Request</div>
                    <div style={{fontSize:12,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif",marginBottom:18}}>{rc.studentName} · {rc.assignmentName}</div>
                    <div style={{background:'rgba(15,23,42,0.03)',borderRadius:12,padding:'12px 14px',marginBottom:16}}>
                      <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>Student's Reason</div>
                      <div style={{fontSize:13,color:'#334155',fontFamily:"'DM Sans',sans-serif"}}>{rc.reason}</div>
                    </div>
                    <label style={lbl}>Reason for Rejection <span style={{fontWeight:400,textTransform:'none',letterSpacing:0}}>(shown to student)</span></label>
                    <textarea rows={4} placeholder="e.g. Your answer did not address the key concepts…" value={rejectNote} onChange={e=>setRejectNote(e.target.value)}
                      style={{...inp,resize:'none' as const,height:'auto',marginBottom:18,padding:'12px 14px'}} className="vp-input"/>
                    <div style={{display:'flex',gap:10}}>
                      <button onClick={()=>{setRejectingContestId(null);setRejectNote('');}} style={{flex:1,padding:'12px',background:'rgba(15,23,42,0.05)',color:'#475569',border:'none',borderRadius:12,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,cursor:'pointer'}}>Cancel</button>
                      <button onClick={()=>handleRejectContest(rejectingContestId,rejectNote)} style={{flex:2,padding:'12px',background:'rgba(15,23,42,0.05)',color:'#475569',border:'1px solid rgba(2,132,199,0.12)',borderRadius:12,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:800,cursor:'pointer'}}>Confirm Reject</button>
                    </div>
                  </Card>
                </div>
              );
            })()}

            {(appData.contestRequests||[]).filter(r=>r.teacherId===teacherId).length===0?(
              <Card style={{padding:'64px 32px',textAlign:'center'}}>
                <div style={{fontSize:40,marginBottom:12}}>🏅</div>
                <div style={{fontFamily:"'Nunito',sans-serif",fontSize:18,fontWeight:900,color:'#0f172a',marginBottom:6}}>No contest requests yet</div>
                <div style={{fontSize:13,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>Students can submit requests within 7 days of being graded.</div>
              </Card>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {(appData.contestRequests||[]).filter(r=>r.teacherId===teacherId).sort((a,b)=>b.requestedAt-a.requestedAt).map(r=>{
                  const asgn=appData.assignments.find(a=>a.id===r.assignmentId);
                  const sub=asgn?.submissions.find(s=>s.id===r.submissionId);
                  const currentAvg=sub?.results?(sub.results.reduce((acc,res)=>acc+res.score,0)/sub.results.length).toFixed(1):null;
                  return (
                    <Card key={r.id} style={{padding:'20px 24px',border:r.status==='pending'?'1.5px solid rgba(2,132,199,0.2)':'1.5px solid rgba(2,132,199,0.13)'}}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:14,flexWrap:'wrap'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:40,height:40,borderRadius:13,background:'linear-gradient(135deg,rgba(2,132,199,0.1),rgba(139,92,246,0.1))',color:'#0284c7',fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            {r.studentName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{fontFamily:"'Nunito',sans-serif",fontSize:15,fontWeight:900,color:'#0f172a'}}>{r.studentName}</div>
                            <div style={{fontSize:11,color:'#94a3b8',fontFamily:"'DM Sans',sans-serif"}}>{r.assignmentName} · {new Date(r.requestedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                          </div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          {currentAvg&&<span style={{fontFamily:"'Nunito',sans-serif",fontSize:15,fontWeight:900,color:'#0284c7'}}>{currentAvg}<span style={{fontSize:10,color:'#94a3b8',fontWeight:400}}>/10</span></span>}
                          <Badge color={r.status==='approved'?'#059669':r.status==='rejected'?'#dc2626':'#0284c7'} bg={r.status==='approved'?'rgba(5,150,105,0.08)':r.status==='rejected'?'rgba(220,38,38,0.08)':'rgba(2,132,199,0.08)'} border={r.status==='approved'?'rgba(5,150,105,0.2)':r.status==='rejected'?'rgba(220,38,38,0.2)':'rgba(2,132,199,0.2)'}>
                            {r.status==='approved'?'✓ Approved':r.status==='rejected'?'✗ Rejected':'⏳ Pending'}
                          </Badge>
                        </div>
                      </div>
                      <div style={{background:'rgba(15,23,42,0.03)',borderRadius:12,padding:'12px 14px',marginBottom:r.status==='pending'?14:0}}>
                        <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>Student's Reason</div>
                        <div style={{fontSize:13,color:'#334155',fontFamily:"'DM Sans',sans-serif"}}>{r.reason}</div>
                      </div>
                      {r.status==='approved'&&r.teacherNote&&<div style={{background:'rgba(5,150,105,0.06)',border:'1px solid rgba(5,150,105,0.15)',borderRadius:10,padding:'10px 14px',marginTop:10,fontSize:12,color:'#059669',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Your note: {r.teacherNote}</div>}
                      {r.status==='rejected'&&r.teacherNote&&<div style={{background:'rgba(220,38,38,0.05)',border:'1px solid rgba(220,38,38,0.12)',borderRadius:10,padding:'10px 14px',marginTop:10,fontSize:12,color:'#dc2626',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Rejection reason: {r.teacherNote}</div>}
                      {r.status==='pending'&&(
                        <div style={{display:'flex',gap:10}}>
                          <button onClick={()=>startContestReview(r.id)} style={{flex:1,padding:'10px',background:'linear-gradient(135deg,#0284c7,#0369a1)',color:'white',border:'none',borderRadius:12,fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:800,cursor:'pointer',boxShadow:'0 3px 12px rgba(2,132,199,0.28)',letterSpacing:'0.04em'}}>
                            Approve & Edit Grades
                          </button>
                          <button onClick={()=>{setRejectingContestId(r.id);setRejectNote('');}} style={{padding:'10px 18px',background:'rgba(15,23,42,0.05)',color:'#475569',border:'none',borderRadius:12,fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:800,cursor:'pointer',transition:'all .15s'}}
                            onMouseOver={e=>{e.currentTarget.style.background='rgba(220,38,38,0.08)';e.currentTarget.style.color='#dc2626';}}
                            onMouseOut={e=>{e.currentTarget.style.background='rgba(15,23,42,0.05)';e.currentTarget.style.color='#475569';}}>
                            Reject
                          </button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

/* ─── global styles injected once ─── */
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=Nunito:wght@700;900&display=swap');

  @keyframes vpFloat { 0%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-40px) scale(1.08)} 66%{transform:translate(-20px,20px) scale(0.94)} 100%{transform:translate(0,0) scale(1)} }
  @keyframes vpPulse { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.7);opacity:0.12} }
  @keyframes vpSpin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes vpDrift { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-18px) rotate(22deg)} }
  @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

  .vp-input:focus {
    border-color: rgba(2,132,199,0.5) !important;
    background: rgba(255,255,255,0.9) !important;
    box-shadow: 0 0 0 3px rgba(2,132,199,0.1) !important;
  }
  .vp-input::placeholder { color: rgba(15,23,42,0.32); }
  .vp-submit:hover { opacity: 0.88; transform: translateY(-1px); }
  .vp-submit:active { transform: translateY(0); }
`;

export default TeacherDashboard;

