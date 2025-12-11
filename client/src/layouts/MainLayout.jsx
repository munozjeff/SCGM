import { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../store/slices/authSlice';

export default function MainLayout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user, role } = useSelector((state) => state.auth);

    const handleLogout = async () => {
        await dispatch(logoutUser());
        navigate('/login', { replace: true });
    };

    return (
        <div className="layout-container" style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Mobile Header */}
            <header className="mobile-header glass-panel" style={{
                display: 'none',
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                padding: '1rem',
                zIndex: 50,
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>SCGM</h1>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem' }}>
                    ☰
                </button>
            </header>

            {/* Sidebar */}
            <aside className={`sidebar glass-panel ${isMobileMenuOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`} style={{
                width: isSidebarCollapsed ? '60px' : '260px',
                minHeight: '100vh',
                maxHeight: '100vh',
                position: 'sticky',
                top: 0,
                padding: isSidebarCollapsed ? '1rem 0.5rem' : '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '2rem',
                transition: 'width 0.3s ease',
                overflow: 'hidden'
            }}>
                {/* Toggle Button */}
                <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    style={{
                        position: 'absolute',
                        right: '-15px',
                        top: '20px',
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        zIndex: 100,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}
                    title={isSidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
                >
                    {isSidebarCollapsed ? '→' : '←'}
                </button>

                <div className="logo" style={{
                    fontSize: isSidebarCollapsed ? '1rem' : '1.5rem',
                    fontWeight: 'bold',
                    color: 'var(--primary)',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                }}>
                    {isSidebarCollapsed ? 'S' : `SCGM ${role === 'admin' ? 'Admin' : 'Usuario'}`}
                </div>

                <nav style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    paddingRight: '0.5rem',
                    marginRight: '-0.5rem'
                }}>
                    {role === 'admin' && (
                        <Link to="/" className="nav-link" title="Dashboard">
                            {isSidebarCollapsed ? '📊' : 'Dashboard'}
                        </Link>
                    )}
                    <Link to="/sales/update" className="nav-link" title="Actualizar Ventas">
                        {isSidebarCollapsed ? '➕' : 'Actualizar Ventas'}
                    </Link>
                    <Link to="/income/update" className="nav-link" title="Actualizar Ingresos">
                        {isSidebarCollapsed ? '💰' : 'Actualizar Ingresos'}
                    </Link>
                    <Link to="/client/update" className="nav-link" title="Actualizar Cliente">
                        {isSidebarCollapsed ? '👤' : 'Actualizar Cliente'}
                    </Link>
                    <Link to="/activation/update" className="nav-link" title="Actualizar F. Activación">
                        {isSidebarCollapsed ? '📅' : 'Actualizar F. Activación'}
                    </Link>
                    <Link to="/sim/update" className="nav-link" title="Actualizar Estado SIM">
                        {isSidebarCollapsed ? '📶' : 'Actualizar Estado SIM'}
                    </Link>
                    <Link to="/sales-type/update" className="nav-link" title="Actualizar Tipo Venta">
                        {isSidebarCollapsed ? '🏷️' : 'Actualizar Tipo Venta'}
                    </Link>
                    <Link to="/management/update" className="nav-link" title="Actualizar Novedad Gestión">
                        {isSidebarCollapsed ? '🔔' : 'Actualizar Novedad Gestión'}
                    </Link>
                    <Link to="/portfolio/update" className="nav-link" title="Actualizar Cartera">
                        {isSidebarCollapsed ? '💼' : 'Actualizar Cartera'}
                    </Link>
                    <Link to="/guides/update" className="nav-link" title="Actualizar Guías">
                        {isSidebarCollapsed ? '🚚' : 'Actualizar Guías'}
                    </Link>
                    <Link to="/database" className="nav-link" title="Base de Datos">
                        {isSidebarCollapsed ? '📋' : 'Base de Datos'}
                    </Link>
                    {role === 'admin' && (
                        <Link to="/admin/users" className="nav-link" title="Gestionar Usuarios">
                            {isSidebarCollapsed ? '👥' : 'Gestionar Usuarios'}
                        </Link>
                    )}
                </nav>

                <div style={{ marginTop: 'auto' }}>
                    <div className="user-profile" style={{ padding: '0.5rem', borderTop: '1px solid var(--glass-border)' }}>
                        {!isSidebarCollapsed && (
                            <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                {user?.email}
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                background: 'rgba(239, 68, 68, 0.2)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                color: '#f87171',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                fontSize: isSidebarCollapsed ? '1rem' : '0.9rem',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.3)'}
                            onMouseOut={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.2)'}
                            title="Cerrar Sesión"
                        >
                            {isSidebarCollapsed ? '🚪' : '🚪 Cerrar Sesión'}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main style={{ flex: 1, padding: '2rem', marginTop: '0' }}>
                <Outlet />
            </main>

            {/* Responsive Styles */}
            <style>{`
        .nav-link {
          color: var(--text-muted);
          text-decoration: none;
          padding: 0.75rem;
          border-radius: var(--radius-md);
          transition: all 0.2s;
        }
        .nav-link:hover {
          background: rgba(255, 255, 255, 0.05);
          color: white;
        }
        
        /* Custom Scrollbar for Navigation */
        nav::-webkit-scrollbar {
          width: 6px;
        }
        nav::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        nav::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.5);
          border-radius: 3px;
        }
        nav::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.7);
        }
        
        @media (max-width: 768px) {
          .layout-container { flex-direction: column; }
          .mobile-header { display: flex !important; }
          .sidebar {
            position: fixed;
            left: -100%;
            z-index: 40;
            background: var(--bg-app);
            transition: left 0.3s ease;
            width: 80%;
          }
          .sidebar.open { left: 0; }
          main { padding-top: 5rem !important; }
        }
      `}</style>
        </div>
    );
}
