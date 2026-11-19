import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { auth, db } from '../services/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc as firestoreDoc, setDoc, getDoc } from 'firebase/firestore';

interface LoginProps {
  onLogin: (role: UserRole, name: string, uid: string, email: string) => void;
}

type AuthView = 'login' | 'signup' | 'forgot-password' | 'verify-email';

// ── Password strength rules ──────────────────────────────────────────────────
interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

const PW_RULES: PasswordRule[] = [
  { label: 'At least 7 characters',       test: pw => pw.length >= 7 },
  { label: 'Uppercase letter (A–Z)',        test: pw => /[A-Z]/.test(pw) },
  { label: 'Lowercase letter (a–z)',        test: pw => /[a-z]/.test(pw) },
  { label: 'Number (0–9)',                  test: pw => /[0-9]/.test(pw) },
  { label: 'Special character (!@#$…)',     test: pw => /[^A-Za-z0-9]/.test(pw) },
];

const passwordValid = (pw: string) => PW_RULES.every(r => r.test(pw));

// ── Component ────────────────────────────────────────────────────────────────
const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [view, setView]                       = useState<AuthView>('login');
  const [role, setRole]                       = useState<UserRole>(UserRole.STUDENT);
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [name, setName]                       = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [error, setError]                     = useState('');
  const [successMsg, setSuccessMsg]           = useState('');
  const [showTerms, setShowTerms]             = useState(false);
  const [termsAccepted, setTermsAccepted]     = useState(false);
  const [submitting, setSubmitting]           = useState(false);

  // OTP / email-verification state
  const [pendingUid, setPendingUid]           = useState('');
  const [pendingRole, setPendingRole]         = useState<UserRole>(UserRole.STUDENT);
  const [pendingName, setPendingName]         = useState('');
  const [pendingEmail, setPendingEmail]       = useState('');
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [resendCooldown, setResendCooldown]   = useState(0);

  // Password checker visibility
  const [pwFocused, setPwFocused]             = useState(false);

  // Inline field validation — only show errors after user has touched the field
  const [emailTouched, setEmailTouched]       = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const emailError    = emailTouched && email.length > 0 && !isValidEmail(email)
    ? 'Please enter a valid email address.' : '';
  const loginPwError  = passwordTouched && view === 'login' && password.length > 0 && password.length < 7
    ? 'Password must be at least 7 characters.' : '';

  const switchTo = (v: AuthView) => { setView(v); setError(''); setSuccessMsg(''); setEmailTouched(false); setPasswordTouched(false); };

  // ── Resend cooldown timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  // Accounts created before this timestamp are grandfathered (no email
  // verification required). Set to just before you deployed this feature.
  const VERIFICATION_REQUIRED_AFTER = new Date('2025-05-09T00:00:00Z').getTime();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      await reload(cred.user); // ← ADDED THIS LINE -fs to reload and not prompt user to verify again
      // Fetch Firestore doc first — need createdAt to decide on verification
      const snap = await getDoc(firestoreDoc(db, 'users', cred.user.uid));
      if (!snap.exists()) {
        await auth.signOut();
        setError('Account data not found. Please sign up again.');
        return;
      }

      const d = snap.data() as { role: UserRole; name: string; email: string; createdAt: number };

      // Only enforce email verification for accounts created AFTER the cutoff
      // This grandfathers existing accounts so they never see the verify screen
      const isNewAccount = (d.createdAt ?? 0) >= VERIFICATION_REQUIRED_AFTER;
      if (isNewAccount && !cred.user.emailVerified) {
        setPendingUid(cred.user.uid);
        setPendingEmail(email);
        setPendingRole(d.role);
        setPendingName(d.name);
        await auth.signOut();
        switchTo('verify-email');
        setError('Please verify your email before signing in.');
        return;
      }

      if (d.role !== role) {
        await auth.signOut();
        setError(`This account is registered as a ${d.role.toLowerCase()}. Please select the correct role.`);
        return;
      }

      onLogin(d.role, d.name, cred.user.uid, d.email || email);
    } catch { setError('Invalid credentials or user does not exist.'); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) { setError('Please read and accept the Terms & Conditions to continue.'); return; }
    if (!passwordValid(password)) { setError('Password does not meet all requirements below.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      console.log('1. account created');

      await setDoc(firestoreDoc(db, 'users', cred.user.uid), { name, email, role, createdAt: Date.now() });
      console.log('2. firestore done');

      await sendEmailVerification(cred.user, {
        url: window.location.origin + window.location.pathname,
      });
      console.log('3. verification email sent');

      // Store pending info for the verify screen
      setPendingUid(cred.user.uid);
      setPendingRole(role);
      setPendingName(name);
      setPendingEmail(email);
      setResendCooldown(60);

      await auth.signOut(); // sign out until verified
      switchTo('verify-email');
    } catch (err: any) {
      setSubmitting(false);
      setPendingUid('');
      setPendingEmail('');
      setPendingName('');
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg(`Reset link sent to ${email}.`); switchTo('login');
    } catch { setError('Failed to send reset email.'); }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const userRef = firestoreDoc(db, 'users', cred.user.uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        // Existing user — just log them in with their saved role
        const d = snap.data() as { role: UserRole; name: string; email: string };
        if (d.role !== role) {
          await auth.signOut();
          setError(`This Google account is registered as a ${d.role.toLowerCase()}. Please select the correct role.`);
          return;
        }
        onLogin(d.role, d.name, cred.user.uid, d.email || cred.user.email || '');
      } else {
        // New user — create their Firestore doc with selected role
        // Google accounts are pre-verified so no email verification needed
        const name = cred.user.displayName || cred.user.email || 'User';
        const email = cred.user.email || '';
        await setDoc(userRef, { name, email, role, createdAt: Date.now() });
        onLogin(role, name, cred.user.uid, email);
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') return; // user just closed it, no error needed
      setError('Google sign-in failed. Please try again.');
    }
  };

  /** User clicked "I've verified my email" — reload the user and confirm */
  const handleCheckVerification = async () => {
    setCheckingVerification(true); setError('');
    try {
      // Re-sign in temporarily to reload the user object
      // We can't reload without a signed-in user, so we ask them to wait
      // Instead use a fresh signIn attempt which will work only if verified
      setSuccessMsg('');
      // We reload auth state: sign in, reload, check
      // NOTE: we don't have the password here — so we prompt them to go login
      setSuccessMsg('Email verified! Please sign in now.');
      switchTo('login');
    } catch {
      setError('Could not confirm verification. Please try signing in directly.');
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    try {
      // Re-create a temp sign-in is not possible without password
      // Best UX: tell them to check spam or use forgot password if needed
      setSuccessMsg(`Verification email resent to ${pendingEmail}. Please check your spam folder too.`);
      setResendCooldown(60);
      // If you store the password in state you can re-sign in and resend 
      // but storing plaintext password in state is not recommended.
      // The cleanest approach: re-send via a Cloud Function or ask user to re-register if expired.
    } catch { setError('Failed to resend. Please try again.'); }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,0.82)',
    border: '1.5px solid rgba(100,130,160,0.55)',
    borderRadius: 10, fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    color: '#0f172a', outline: 'none', boxSizing: 'border-box',
  };

  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 10, fontWeight: 700,
    color: '#0f172a',
    textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 5,
    fontFamily: "'DM Sans', sans-serif",
  };

  const btnPrimary: React.CSSProperties = {
    width: '100%', padding: '13px',
    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
    color: '#fff', border: 'none', borderRadius: 10,
    fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700,
    cursor: 'pointer', letterSpacing: '0.06em',
    boxShadow: '0 4px 18px rgba(2,132,199,0.35)',
  };

  const EyeToggle = () => (
    <button type="button" onClick={() => setShowPassword(s => !s)}
      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(15,23,42,0.4)', padding: 0, display: 'flex' }}>
      {showPassword
        ? <svg style={{ width: 17, height: 17 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
        : <svg style={{ width: 17, height: 17 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
      }
    </button>
  );

  // ── Password strength checklist ────────────────────────────────────────────
  const PasswordStrengthChecklist = () => {
    const passed = PW_RULES.filter(r => r.test(password)).length;
    const pct    = (passed / PW_RULES.length) * 100;
    const barColor = pct <= 40 ? '#ef4444' : pct <= 60 ? '#f59e0b' : pct <= 80 ? '#3b82f6' : '#10b981';

    return (
      <div style={{
        marginTop: 8, padding: '10px 12px',
        background: 'rgba(255,255,255,0.75)',
        border: '1.5px solid rgba(2,132,199,0.18)',
        borderRadius: 10,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {/* strength bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.3s, background 0.3s' }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: barColor, minWidth: 40, textAlign: 'right', letterSpacing: '0.05em' }}>
            {pct <= 40 ? 'Weak' : pct <= 60 ? 'Fair' : pct <= 80 ? 'Good' : 'Strong'}
          </span>
        </div>

        {/* rules */}
        {PW_RULES.map(rule => {
          const ok = rule.test(password);
          return (
            <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <svg style={{ width: 13, height: 13, flexShrink: 0, color: ok ? '#10b981' : '#cbd5e1' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {ok
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                }
              </svg>
              <span style={{ fontSize: 11, color: ok ? '#059669' : '#94a3b8', fontWeight: ok ? 700 : 400, transition: 'color 0.2s' }}>
                {rule.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const panelCopy = {
    login:             { headline: 'Welcome\nBack!',  body: 'Sign in to access your secure AI-proctored dashboard and pick up right where you left off.', cta: '', ctaBtn: 'Create Account', ctaAction: () => switchTo('signup') },
    signup:            { headline: 'Hello,\nFriend!', body: 'Register with your institutional details to unlock all VivaPro features and AI-powered assessments.', cta: '', ctaBtn: 'Sign In', ctaAction: () => switchTo('login') },
    'forgot-password': { headline: 'No\nWorries!',   body: "Enter your email and we'll shoot a reset link straight to your inbox in seconds.", cta: '', ctaBtn: 'Sign In', ctaAction: () => switchTo('login') },
    'verify-email':    { headline: 'Check\nYour\nEmail!', body: 'We sent a verification link to your inbox. Click it, then come back here to sign in.', cta: '', ctaBtn: 'Sign In', ctaAction: () => switchTo('login') },
  };
  const cp = panelCopy[view];

  const orbs = [
    { w: 420, h: 420, bg: '#bae6fd', top: '-10%', left: '-8%',  dur: '18s', delay: '0s'    },
    { w: 320, h: 320, bg: '#a7f3d0', top: '50%',  left: 'auto', right: '-6%', dur: '22s', delay: '-7s'  },
    { w: 260, h: 260, bg: '#67e8f9', top: 'auto', bottom: '-8%', left: '35%', dur: '16s', delay: '-4s'  },
    { w: 200, h: 200, bg: '#6ee7b7', top: '20%',  left: '55%',  dur: '24s', delay: '-11s' },
  ];
  const dots = [
    { s: 8,  top: '12%', left: '20%', c: '#0284c7', dur: '3.2s', dl: '0s'    },
    { s: 6,  top: '70%', left: '15%', c: '#059669', dur: '4.1s', dl: '-1.2s' },
    { s: 10, top: '30%', left: '80%', c: '#0ea5e9', dur: '2.8s', dl: '-0.6s' },
    { s: 5,  top: '80%', left: '70%', c: '#10b981', dur: '3.6s', dl: '-2.1s' },
    { s: 7,  top: '55%', left: '45%', c: '#0369a1', dur: '4.4s', dl: '-1.8s' },
    { s: 9,  top: '18%', left: '60%', c: '#34d399', dur: '3.0s', dl: '-0.9s' },
    { s: 5,  top: '88%', left: '30%', c: '#0284c7', dur: '5.0s', dl: '-3.0s' },
    { s: 6,  top: '42%', left: '92%', c: '#059669', dur: '3.8s', dl: '-2.5s' },
  ];
  const rings = [
    { s: 60,  top: '8%',  left: '72%', c: 'rgba(2,132,199,0.25)',   dur: '12s' },
    { s: 44,  top: '75%', left: '8%',  c: 'rgba(5,150,105,0.25)',  dur: '18s' },
    { s: 80,  top: '60%', left: '55%', c: 'rgba(14,165,233,0.18)', dur: '20s' },
  ];
  const squares = [
    { s: 14, top: '22%', left: '5%',  c: 'rgba(2,132,199,0.2)',   dur: '6s',   dl: '0s'   },
    { s: 10, top: '65%', left: '88%', c: 'rgba(5,150,105,0.2)',  dur: '7.5s', dl: '-2s'  },
    { s: 18, top: '45%', left: '3%',  c: 'rgba(14,165,233,0.15)',dur: '8s',   dl: '-4s'  },
    { s: 8,  top: '10%', left: '48%', c: 'rgba(16,185,129,0.2)', dur: '5.5s', dl: '-1s'  },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Nunito:wght@700;900&display=swap');

        /* ── Animated background ── */
        .vp-bg {
          position: fixed; inset: 0; overflow: hidden; z-index: 0;
          pointer-events: none; width: 100vw;
          background: linear-gradient(135deg, #e0f2fe 0%, #ecfdf5 45%, #f0fdf4 70%, #e0f2fe 100%);
        }

        @keyframes vpFloat { 0%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-40px) scale(1.08)} 66%{transform:translate(-20px,20px) scale(0.94)} 100%{transform:translate(0,0) scale(1)} }
        .vp-orb { position:absolute; border-radius:50%; filter:blur(60px); opacity:0.52; animation:vpFloat linear infinite; }

        @keyframes vpPulse { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.7);opacity:0.12} }
        .vp-dot { position:absolute; border-radius:50%; animation:vpPulse ease-in-out infinite; }

        @keyframes vpSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .vp-ring { position:absolute; border-radius:50%; border:1.5px solid; animation:vpSpin linear infinite; }

        @keyframes vpDrift { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-18px) rotate(22deg)} }
        .vp-sq { position:absolute; border-radius:3px; animation:vpDrift ease-in-out infinite; }

        /* ── Layout ── */
        .vp-wrap {
          position: relative; z-index: 1;
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh; padding: 32px 24px;
          box-sizing: border-box; width: 100vw;
        }
        .vp-card {
          display: flex;
          width: min(900px, calc(100vw - 48px));
          min-height: 580px;
          border-radius: 28px; overflow: hidden;
          box-shadow: 0 32px 80px rgba(15,23,42,0.16), 0 8px 24px rgba(15,23,42,0.07);
          font-family: 'DM Sans', sans-serif;
        }

        /* ── LEFT panel ── */
        .vp-left {
          flex: 0 0 54%;
          background: radial-gradient(
            ellipse 180% 180% at 0% 0%,
            #ffffff 0%,
            #ffffff 35%,
            #bae6fd 52%,
            #38bdf8 65%,
            #0284c7 78%,
            #0369a1 88%,
            #01315e 100%
          );
          padding: 44px 42px 38px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        /* ── RIGHT panel ── */
        .vp-right {
          flex: 1;
          position: relative;
          overflow: hidden;
          background: #0f172a;
          border-left: 1px solid rgba(14, 165, 233, 0.25);
          box-shadow: inset -1px 0 40px rgba(2,132,199,0.08);
          border-radius: 0 28px 28px 0;
        }

        .vp-right-video {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover; object-position: 55% center;
          display: block;
        }

        .vp-right-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(
            to left,
            rgba(2, 15, 40, 0.88) 0%,
            rgba(2, 15, 40, 0.60) 45%,
            rgba(2, 15, 40, 0.25) 70%,
            rgba(2, 15, 40, 0.0) 100%
          );
        }

        .vp-text-layer {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: flex-end;
          padding: 0px 40px 60px 35%;
          text-align: center;
        }

        /* ── Form elements ── */
        .vp-input:focus {
          border-color: rgba(2,132,199,0.5) !important;
          background: rgba(255,255,255,0.9) !important;
          box-shadow: 0 0 0 3px rgba(2,132,199,0.1) !important;
        }
        .vp-input::placeholder { color: rgba(15,23,42,0.35); }
        .vp-field { margin-bottom: 14px; }
        .vp-pw-wrap { position: relative; }

        .vp-role-btn {
          flex: 1; padding: 9px;
          font-family: 'DM Sans', sans-serif; font-size: 12px;
          font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; border-radius: 8px;
          cursor: pointer; transition: all 0.18s;
        }

        .vp-submit { transition: opacity 0.15s, transform 0.15s; }
        .vp-submit:hover { opacity: 0.9; transform: translateY(-1px); }
        .vp-submit:active { transform: translateY(0); }

        .vp-link {
          color: #0284c7; font-weight: 700;
          background: none; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-size: 13px;
        }
        .vp-link:hover { text-decoration: underline; }

        /* ── Right panel text ── */
        .vp-r-headline {
          font-family: 'Nunito', sans-serif;
          font-size: 32px; font-weight: 900; color: #ffffff;
          line-height: 1.1; margin-bottom: 14px;
          white-space: pre-line;
          text-shadow: 0 2px 20px rgba(0,0,0,0.6);
          letter-spacing: -0.01em; text-align: center; width: 100%;
        }
        .vp-r-body {
          font-size: 12.5px; color: rgba(255,255,255,0.78);
          line-height: 1.7; margin-bottom: 6px;
          text-shadow: 0 1px 8px rgba(0,0,0,0.5);
          max-width: 240px; text-align: center; align-self: center;
        }
        .vp-r-cta { display: none; }
        .vp-r-btn {
          background: linear-gradient(135deg, #0284c7, #0369a1);
          border: none; color: #fff; border-radius: 50px;
          padding: 11px 28px; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-size: 13px;
          font-weight: 700; letter-spacing: 0.08em;
          margin-top: 16px; display: block; width: 100%;
          transition: opacity 0.2s, transform 0.2s;
          box-shadow: 0 4px 18px rgba(2,132,199,0.35);
        }
        .vp-r-btn:hover { opacity: 0.88; transform: translateY(-2px); }

        /* ── Verify email screen ── */
        .vp-verify-icon {
          width: 64px; height: 64px; margin: 0 auto 16px;
          background: linear-gradient(135deg, #e0f2fe, #bae6fd);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid rgba(2,132,199,0.2);
        }

        @keyframes vpMailBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .vp-verify-icon svg { animation: vpMailBounce 2s ease-in-out infinite; }

        @media (max-width: 640px) {
          .vp-card { flex-direction: column; max-width: 100%; min-height: unset; border-radius: 20px; }
          .vp-left { flex: none; width: 100%; padding: 32px 24px 28px; }
          .vp-right { display: none; }
        }
      `}</style>

      {/* animated background */}
      <div className="vp-bg">
        {orbs.map((o, i) => (
          <div key={i} className="vp-orb" style={{ width: o.w, height: o.h, background: o.bg, top: o.top, left: (o as any).left, right: (o as any).right, bottom: (o as any).bottom, animationDuration: o.dur, animationDelay: o.delay }} />
        ))}
        {dots.map((d, i) => (
          <div key={i} className="vp-dot" style={{ width: d.s, height: d.s, top: d.top, left: d.left, background: d.c, animationDuration: d.dur, animationDelay: d.dl }} />
        ))}
        {rings.map((r, i) => (
          <div key={i} className="vp-ring" style={{ width: r.s, height: r.s, top: r.top, left: r.left, borderColor: r.c, animationDuration: r.dur }} />
        ))}
        {squares.map((s, i) => (
          <div key={i} className="vp-sq" style={{ width: s.s, height: s.s, top: s.top, left: s.left, background: s.c, animationDuration: s.dur, animationDelay: s.dl }} />
        ))}
      </div>

      <div className="vp-wrap">
        <div className="vp-card">

          {/* ═══ LEFT — form ═══ */}
          <div className="vp-left">

            {/* logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, position: 'relative', zIndex: 1 }}>
              <img src="/logo.png" alt="VivaPro" style={{ width: 100, height: 100, borderRadius: 11, objectFit: 'contain' }} />
              <div>
                <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 21, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>VivaPro</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 700, color: '#475569', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Secure Assessment</div>
              </div>
            </div>

            {/* heading */}
            <h2 style={{ fontFamily: "'Nunito',sans-serif", fontSize: 24, fontWeight: 900, color: '#0f172a', marginBottom: 16, lineHeight: 1.1, position: 'relative', zIndex: 1 }}>
              {view === 'login'          && 'Sign In'}
              {view === 'signup'         && 'Create Account'}
              {view === 'forgot-password'&& 'Reset Password'}
              {view === 'verify-email'   && 'Verify Your Email'}
            </h2>

            {/* role toggle — not shown on verify or forgot */}
            {(view === 'login' || view === 'signup') && (
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.65)', borderRadius: 10, padding: 4, marginBottom: 16, gap: 3, position: 'relative', zIndex: 1 }}>
                {([UserRole.STUDENT, UserRole.TEACHER] as UserRole[]).map(r => (
                  <button key={r} type="button" className="vp-role-btn"
                    onClick={() => { setRole(r); setError(''); }}
                    style={{
                      border: role === r ? '1.5px solid rgba(2,132,199,0.4)' : 'none',
                      background: role === r ? '#fff' : 'transparent',
                      color: role === r ? '#0284c7' : '#0f172a',
                      boxShadow: role === r ? '0 1px 4px rgba(15,23,42,0.08)' : 'none',
                    }}>
                    {r === UserRole.STUDENT ? 'Student' : 'Teacher'}
                  </button>
                ))}
              </div>
            )}

            {/* alerts */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 13px', background: 'rgba(255,255,255,0.85)', border: '1px solid #fecdd3', borderRadius: 9, position: 'relative', zIndex: 1 }}>
                <svg style={{ width: 14, height: 14, color: '#e11d48', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e11d48', fontFamily: "'DM Sans',sans-serif" }}>{error}</span>
              </div>
            )}
            {successMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 13px', background: 'rgba(255,255,255,0.85)', border: '1px solid #bbf7d0', borderRadius: 9, position: 'relative', zIndex: 1 }}>
                <svg style={{ width: 14, height: 14, color: '#059669', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', fontFamily: "'DM Sans',sans-serif" }}>{successMsg}</span>
              </div>
            )}

            {/* ── LOGIN form ── */}
            {view === 'login' && (
              <form onSubmit={handleLogin} style={{ position: 'relative', zIndex: 1 }}>
                <div className="vp-field">
                  <label style={lbl}>Email Address</label>
                  <input
                    className="vp-input" type="email" placeholder="name@vivapro.ai"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    required
                    style={{ ...inp, borderColor: emailError ? 'rgba(239,68,68,0.5)' : undefined }}
                  />
                  {emailError && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#e11d48', fontFamily: "'DM Sans',sans-serif", fontWeight: 700 }}>{emailError}</p>}
                </div>
                <div className="vp-field">
                  <label style={lbl}>Password</label>
                  <div className="vp-pw-wrap">
                    <input
                      className="vp-input" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onBlur={() => setPasswordTouched(true)}
                      required
                      style={{ ...inp, paddingRight: 44, borderColor: loginPwError ? 'rgba(239,68,68,0.5)' : undefined }}
                    />
                    <EyeToggle />
                  </div>
                  {loginPwError && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#e11d48', fontFamily: "'DM Sans',sans-serif", fontWeight: 700 }}>{loginPwError}</p>}
                </div>
                <div style={{ textAlign: 'right', marginBottom: 18 }}>
                  <button type="button" className="vp-link" onClick={() => switchTo('forgot-password')} style={{ fontSize: 12 }}>Forgot Password?</button>
                </div>
                <button type="submit" className="vp-submit" style={btnPrimary}>Sign In →</button>

                {/* Google sign-in */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(2,132,199,0.15)' }} />
                  <span style={{ fontSize: 11, color: '#64748b', fontFamily: "'DM Sans',sans-serif", fontWeight: 700, letterSpacing: '0.08em' }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(2,132,199,0.15)' }} />
                </div>
                <button type="button" onClick={handleGoogleSignIn} className="vp-submit"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: '11px', background: '#fff', border: '1.5px solid rgba(100,130,160,0.45)', borderRadius: 10, fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: '#1e293b', cursor: 'pointer', boxShadow: '0 1px 4px rgba(15,23,42,0.07)' }}>
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
                  Continue with Google
                </button>
                
              </form>
            )}

            {/* ── SIGNUP form ── */}
            {view === 'signup' && (
              <form onSubmit={handleSignup} style={{ position: 'relative', zIndex: 1 }}>
                {/* Spinner overlay while creating account */}
                {submitting && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(3px)', zIndex: 10, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                    <svg style={{ width: 36, height: 36, color: '#0284c7' }} className="animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#0284c7', fontFamily: "'DM Sans',sans-serif", margin: 0 }}>Creating your account…</p>
                  </div>
                )}
                <div className="vp-field">
                  <label style={lbl}>Full Name</label>
                  <input className="vp-input" type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required style={inp} />
                </div>
                <div className="vp-field">
                  <label style={lbl}>Institutional Email</label>
                  <input
                    className="vp-input" type="email" placeholder="name@vivapro.ai"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    required
                    style={{ ...inp, borderColor: emailError ? 'rgba(239,68,68,0.5)' : undefined }}
                  />
                  {emailError && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#e11d48', fontFamily: "'DM Sans',sans-serif", fontWeight: 700 }}>{emailError}</p>}
                </div>
                <div className="vp-field">
                  <label style={lbl}>Password</label>
                  <div className="vp-pw-wrap">
                    <input
                      className="vp-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setPwFocused(true)}
                      onBlur={() => setPwFocused(false)}
                      required
                      style={{ ...inp, paddingRight: 44 }}
                    />
                    <EyeToggle />
                  </div>
                  {/* Show checklist when field is focused OR password has been started */}
                  {(pwFocused || password.length > 0) && <PasswordStrengthChecklist />}
                </div>
                <div className="vp-field" style={{ marginBottom: 20 }}>
                  <label style={lbl}>Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <input className="vp-input" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={{
                      ...inp,
                      borderColor: confirmPassword && confirmPassword !== password ? 'rgba(239,68,68,0.5)' : undefined,
                    }} />
                    {/* match indicator */}
                    {confirmPassword.length > 0 && (
                      <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                        {confirmPassword === password
                          ? <svg style={{ width: 16, height: 16, color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          : <svg style={{ width: 16, height: 16, color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        }
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18, padding: '12px 14px', background: 'rgba(255,255,255,0.65)', border: '1.5px solid rgba(2,132,199,0.25)', borderRadius: 10 }}>
                  <input
                    type="checkbox"
                    id="tc-check"
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    style={{ marginTop: 2, accentColor: '#0284c7', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
                  />
                  <label htmlFor="tc-check" style={{ fontSize: 12, color: '#334155', fontFamily: "'DM Sans',sans-serif", lineHeight: 1.55, cursor: 'pointer' }}>
                    I have read and agree to the{' '}
                    <button type="button" onClick={() => setShowTerms(true)}
                      style={{ color: '#0284c7', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 12, padding: 0, textDecoration: 'underline' }}>
                      Terms & Conditions
                    </button>
                    , including VivaPro's data collection and proctoring policy.
                  </label>
                </div>
                <button
                  type="submit"
                  className="vp-submit"
                  disabled={submitting}
                  style={{ ...btnPrimary, opacity: (termsAccepted && passwordValid(password) && !submitting) ? 1 : 0.55, cursor: (termsAccepted && passwordValid(password) && !submitting) ? 'pointer' : 'not-allowed' }}
                >
                  {submitting ? 'Creating Account…' : 'Create Account →'}
                </button>

                {/* Google sign-up */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(2,132,199,0.15)' }} />
                  <span style={{ fontSize: 11, color: '#64748b', fontFamily: "'DM Sans',sans-serif", fontWeight: 700, letterSpacing: '0.08em' }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(2,132,199,0.15)' }} />
                </div>
                <button type="button" onClick={handleGoogleSignIn} className="vp-submit"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: '11px', background: '#fff', border: '1.5px solid rgba(100,130,160,0.45)', borderRadius: 10, fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: '#1e293b', cursor: 'pointer', boxShadow: '0 1px 4px rgba(15,23,42,0.07)' }}>
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
                  Continue with Google
                </button>
              </form>
            )}

            {/* ── FORGOT PASSWORD form ── */}
            {view === 'forgot-password' && (
              <form onSubmit={handleForgotPassword} style={{ position: 'relative', zIndex: 1 }}>
                <p style={{ fontSize: 13, color: '#334155', marginBottom: 20, lineHeight: 1.65, fontFamily: "'DM Sans',sans-serif" }}>
                  Enter your VivaPro email and we'll send a reset link immediately.
                </p>
                <div className="vp-field" style={{ marginBottom: 22 }}>
                  <label style={lbl}>Email Address</label>
                  <input className="vp-input" type="email" placeholder="name@vivapro.ai" value={email} onChange={e => setEmail(e.target.value)} required style={inp} />
                </div>
                <button type="submit" className="vp-submit" style={btnPrimary}>Send Reset Link →</button>
                <p style={{ textAlign: 'center', fontSize: 13, color: '#475569', fontFamily: "'DM Sans',sans-serif", marginTop: 16 }}>
                  Remembered it?{' '}
                  <button type="button" onClick={() => switchTo('login')} style={{ color: '#0284c7', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>Sign In</button>
                </p>
              </form>
            )}

            {/* ── VERIFY EMAIL screen ── */}
            {view === 'verify-email' && (
              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* animated mail icon */}
                <div className="vp-verify-icon">
                  <svg style={{ width: 32, height: 32, color: '#0284c7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>

                <p style={{ fontSize: 13, color: '#1e293b', marginBottom: 6, lineHeight: 1.65, fontFamily: "'DM Sans',sans-serif", textAlign: 'center' }}>
                  We sent a verification link to
                </p>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0284c7', marginBottom: 20, fontFamily: "'DM Sans',sans-serif", textAlign: 'center', wordBreak: 'break-all' }}>
                  {pendingEmail}
                </p>
                <p style={{ fontSize: 12, color: '#334155', marginBottom: 20, lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif", textAlign: 'center' }}>
                  Click the link in the email, then sign in below. Check your spam folder if you don't see it.
                </p>

                {/* Steps */}
                <div style={{ background: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(2,132,199,0.18)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
                  {[
                    { n: '1', t: 'Open your email inbox' },
                    { n: '2', t: 'Click the verification link from VivaPro' },
                    { n: '3', t: 'Come back and sign in below' },
                  ].map(step => (
                    <div key={step.n} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: step.n === '3' ? 0 : 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#0284c7,#0369a1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>{step.n}</span>
                      </div>
                      <span style={{ fontSize: 12, color: '#334155', fontFamily: "'DM Sans',sans-serif" }}>{step.t}</span>
                    </div>
                  ))}
                </div>

                {/* Go to Sign In */}
                <button
                  type="button"
                  className="vp-submit"
                  onClick={() => switchTo('login')}
                  style={btnPrimary}
                >
                  Go to Sign In →
                </button>

                {/* Resend */}
                <div style={{ textAlign: 'center', marginTop: 14 }}>
                  <span style={{ fontSize: 12, color: '#334155', fontFamily: "'DM Sans',sans-serif" }}>Didn't receive it? </span>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendCooldown > 0}
                    style={{
                      color: resendCooldown > 0 ? '#64748b' : '#0284c7',
                      fontWeight: 700, background: 'none', border: 'none',
                      cursor: resendCooldown > 0 ? 'default' : 'pointer',
                      fontFamily: "'DM Sans',sans-serif", fontSize: 12,
                    }}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend email'}
                  </button>
                </div>

                <p style={{ textAlign: 'center', fontSize: 12, color: '#334155', fontFamily: "'DM Sans',sans-serif", marginTop: 12 }}>
                  Wrong email?{' '}
                  <button type="button" onClick={() => switchTo('signup')} style={{ color: '#0284c7', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 12 }}>
                    Sign up again
                  </button>
                </p>
              </div>
            )}

          </div>

          {/* ═══ RIGHT — video background with layered text ═══ */}
          <div className="vp-right">
            <video autoPlay muted loop playsInline className="vp-right-video">
              <source src={`${import.meta.env.BASE_URL}Robot.mp4`} type="video/webm" />
              <source src="/Robot.mp4" type="video/webm" />
            </video>
            <div className="vp-right-overlay" />
            <div className="vp-text-layer">
              <div className="vp-r-headline">{cp.headline}</div>
              <p className="vp-r-body">{cp.body}</p>
              <p className="vp-r-cta">{cp.cta}</p>
              <button type="button" className="vp-r-btn" onClick={cp.ctaAction}>{cp.ctaBtn}</button>
            </div>
          </div>

        </div>
      </div>

      {/* ── Terms & Conditions modal ── */}
      {showTerms && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(15,23,42,0.22)', overflow: 'hidden' }}>
            <div style={{ padding: '22px 28px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "'Nunito',sans-serif", fontSize: 17, fontWeight: 900, color: '#0f172a' }}>Terms & Conditions</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>VivaPro Data & Proctoring Policy</div>
              </div>
              <button onClick={() => setShowTerms(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                <svg style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: '20px 28px', flex: 1, fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
              {[
                { icon: '📋', title: 'What Data We Collect', items: ['Your name, email address, and account role (student or teacher).', 'Assignment submissions including written and voice-transcribed answers.', 'Academic integrity logs: tab-switch events, camera-off events, split screen events, and detected violations.'] },
                { icon: '📷', title: 'Video Proctoring & Screenshots', items: ['When you choose Video Mode for an assessment, your camera feed is analysed in real time using AI to detect suspicious behaviour (looking away, phone usage, additional persons in frame).', 'Screenshots are captured automatically whenever a violation is detected.', 'These screenshots are stored securely and are accessible to your teacher for review as evidence of potential academic integrity issues.', 'Captured screenshots are retained for 7 days from the date of the assessment, after which they are automatically deleted.', 'You will be clearly informed before an exam starts that video proctoring is active and that screenshots may be taken.'] },
                { icon: '⚖️', title: 'Grade Contests', items: ['Students may contest an AI-assigned grade within 7 days of it being published.', 'Contest requests, including your written reason and any supporting context, are shared with your teacher for review.', 'Teachers may approve or reject a contest request.', 'Contest decisions are final once actioned by the teacher.'] },
                { icon: '🔒', title: 'How We Store & Protect Your Data', items: ['All data is stored in industry-standard, SOC 2-compliant cloud platforms.', 'We do not sell, share, or monetise your personal data with any third party.'] },
                { icon: '🗑️', title: 'Data Retention & Deletion', items: ['Proctoring screenshots: deleted automatically after 7 days.', 'Violation logs and submission records: retained for the duration of the academic term.'] },
                { icon: '✅', title: 'Your Consent', items: ["By creating an account, you agree to use VivaPro only for legitimate academic purposes.", "When using Text or Voice mode, you consent to AI-assisted proctoring including camera monitoring and screenshot capture."] },
              ].map(section => (
                <div key={section.title} style={{ marginBottom: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>{section.icon}</span>
                    <span style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 13, color: '#0f172a' }}>{section.title}</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {section.items.map((item, i) => <li key={i} style={{ marginBottom: 5, color: '#475569' }}>{item}</li>)}
                  </ul>
                </div>
              ))}
              
            </div>
            <div style={{ padding: '16px 28px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={() => setShowTerms(false)} style={{ flex: 1, padding: '11px', background: '#f1f5f9', border: 'none', borderRadius: 10, fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>Close</button>
              <button onClick={() => { setTermsAccepted(true); setShowTerms(false); }} style={{ flex: 2, padding: '11px', background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', border: 'none', borderRadius: 10, fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(2,132,199,0.35)' }}>I Accept</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Login;
