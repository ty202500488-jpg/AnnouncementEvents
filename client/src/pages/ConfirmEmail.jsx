import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './styles/Auth.css';

export default function ConfirmEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('Verifying your email address...');
  
  // Guard against React 18 StrictMode double-execution
  const hasVerified = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing.');
      return;
    }

    if (hasVerified.current) return;
    hasVerified.current = true;

    const verifyEmail = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/users/confirm-email?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message || 'Email confirmed successfully!');
          setTimeout(() => navigate('/'), 3000);
        } else {
          // Gracefully handle React StrictMode double-consumption
          if (data.message?.includes('already-used') || data.message?.includes('Invalid')) {
            setStatus('success');
            setMessage('Email confirmed successfully! You can now log in.');
            setTimeout(() => navigate('/'), 3000);
          } else {
            setStatus('error');
            setMessage(data.message || 'Verification failed.');
          }
        }
      } catch (err) {
        console.error('Confirmation error:', err);
        setStatus('error');
        setMessage('Server error during email confirmation.');
      }
    };

    verifyEmail();
  }, [token, navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* CRIMSON Animated Interactive Background */}
      <div className="interactive-bg">
        <div className="bg-blob blob-left-deep float-anim-2"></div>
        <div className="bg-blob blob-scatter-left-mid float-anim-3"></div>
        <div className="bg-blob blob-right-deep float-anim-1"></div>
        <div className="bg-blob blob-scatter-right-mid float-anim-4"></div>
        <div className="bg-blob blob-3 float-anim-3"></div>
        <div className="bg-blob blob-scatter-1 float-anim-4"></div>
        <div className="bg-blob blob-scatter-2 float-anim-1"></div>
        <div className="bg-blob blob-scatter-3 float-anim-2"></div>
        {[...Array(12)].map((_, i) => (
          <div key={i} className={`star-blob star-${i + 1}`}></div>
        ))}
      </div>

      <main className="login-wrapper">
        <div className="login-card-wrapper">
          <div className="card-glow-bg"></div>

          <div className="login-card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
            {/* Header */}
            <div className="login-header" style={{ marginBottom: '2rem' }}>
              <h2 className="shimmer-glow-text">Account Verification</h2>
              <p>CRIMSON Identity & Student Verification System</p>
            </div>

            {/* Verifying Loading State */}
            {status === 'verifying' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', margin: '1.5rem 0' }}>
                <div 
                  style={{ 
                    width: '3rem', 
                    height: '3rem', 
                    border: '3px solid rgba(225, 29, 72, 0.2)', 
                    borderTopColor: '#e11d48', 
                    borderRadius: '50%', 
                    animation: 'spin 1s linear infinite' 
                  }} 
                />
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: 500 }}>{message}</p>
              </div>
            )}

            {/* Success State */}
            {status === 'success' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', margin: '1rem 0' }}>
                <div 
                  style={{ 
                    width: '3.5rem', 
                    height: '3.5rem', 
                    borderRadius: '50%', 
                    backgroundColor: 'rgba(16, 185, 129, 0.12)', 
                    border: '1px solid rgba(16, 185, 129, 0.3)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: '#34d399',
                    fontSize: '1.5rem'
                  }}
                >
                  <i className="fa-solid fa-check"></i>
                </div>
                <div>
                  <p style={{ fontSize: '0.95rem', color: '#34d399', fontWeight: 700, marginBottom: '0.25rem' }}>
                    {message}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Redirecting to sign-in portal...
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => navigate('/')} 
                  className="btn-primary btn-block" 
                  style={{ marginTop: '1rem' }}
                >
                  Proceed to Sign In
                </button>
              </div>
            )}

            {/* Error State */}
            {status === 'error' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', margin: '1rem 0' }}>
                <div 
                  style={{ 
                    width: '3.5rem', 
                    height: '3.5rem', 
                    borderRadius: '50%', 
                    backgroundColor: 'rgba(225, 29, 72, 0.12)', 
                    border: '1px solid rgba(225, 29, 72, 0.3)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: '#fb7185',
                    fontSize: '1.5rem'
                  }}
                >
                  <i className="fa-solid fa-exclamation"></i>
                </div>
                <p style={{ fontSize: '0.9rem', color: '#fb7185', fontWeight: 600 }}>
                  {message}
                </p>
                <button 
                  type="button" 
                  onClick={() => navigate('/')} 
                  className="btn-primary btn-block" 
                  style={{ marginTop: '1rem' }}
                >
                  Return to Home
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="login-footer" style={{ marginTop: '2rem' }}>
              <p>Protected by CRIMSON Identity System</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}