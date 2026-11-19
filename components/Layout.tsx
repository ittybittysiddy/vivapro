import React from 'react';
import { UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  userRole: UserRole;
  userName?: string;
  onLogout: () => void;
  hideSignOut?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, userRole, userName, onLogout, hideSignOut }) => {
  const handleConnectAPI = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
    } else {
      alert("API Key Selection is only available within the AI Studio environment. For local development, please ensure process.env.API_KEY is set.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col no-print" style={{ background: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="VivaPro" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'contain' }} />
          <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 20, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>VivaPro</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {!process.env.API_KEY && (
            <button onClick={handleConnectAPI}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '6px 12px', fontSize: 10, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Nunito', sans-serif" }}>
              <span style={{ width: 7, height: 7, background: '#f59e0b', borderRadius: '50%', display: 'inline-block' }} />
              Connect AI
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', fontFamily: "'Nunito', sans-serif", margin: 0 }}>
                {userName || (userRole === UserRole.TEACHER ? 'Teacher Portal' : 'Student Portal')}
              </p>
              <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: "'Nunito', sans-serif", margin: 0 }}>
                {userRole.toLowerCase()}
              </p>
            </div>
            {!hideSignOut && (
              <button onClick={onLogout}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#E86A7A', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Nunito', sans-serif" }}>
                <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            )}
          </div>
        </div>
      </header>
      <main style={{ flex: 1, maxWidth: 1280, width: '100%', margin: '0 auto', padding: '24px 32px' }}>
        {children}
      </main>
      <footer style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', borderTop: '1px solid #f1f5f9', fontFamily: "'Nunito', sans-serif" }}>
        &copy; {new Date().getFullYear()} VivaPro AI &bull; Secure Assessment System
      </footer>
    </div>
  );
};

export default Layout;