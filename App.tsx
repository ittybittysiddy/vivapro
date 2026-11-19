// Key changes:
//    After login, calls loadAppData() from Supabase to restore full state
//    Passes Supabase-aware setAppData writes down to dashboards (via supabase.ts helpers)
//    StudentDashboard submission is also persisted to Supabase here
// also now the user refreshes the page and it doesnt logges them out
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import { UserRole, AppData } from './types';
import { loadAppData, createSubmission } from './services/supabase';
import { auth, db } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Preloader from './components/preloader';

const EMPTY_APP_DATA: AppData = { classes: [], assignments: [] };

export default function App() {
  //user role is null before loading then it checks for the role.
  const [userRole,  setUserRole]  = useState<UserRole | null>(null);
  const [userName,  setUserName]  = useState('');
  const [userId,    setUserId]    = useState('');
  const [userEmail, setUserEmail] = useState('');
  //app data is the entire app data e.g classes, assign
  const [appData,   setAppData]   = useState<AppData>(EMPTY_APP_DATA);
  // Start true — show spinner while Firebase checks existing session
  const [loading,   setLoading]   = useState(true);
  // Track whether student is actively in an exam — used to hide signout button
  const [isExamActive, setIsExamActive] = useState(false);
  // Prevents onAuthStateChanged from auto-logging in during a manual login (race condition guard)
  const isManualLogin = React.useRef(false);
  // Prevents onAuthStateChanged from auto-logging in during a manual login (race condition guard)

  // ── Restore session on page load / refresh ────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Skip if we are mid-login — handleLogin will set state itself after role check
      if (isManualLogin.current) return;
      if (firebaseUser) {
        try {
          const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (!userSnap.exists()) {
            setUserRole(null);
            setLoading(false);
            return;
          }

          const userData = userSnap.data() as { role: UserRole; name: string; email: string; createdAt: number };

          // Block unverified new accounts (grandfathers old accounts before May 9)
          const VERIFICATION_REQUIRED_AFTER = new Date('2025-05-09T00:00:00Z').getTime();
          const isNewAccount = (userData.createdAt ?? 0) >= VERIFICATION_REQUIRED_AFTER;
          if (isNewAccount && !firebaseUser.emailVerified) {
            // Don't sign out here — let the signup flow finish writing to Firestore first
            setUserRole(null);
            setLoading(false);
            return;
          }

          const data = await loadAppData();
          setAppData(data);
          setUserRole(userData.role);
          setUserName(userData.name);
          setUserId(firebaseUser.uid);
          setUserEmail(userData.email || firebaseUser.email || '');
        } catch (e) {
          console.error('Failed to restore session:', e);
          setUserRole(null);
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ── Called by Login.tsx after successful sign-in ──────────────────────────────
  const handleLogin = async (role: UserRole, name: string, uid: string, email: string) => {
    isManualLogin.current = true;
    setLoading(true);
    try {
      const data = await loadAppData();
      setAppData(data);
    } catch (e) {
      console.error('Failed to load app data from Supabase', e);
      setAppData(EMPTY_APP_DATA);
    } finally {
      setUserRole(role);
      setUserName(name);
      setUserId(uid);
      setUserEmail(email);
      setLoading(false);
      isManualLogin.current = false;
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await auth.signOut();
    setUserRole(null);
    setUserName('');
    setUserId('');
    setUserEmail('');
    setAppData(EMPTY_APP_DATA);
  };

  // when a student submits an exam this function is called in student dashboard
  // ── Student submission ────────────────────────────────────────
  const studentSetAppData: React.Dispatch<React.SetStateAction<AppData>> = (updater) => {
    setAppData(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      next.assignments.forEach(nextAsgn => {
        const prevAsgn = prev.assignments.find(a => a.id === nextAsgn.id);
        if (!prevAsgn) return;
        nextAsgn.submissions.forEach(sub => {
          const existed = prevAsgn.submissions.some(s => s.id === sub.id);
          if (!existed) {
            createSubmission({
              id: sub.id,
              assignment_id: nextAsgn.id,
              student_id: sub.studentId || userId,
              student_name: sub.studentName,
              student_email: sub.studentEmail || userEmail,
              answers: sub.answers,
              results: sub.results ?? null,
              status: sub.status,
              violations: sub.violations,
              submitted_at: sub.submittedAt,
              answer_edit_flags: (sub as any).answerEditFlags || [],
              original_answers: (sub as any).originalAnswers || [],
              follow_up_questions: (sub as any).followUpQuestions || [],
            }).catch(err => console.error('Failed to save submission:', err));
          }
        });
      });
      return next;
    });
  };

  // ── Loading spinner ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
        <video
          src="/restore.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover absolute inset-0"
        />
        
      </div>
    );
  }

  // ── Unauthenticated: show video preloader → login card ────────────────────
  // FIX: return must wrap <Preloader>, not be inside it
  if (!userRole) {
    return (
      <Preloader>
        <Login onLogin={handleLogin} />
      </Preloader>
    );
  }

  return (
    <Layout userRole={userRole} userName={userName} onLogout={handleLogout} hideSignOut={isExamActive}>
      {userRole === UserRole.TEACHER ? (
        <TeacherDashboard
          appData={appData}
          setAppData={setAppData}
          teacherId={userId}
          teacherName={userName}
        />
      ) : (
        <StudentDashboard
          userName={userName}
          userId={userId}
          userEmail={userEmail}
          appData={appData}
          setAppData={studentSetAppData}
          onExamStateChange={setIsExamActive}
        />
      )}
    </Layout>
  );
}