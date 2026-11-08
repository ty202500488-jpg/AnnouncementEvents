import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function StudentQRCheckIn() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Verifying attendance token...');

  useEffect(() => {
    const checkIn = async () => {
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        localStorage.setItem('redirect_after_login', window.location.pathname);
        navigate('/auth');
        return;
      }

      try {
        const response = await fetch('http://localhost:5000/api/mypage/attendance/check-in', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ token })
        });

        const data = await response.json();
        if (response.ok) {
          setStatus('success');
          setMessage(data.message || 'Attendance recorded successfully!');
        } else {
          setStatus('error');
          setMessage(data.message || 'Failed to record attendance.');
        }
      } catch (err) {
        console.error('Check-in error:', err);
        setStatus('error');
        setMessage('Network error. Please try again.');
      }
    };

    if (token) checkIn();
  }, [token, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      backgroundColor: '#f8fafc'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        padding: '2rem',
        borderRadius: '0.75rem',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center'
      }}>
        {status === 'processing' && (
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '1rem', color: '#7B0D1E' }}>⏳</div>
            <h2 style={{ fontSize: '1.25rem', color: '#0f172a' }}>Verifying...</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#16a34a' }}>✅</div>
            <h2 style={{ fontSize: '1.25rem', color: '#0f172a' }}>Check-In Confirmed!</h2>
            <p style={{ color: '#475569', fontSize: '0.875rem', margin: '0.5rem 0 1.5rem' }}>{message}</p>
            <button
              onClick={() => navigate('/student/dashboard')}
              style={{
                backgroundColor: '#7B0D1E',
                color: '#ffffff',
                border: 'none',
                padding: '0.625rem 1.25rem',
                borderRadius: '0.375rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#dc2626' }}>❌</div>
            <h2 style={{ fontSize: '1.25rem', color: '#0f172a' }}>Check-In Failed</h2>
            <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: '0.5rem 0 1.5rem' }}>{message}</p>
            <button
              onClick={() => navigate('/student/dashboard')}
              style={{
                backgroundColor: '#475569',
                color: '#ffffff',
                border: 'none',
                padding: '0.625rem 1.25rem',
                borderRadius: '0.375rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}