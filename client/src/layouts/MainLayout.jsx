import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../store/slices/authSlice';

export default function MainLayout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, role } = useSelector((state) => state.auth);

    const handleLogout = async () => {
        await dispatch(logoutUser());
        navigate('/login', { replace: true });
    };

    // Close mobile menu when navigating
    const handleNavClick = () => {
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="layout-container">
            {/* Mobile Header */}
            <header className="mobile-header">
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--primary)' }}>SCGM</div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}
                >
                    {isMobileMenuOpen ? '✕' : '☰'}
                </button>
            </header>

            {/* Mobile Backdrop */}
            <div
                className={`mobile-backdrop ${isMobileMenuOpen ? 'open' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`sidebar glass-panel ${isSidebarCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''}`} style={{
                borderRadius: 0, // Reset radius for full height sidebar
                borderTop: 'none',
                borderBottom: 'none',
                borderLeft: 'none'
            }}>
                {/* Toggle Button (Desktop Only via CSS) */}
                <button
                    className="sidebar-toggle"
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    style={{
                        position: 'absolute',
                        right: '0px',
                        top: '24px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        zIndex: 101,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}
                    title={isSidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
                >
                    {isSidebarCollapsed ? '→' : '←'}
                </button>

                <div className="logo" style={{
                    padding: '1.5rem',
                    fontSize: isSidebarCollapsed ? '1rem' : '1.5rem',
                    fontWeight: 'bold',
                    color: 'var(--primary)',
                    whiteSpace: 'nowrap',
                    textAlign: isSidebarCollapsed ? 'center' : 'left',
                    borderBottom: '1px solid var(--glass-border)'
                }}>
                    {isSidebarCollapsed ? 'SC' : 'SCGM'}
                </div>

                <nav style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    padding: '1rem',
                    flex: 1,
                    overflowY: 'auto'
                }}>
                    <Link to="/admin" className="nav-link" onClick={handleNavClick} title="Dashboard">
                        <span style={{ marginRight: '0.5rem' }}>📊</span> {!isSidebarCollapsed && 'Dashboard'}
                    </Link>
                    <Link to="/admin/sales/update" className="nav-link" onClick={handleNavClick} title="Ventas">
                        <span style={{ marginRight: '0.5rem' }}>➕</span> {!isSidebarCollapsed && 'Actualizar Ventas'}
                    </Link>
                    <Link to="/admin/income/update" className="nav-link" onClick={handleNavClick} title="Ingresos">
                        <span style={{ marginRight: '0.5rem' }}>💰</span> {!isSidebarCollapsed && 'Actualizar Ingresos'}
                    </Link>
                    <Link to="/admin/client/update" className="nav-link" onClick={handleNavClick} title="Cliente">
                        <span style={{ marginRight: '0.5rem' }}>👤</span> {!isSidebarCollapsed && 'Actualizar Cliente'}
                    </Link>
                    <Link to="/admin/activation/update" className="nav-link" onClick={handleNavClick} title="Activación">
                        <span style={{ marginRight: '0.5rem' }}>📅</span> {!isSidebarCollapsed && 'Actualizar F. Activación'}
                    </Link>
                    <Link to="/admin/sim/update" className="nav-link" onClick={handleNavClick} title="Estado SIM">
                        <span style={{ marginRight: '0.5rem' }}>📶</span> {!isSidebarCollapsed && 'Actualizar Estado SIM'}
                    </Link>
                    <Link to="/admin/sales-type/update" className="nav-link" onClick={handleNavClick} title="Tipo Venta">
                        <span style={{ marginRight: '0.5rem' }}>🏷️</span> {!isSidebarCollapsed && 'Actualizar Tipo Venta'}
                    </Link>
                    <Link to="/admin/management/update" className="nav-link" onClick={handleNavClick} title="Gestión">
                        <span style={{ marginRight: '0.5rem' }}>🔔</span> {!isSidebarCollapsed && 'Actualizar Novedad Gestión'}
                    </Link>
                    <Link to="/admin/portfolio/update" className="nav-link" onClick={handleNavClick} title="Cartera">
                        <span style={{ marginRight: '0.5rem' }}>💼</span> {!isSidebarCollapsed && 'Actualizar Cartera'}
                    </Link>
                    <Link to="/admin/guides/update" className="nav-link" onClick={handleNavClick} title="Guías">
                        <span style={{ marginRight: '0.5rem' }}>🚚</span> {!isSidebarCollapsed && 'Actualizar Guías'}
                    </Link>
                    <Link to="/admin/database" className="nav-link" onClick={handleNavClick} title="BD">
                        <span style={{ marginRight: '0.5rem' }}>📋</span> {!isSidebarCollapsed && 'Base de Datos'}
                    </Link>
                    <Link to="/admin/users" className="nav-link" onClick={handleNavClick} title="Usuarios">
                        <span style={{ marginRight: '0.5rem' }}>👥</span> {!isSidebarCollapsed && 'Gestionar Usuarios'}
                    </Link>
                </nav>

                <div style={{ padding: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                    {!isSidebarCollapsed && (
                        <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {user?.email}
                        </div>
                    )}
                    <button
                        onClick={() => { handleLogout(); handleNavClick(); }}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span style={{ marginRight: isSidebarCollapsed ? '0' : '0.5rem' }}>🚪</span> {!isSidebarCollapsed && 'Cerrar Sesión'}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`main-content ${isSidebarCollapsed ? 'expanded' : ''}`}>
                <Outlet />
            </main>

            {/* Inline styles for nav links (scoped) */}
            <style>{`
                .nav-link {
                    display: flex;
                    align-items: center;
                    justify-content: ${isSidebarCollapsed ? 'center' : 'flex-start'};
                    padding: 0.75rem;
                    color: var(--text-muted);
                    text-decoration: none;
                    border-radius: var(--radius-md);
                    transition: all 0.2s;
                }
                .nav-link:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: white;
                }
                .nav-link.active {
                    background: rgba(99, 102, 241, 0.1);
                    color: var(--primary);
                    border: 1px solid rgba(99, 102, 241, 0.2);
                }
            `}</style>
        </div>
    );
}
