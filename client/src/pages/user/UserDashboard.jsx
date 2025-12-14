import { useState, useEffect } from 'react';
import { getSalesByMonth, getAllMonths } from '../../services/SalesService';

export default function UserDashboard() {
    const [months, setMonths] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [stats, setStats] = useState({
        total: 0,
        pendientes: 0,
        registrados: 0
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadMonths();
    }, []);

    useEffect(() => {
        if (selectedMonth) {
            loadStats();
        }
    }, [selectedMonth]);

    const loadMonths = async () => {
        try {
            const monthsList = await getAllMonths();
            setMonths(monthsList);
            if (monthsList.length > 0) {
                setSelectedMonth(monthsList[0]);
            }
        } catch (error) {
            console.error('Error loading months:', error);
        }
    };

    const loadStats = async () => {
        if (!selectedMonth) return;

        setLoading(true);
        try {
            const sales = await getSalesByMonth(selectedMonth);
            const pendientes = sales.filter(s => s.REGISTRO_SIM === null || s.REGISTRO_SIM === '' || s.REGISTRO_SIM === undefined).length;
            const registrados = sales.filter(s => s.REGISTRO_SIM === true).length;

            setStats({
                total: sales.length,
                pendientes,
                registrados
            });
        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container">
            <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <h1 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                    Dashboard - Usuario
                </h1>

                {/* Month Selector */}
                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                        Mes de Operación
                    </label>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        style={{ maxWidth: '300px', padding: '0.75rem', fontSize: '1rem' }}
                    >
                        <option value="">Seleccionar mes...</option>
                        {months.map(month => (
                            <option key={month} value={month}>{month}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        Cargando estadísticas...
                    </div>
                ) : selectedMonth && (
                    <>
                        {/* Stats Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                            {/* Total */}
                            <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                    Total de Registros
                                </div>
                                <div style={{ fontSize: '3rem', fontWeight: '700', color: 'var(--primary)' }}>
                                    {stats.total}
                                </div>
                            </div>

                            {/* Pendientes */}
                            <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                    REGISTRO SIM Pendientes
                                </div>
                                <div style={{ fontSize: '3rem', fontWeight: '700', color: '#f59e0b' }}>
                                    {stats.pendientes}
                                </div>
                            </div>

                            {/* Registrados */}
                            <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                    Ya Registrados
                                </div>
                                <div style={{ fontSize: '3rem', fontWeight: '700', color: '#10b981' }}>
                                    {stats.registrados}
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '2rem' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Acciones Rápidas</h3>
                            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                                <a
                                    href="/user/registro-sim"
                                    className="btn-primary"
                                    style={{ textDecoration: 'none', textAlign: 'center', padding: '1rem' }}
                                >
                                    📱 Actualizar REGISTRO SIM
                                </a>
                                <a
                                    href="/user/database"
                                    className="btn-primary"
                                    style={{ textDecoration: 'none', textAlign: 'center', padding: '1rem', background: 'transparent', border: '1px solid var(--glass-border)' }}
                                >
                                    📋 Ver Base de Datos
                                </a>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
