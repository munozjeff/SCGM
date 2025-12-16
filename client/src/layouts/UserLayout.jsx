import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../store/slices/authSlice';

export default function UserLayout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useSelector((state) => state.auth);

    const handleLogout = async () => {
        await dispatch(logoutUser());
        navigate('/login', { replace: true });
    };

    const handleNavClick = () => {
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="layout-container">
            {/* Mobile Header */}
            <header className="mobile-header">
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--primary)' }}>SCGM - Usuario</div>
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
                borderRadius: 0,
                borderTop: 'none',
                borderBottom: 'none',
                borderLeft: 'none'
            }}>
                {/* Toggle Button */}
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
                    <Link to="/user" className="nav-link" onClick={handleNavClick} title="Dashboard">
                        <span style={{ marginRight: '0.5rem' }}>📊</span> {!isSidebarCollapsed && 'Dashboard'}
                    </Link>
                    <Link to="/user/database" className="nav-link" onClick={handleNavClick} title="Base de Datos">
                        <span style={{ marginRight: '0.5rem' }}>📋</span> {!isSidebarCollapsed && 'Base de Datos'}
                    </Link>
                    <Link to="/user/client/update" className={`nav-link ${location.pathname === '/user/client/update' ? 'active' : ''}`} onClick={handleNavClick} title="Cliente">
                        <span style={{ marginRight: '0.5rem' }}>👥</span> {!isSidebarCollapsed && 'Cliente'}
                    </Link>
                    <Link to="/user/income/update" className={`nav-link ${location.pathname === '/user/income/update' ? 'active' : ''}`} onClick={handleNavClick} title="Ingreso">
                        <span style={{ marginRight: '0.5rem' }}>💰</span> {!isSidebarCollapsed && 'Ingreso'}
                    </Link>
                    <Link to="/user/activation/update" className={`nav-link ${location.pathname === '/user/activation/update' ? 'active' : ''}`} onClick={handleNavClick} title="Activación">
                        <span style={{ marginRight: '0.5rem' }}>📅</span> {!isSidebarCollapsed && 'Activación'}
                    </Link>
                    <Link to="/user/sim/update" className={`nav-link ${location.pathname === '/user/sim/update' ? 'active' : ''}`} onClick={handleNavClick} title="Estado SIM">
                        <span style={{ marginRight: '0.5rem' }}>📶</span> {!isSidebarCollapsed && 'Estado SIM'}
                    </Link>
                    <Link to="/user/sales-type/update" className={`nav-link ${location.pathname === '/user/sales-type/update' ? 'active' : ''}`} onClick={handleNavClick} title="Tipo Venta">
                        <span style={{ marginRight: '0.5rem' }}>🏷️</span> {!isSidebarCollapsed && 'Tipo Venta'}
                    </Link>
                    <Link to="/user/management/update" className={`nav-link ${location.pathname === '/user/management/update' ? 'active' : ''}`} onClick={handleNavClick} title="Gestión">
                        <span style={{ marginRight: '0.5rem' }}>⚠️</span> {!isSidebarCollapsed && 'Gestión'}
                    </Link>
                    <Link to="/user/portfolio/update" className={`nav-link ${location.pathname === '/user/portfolio/update' ? 'active' : ''}`} onClick={handleNavClick} title="Cartera">
                        <span style={{ marginRight: '0.5rem' }}>📁</span> {!isSidebarCollapsed && 'Cartera'}
                    </Link>
                    <Link to="/user/guides/update" className={`nav-link ${location.pathname === '/user/guides/update' ? 'active' : ''}`} onClick={handleNavClick} title="Guías">
                        <span style={{ marginRight: '0.5rem' }}>🚚</span> {!isSidebarCollapsed && 'Guías'}
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

            {/* Inline styles for nav links */}
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
