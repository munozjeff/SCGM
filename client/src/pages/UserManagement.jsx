import { useState, useEffect } from 'react';
import { createUser, getAllUsers, updateUserRole, deleteUserData } from '../services/UserService';

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Form state
    const [newUser, setNewUser] = useState({
        email: '',
        password: '',
        role: 'user'
    });
    const [message, setMessage] = useState({ type: '', text: '' });

    // Cargar usuarios al montar
    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const usersList = await getAllUsers();
            setUsers(usersList);
        } catch {
            setMessage({ type: 'error', text: 'Error al cargar usuarios' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            await createUser(newUser.email, newUser.password, newUser.role);
            setMessage({ type: 'success', text: `Usuario ${newUser.email} creado exitosamente` });
            setNewUser({ email: '', password: '', role: 'user' });
            setShowCreateForm(false);
            loadUsers();
            setCurrentPage(1);
        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Error al crear usuario' });
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (uid, currentRole) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        try {
            await updateUserRole(uid, newRole);
            setMessage({ type: 'success', text: 'Rol actualizado' });
            loadUsers();
        } catch {
            setMessage({ type: 'error', text: 'Error al cambiar rol' });
        }
    };

    const handleDeleteUser = async (uid, email) => {
        if (!window.confirm(`¿Eliminar usuario ${email}?`)) return;

        try {
            await deleteUserData(uid);
            setMessage({ type: 'success', text: 'Usuario eliminado' });
            loadUsers();
        } catch {
            setMessage({ type: 'error', text: 'Error al eliminar usuario' });
        }
    };

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentUsers = users.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(users.length / itemsPerPage);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
    };

    return (
        <div className="container">
            <div className="glass-panel" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                    <h2 style={{ margin: 0 }}>Gestión de Usuarios</h2>
                    <button
                        className="btn-primary"
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        style={{ padding: '0.5rem 1rem' }}
                    >
                        {showCreateForm ? '✕ Cancelar' : '➕ Crear Usuario'}
                    </button>
                </div>

                {/* Mensajes */}
                {message.text && (
                    <div style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '1.5rem',
                        background: message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                        color: message.type === 'success' ? '#34d399' : '#f87171'
                    }}>
                        {message.text}
                    </div>
                )}

                {/* Formulario de Creación */}
                {showCreateForm && (
                    <form onSubmit={handleCreateUser} className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                        <h3 style={{ marginBottom: '1rem' }}>Nuevo Usuario</h3>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Email</label>
                                <input
                                    type="email"
                                    required
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    minLength="6"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Rol</label>
                                <select
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                >
                                    <option value="user">Usuario</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>
                            <button type="submit" disabled={loading} className="btn-primary">
                                {loading ? 'Creando...' : 'Crear Usuario'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Lista de Usuarios */}
                <div>
                    <h3 style={{ marginBottom: '1rem' }}>Usuarios Registrados ({users.length})</h3>
                    {loading && <p>Cargando...</p>}

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {currentUsers.map(user => (
                            <div key={user.uid} className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: '600' }}>{user.email}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Rol: <span style={{ color: user.role === 'admin' ? 'var(--primary)' : 'var(--text-main)' }}>{user.role}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleRoleChange(user.uid, user.role)}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: 'rgba(99, 102, 241, 0.2)',
                                            border: '1px solid rgba(99, 102, 241, 0.4)',
                                            color: 'var(--primary)',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        {user.role === 'admin' ? '👤 Hacer Usuario' : '⭐ Hacer Admin'}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteUser(user.uid, user.email)}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: 'rgba(239, 68, 68, 0.2)',
                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                            color: '#f87171',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        🗑️ Eliminar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination Controls */}
                    {users.length > 0 && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '2rem',
                            paddingTop: '1rem',
                            borderTop: '1px solid var(--glass-border)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                <span>Usuarios por página:</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    style={{
                                        padding: '0.2rem',
                                        fontSize: '0.8rem',
                                        borderRadius: '4px',
                                        border: '1px solid var(--glass-border)',
                                        background: 'var(--bg-card)',
                                        color: 'white'
                                    }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>
                                <span>Página {currentPage} de {totalPages || 1} ({users.length} usuarios)</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="btn-secondary"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', opacity: currentPage === 1 ? 0.5 : 1 }}
                                >
                                    Anterior
                                </button>
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="btn-secondary"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', opacity: currentPage === totalPages ? 0.5 : 1 }}
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
