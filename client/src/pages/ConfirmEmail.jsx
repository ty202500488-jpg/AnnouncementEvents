import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './styles/ConfirmEmail.css';

export default function ConfirmEmail() {
    const [searchParams] = useSearchParams();
    const [statusMessage, setStatusMessage] = useState('Verifying your email address...');
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = searchParams.get('token');
        if (!token) {
            setIsLoading(false);
            setIsSuccess(false);
            setStatusMessage('Verification token is missing from the link.');
            return;
        }

        // Call backend confirmation route
        fetch(`http://localhost:5000/users/confirm-email?token=${token}`)
            .then(async (res) => {
                const data = await res.json();
                setIsLoading(false);
                if (res.ok) {
                    setIsSuccess(true);
                    setStatusMessage(data.message || 'Email confirmed successfully!');
                } else {
                    setIsSuccess(false);
                    setStatusMessage(data.message || 'Verification failed or link expired.');
                }
            })
            .catch((err) => {
                console.error(err);
                setIsLoading(false);
                setIsSuccess(false);
                setStatusMessage('Server connection error while confirming email.');
            });
    }, [searchParams]);

    return (
        <div className="confirm-email-wrapper">
            {/* Background interactive blobs matching your LandingPage style */}
            <div className="interactive-bg">
                <div className="bg-blob blob-1 float-anim-1"></div>
                <div className="bg-blob blob-2 float-anim-2"></div>
            </div>

            <div className="confirm-card">
                <div className={`confirm-icon-wrapper ${isLoading ? '' : isSuccess ? 'success' : 'error'}`}>
                    {isLoading ? (
                        <div className="spinner"></div>
                    ) : isSuccess ? (
                        <span>✓</span>
                    ) : (
                        <span>✕</span>
                    )}
                </div>

                <h2 className="confirm-title">
                    {isLoading ? 'Verifying' : isSuccess ? 'Success!' : 'Verification Failed'}
                </h2>

                <p className="confirm-message">{statusMessage}</p>

                {!isLoading && isSuccess && (
                    <button 
                        onClick={() => navigate('/auth')} 
                        className="btn-proceed"
                    >
                        Proceed to Login
                    </button>
                )}

                {!isLoading && !isSuccess && (
                    <button 
                        onClick={() => navigate('/auth')} 
                        className="btn-proceed"
                    >
                        Return to Sign In
                    </button>
                )}
            </div>
        </div>
    );
}