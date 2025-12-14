import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

/**
 * Redirects users to appropriate dashboard based on their role
 * Admin -> /admin
 * User -> /user
 */
export default function RoleBasedRedirect() {
    const { role, loading } = useSelector((state) => state.auth);

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh',
                background: 'var(--bg-app)'
            }}>
                <div className="glass-panel" style={{ padding: '2rem' }}>
                    Cargando...
                </div>
            </div>
        );
    }

    if (role === 'admin') {
        return <Navigate to="/admin" replace />;
    }

    return <Navigate to="/user" replace />;
}
