import { useState, useEffect } from 'react';
import { getUserActivity, getAllUsersActivity, logUserAction } from '../../services/UserActivityService'; // Need to implement getAllUsersActivity or just list users
import { getAllMonths } from '../../services/SalesService'; // Reuse for simplicity or use date picker
import { useAuth } from '../../contexts/AuthContext';
// We might need a way to list all users to filter by user. 
// For now, let's assume we can type the email or fetch from a users collection if available.
// Since we don't have a direct "list all users" function capable of giving us emails easily without admin SDK, 
// we might rely on the logs themselves to find available users or just a simple input for now.
// actually, let's check UserService to see if we can list users.

// Assuming we might not have a full user list, we can query unique users from logs if we structure them right, 
// or just use a date filter for all users if we implement a "get all logs for month" function.
// Let's implement getting logs for a month for ALL users in the service first or iterate.
// For now, let's stick to the plan: Select User (Type Email or ID?) and Date. 
// Better: Date Selector (Month) -> List of Users who were active? 
// The current structure is `user_activity_logs/{userId}/{yearMonth}`. 
// To list all activity for a month, we'd need to fetch `user_activity_logs` root and iterate.

import LoadingOverlay from '../../components/LoadingOverlay';

export default function UserActivitySummary() {
    const { currentUser } = useAuth(); // Should be admin
    // Use local time for default month to match logUserAction which uses local time
    const [month, setMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState(''); // Filter by email
    const [allLogs, setAllLogs] = useState([]); // Store all fetched logs

    // Helper to format date for input
    const getMonthInputValue = () => month.replace('_', '-');
    const handleMonthChange = (e) => setMonth(e.target.value.replace('-', '_'));

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getAllUsersActivity();

            const flattened = [];
            if (data) {
                Object.entries(data).forEach(([uid, months]) => {
                    if (months && months[month]) {
                        Object.entries(months[month]).forEach(([pushId, log]) => {
                            flattened.push({ id: pushId, uid, ...log });
                        });
                    }
                });
            }

            // Sort by timestamp desc
            flattened.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setAllLogs(flattened);
            setLogs(flattened);
        } catch (err) {
            alert("Error cargando actividad: " + err.message);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!month) return;
        fetchData();
    }, [month]);


    // Filter by user
    useEffect(() => {
        if (!selectedUser) {
            setLogs(allLogs);
        } else {
            const lower = selectedUser.toLowerCase();
            setLogs(allLogs.filter(l => l.userEmail.toLowerCase().includes(lower)));
        }
    }, [selectedUser, allLogs]);

    return (
        <div className="container" style={{ padding: '1rem', maxWidth: '1000px', margin: '0 auto', color: 'white' }}>
            {loading && <LoadingOverlay />}
            <div className="glass-panel" style={{ padding: '2rem' }}>
                <h2 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                    Resumen de Actividad de Usuarios
                </h2>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Mes</label>
                        <input
                            type="month"
                            value={getMonthInputValue()}
                            onChange={handleMonthChange}
                            style={{ padding: '0.5rem', borderRadius: '4px', border: 'none' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Filtrar Usuario (Email)</label>
                        <input
                            value={selectedUser}
                            onChange={e => setSelectedUser(e.target.value)}
                            placeholder="Buscar email..."
                            style={{ padding: '0.5rem', borderRadius: '4px', border: 'none', minWidth: '250px' }}
                        />
                    </div>
                    <button
                        onClick={() => fetchData()}
                        className="btn-primary"
                        style={{ padding: '0.5rem 1rem', height: '36px' }}
                        disabled={loading}
                    >
                        {loading ? 'Cargando...' : 'Consultar'}
                    </button>
                </div>

                <div className="table-container" style={{ maxHeight: '600px', overflow: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 10 }}>
                            <tr>
                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Fecha/Hora</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Usuario</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Acción</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Detalles</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ padding: '1rem', textAlign: 'center', opacity: 0.7 }}>
                                        No hay actividad registrada para este mes.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '0.75rem' }}>{new Date(log.timestamp).toLocaleString()}</td>
                                        <td style={{ padding: '0.75rem' }}>{log.userEmail}</td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span style={{
                                                background: 'rgba(255,255,255,0.1)',
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem'
                                            }}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>{log.details}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div style={{ marginTop: '1rem', textAlign: 'right', fontSize: '0.8rem', opacity: 0.7 }}>
                    Total registros: {logs.length}
                </div>
            </div>
        </div>
    );
}
