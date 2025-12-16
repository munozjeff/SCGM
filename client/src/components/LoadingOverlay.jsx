import React from 'react';

const LoadingOverlay = ({ message = "Procesando data..." }) => {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.7)', // Uses --bg-app with opacity
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1.5rem'
        }}>
            <style>
                {`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    .loading-spinner {
                        width: 60px;
                        height: 60px;
                        border: 4px solid rgba(99, 102, 241, 0.3);
                        border-top: 4px solid #6366f1; /* var(--primary) */
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                `}
            </style>
            <div className="loading-spinner"></div>
            <h3 style={{
                color: 'white',
                fontFamily: "'Outfit', sans-serif",
                fontSize: '1.25rem',
                fontWeight: '500',
                letterSpacing: '0.05em'
            }}>
                {message}
            </h3>
        </div>
    );
};

export default LoadingOverlay;
