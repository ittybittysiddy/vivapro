import React, { useEffect, useRef, useState } from 'react';

interface PreloaderProps {
  children: React.ReactNode;
}

const Preloader: React.FC<PreloaderProps> = ({ children }) => {
  const [scrollY, setScrollY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Defines how much scrolling triggers the full animation
  const SCROLL_THRESHOLD = 400; 

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = () => setScrollY(el.scrollTop);
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const progress = Math.min(scrollY / SCROLL_THRESHOLD, 1);
  const videoScale = 1 + progress * 0.3;
  const videoOpacity = 1 - progress * 0.8;
  const cardOpacity = progress;
  const cardTranslateY = (1 - progress) * 60;

  return (
    <div
      ref={containerRef}
      style={{ 
        height: '100vh', 
        overflowY: 'scroll', 
        overflowX: 'hidden', 
        scrollBehavior: 'smooth',
        backgroundColor: '#0f172a' 
      }}
    >
      {/* --- STICKY VIDEO SECTION --- */}
      <div style={{
        position: 'sticky', 
        top: 0, 
        height: '100vh', 
        overflow: 'hidden',
      }}>
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${videoScale})`,
            opacity: videoOpacity,
            transition: 'transform 0.1s ease-out, opacity 0.1s ease-out',
          }}
        >
          <source src={`${import.meta.env.BASE_URL}vdo.mp4`} type="video/mp4" />
          <source src="/vdo.mp4" type="video/mp4" />
        </video>

        {/* --- REFINED MINIMALIST SCROLL PROMPT --- */}
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: Math.max(0, 1 - progress * 4),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 10,
            textAlign: 'center'
          }}
        >
          {/* logo - centered above branding
          <img
            
            alt="VivaPro"
            style={{ 
              width: 50, 
              height: 50, 
              borderRadius: 12, 
              marginBottom: '15px', 
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)' 
            }}
          /> */}

          {/* Branding - Bold, readable, tight spacing */}
          <div style={{ textShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
            <div style={{
              fontFamily: "'Nunito', sans-serif",
              fontSize: 40,
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '-0.04em', // Tight spacing
              lineHeight: 0.95,
            }}>
              
            </div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 10,
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.95)', // Increased visibility
              letterSpacing: '0.4em', // Wide spacing for tagline contrast
              textTransform: 'uppercase',
              marginTop: 4, // Tighter margin
            }}>
              
            </div>
          </div>

          {/* Scroll Cue - integrated, minimal float */}
          <div style={{ 
            marginTop: 35, // Reduced space to cue
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: 6, // Reduced gap between text and icon
            animation: 'vpMinimalFloat 2.5s ease-in-out infinite' 
          }}>
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 10,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.15em', // Less wide spacing
              textTransform: 'uppercase',
              opacity: 1 // Higher visibility
            }}>
              Scroll to Sign In
            </span>
            <svg
              style={{ width: 18, height: 18, color: '#ffffff', opacity: 1 }} // Higher visibility
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* --- SCROLL BUFFER --- */}
      <div style={{ height: SCROLL_THRESHOLD }} />

      {/* --- LOGIN CARD SECTION --- */}
      <div
        style={{
          opacity: cardOpacity,
          transform: `translateY(${cardTranslateY}px)`,
          transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
          minHeight: '100vh',
          background: 'linear-gradient(160deg, #f0f9ff 0%, #f8fafc 60%, #f0fdf4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 32,
          paddingBottom: 32,
          zIndex: 2,
          position: 'relative',
        }}
      >
        {children}
      </div>

      {/* --- REFINED ANIMATIONS --- */}
      <style>{`
        @keyframes vpMinimalFloat {
          0%, 100% { transform: translateY(0); opacity: 0.7; }
          50% { transform: translateY(10px); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Preloader;