import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

export default function ProtectedRoute({ children, requiredRole }) {
    const { user, role, loading } = useSelector((state) => state.auth);

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

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && role !== requiredRole) {
        return (
            <div className="glass-panel" style={{ padding: '2rem', margin: '2rem' }}>
                Acceso Denegado. Se requieren permisos de {requiredRole}.
            </div>
        );
    }

    return children;
}
