'use client';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html>
            <body style={{ backgroundColor: '#09090b', color: '#fafafa', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{ textAlign: 'center', maxWidth: '400px' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                            Something went wrong!
                        </h2>
                        <p style={{ color: '#a1a1aa', marginBottom: '1.5rem' }}>
                            {error.message || 'A critical error occurred.'}
                        </p>
                        <button
                            onClick={() => reset()}
                            style={{
                                padding: '0.75rem 1.5rem',
                                backgroundColor: '#14b8a6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                fontWeight: 500,
                            }}
                        >
                            Try again
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}
