import { useState, useEffect } from 'react';
import { updateActivationDate, getAllMonths, listenToSalesByMonth } from '../services/SalesService';
import { updateUserActivity } from '../services/UserService';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import LoadingOverlay from '../components/LoadingOverlay';

export default function ActivationUpdate() {
    const { currentUser } = useAuth();
    const [month, setMonth] = useState('');
    const [existingMonths, setExistingMonths] = useState([]);
    const [sales, setSales] = useState([]);
    const [filteredSales, setFilteredSales] = useState([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Columns
    const columns = ['NUMERO', 'FECHA_ACTIVACION'];
    const selectFields = []; // No selects here

    const [filters, setFilters] = useState({ NUMERO: '', FECHA_ACTIVACION: '' });
    const [showFilters, setShowFilters] = useState(false);

    // Modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [isNewRecord, setIsNewRecord] = useState(false);

    useEffect(() => {
        getAllMonths().then(setExistingMonths).catch(console.error);
    }, []);

    useEffect(() => {
        if (month) {
            setLoading(true);
            const unsubscribe = listenToSalesByMonth(month, (data) => {
                // Sort by FECHA_INGRESO (oldest first)
                const sortedData = [...data].sort((a, b) => {
                    const dateA = a.FECHA_INGRESO ? new Date(a.FECHA_INGRESO + 'T00:00:00') : new Date(0);
                    const dateB = b.FECHA_INGRESO ? new Date(b.FECHA_INGRESO + 'T00:00:00') : new Date(0);
                    return dateA - dateB; // Ascending order (oldest first)
                });

                setSales(sortedData);
                setFilteredSales(sortedData);
                setLoading(false);
            });
            return () => unsubscribe();
        } else {
            setSales([]);
            setFilteredSales([]);
        }
    }, [month]);

    useEffect(() => {
        let filtered = sales;
        columns.forEach(col => {
            if (filters[col]) {
                const filterVal = filters[col].toLowerCase();
                filtered = filtered.filter(item => {
                    const val = item[col] ? String(item[col]).toLowerCase() : '';
                    return val.includes(filterVal);
                });
            }
        });
        setFilteredSales(filtered);
    }, [filters, sales]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setCurrentPage(1);
    };

    const clearFilters = () => setFilters({ NUMERO: '', FECHA_ACTIVACION: '' });

    const handleEditClick = (record) => {
        setEditForm({ ...record });
        setIsNewRecord(false);
        setIsEditModalOpen(true);
    };

    const handleNewRecord = () => {
        setEditForm({ NUMERO: '', FECHA_ACTIVACION: '' });
        setIsNewRecord(true);
        setIsEditModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await updateActivationDate(month, [editForm]);
            setResult(res);
            if (currentUser) updateUserActivity(currentUser.uid);
            setIsEditModalOpen(false);
        } catch (err) { alert(err.message); }
        setLoading(false);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file || !month) return;
        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: true });
                const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                const updates = data.map(row => {
                    let fechaRaw = row['FECHA ACTIVACION'] || row['Fecha Activacion'] || row['FECHA_ACTIVACION'];
                    let fechaValida = null;
                    if (fechaRaw) {
                        if (fechaRaw instanceof Date && !isNaN(fechaRaw)) {
                            fechaValida = fechaRaw.toISOString().split('T')[0];
                        } else if (typeof fechaRaw === 'string') {
                            const d = new Date(fechaRaw);
                            if (!isNaN(d.getTime())) fechaValida = d.toISOString().split('T')[0];
                        } else if (typeof fechaRaw === 'number') {
                            const d = new Date(Math.round((fechaRaw - 25569) * 86400 * 1000));
                            if (!isNaN(d.getTime())) fechaValida = d.toISOString().split('T')[0];
                        }
                    }
                    return { NUMERO: String(row['NUMERO'] || '').trim(), FECHA_ACTIVACION: fechaValida };
                }).filter(r => r.NUMERO);

                const res = await updateActivationDate(month, updates);
                setResult(res);
                if (currentUser) updateUserActivity(currentUser.uid);
            } catch (err) { alert(err.message); }
            setLoading(false);
        };
        reader.readAsBinaryString(file);
    };

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredSales.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredSales.length / itemsPerPage);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
    };

    return (
        <div className="container" style={{ padding: '0.5rem', maxWidth: '100%', height: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column' }}>
            {loading && <LoadingOverlay />}
            <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header Compacto */}
                <div style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h2 style={{ fontSize: '0.85rem', margin: 0, fontWeight: '600', whiteSpace: 'nowrap' }}>Activación</h2>
                        <select
                            value={month}
                            onChange={e => setMonth(e.target.value)}
                            style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem', minWidth: '110px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', borderRadius: '4px' }}
                        >
                            <option value="">Mes...</option>
                            {existingMonths.map(m => <option key={m}>{m}</option>)}
                        </select>

                        <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block', flexShrink: 0 }}>
                            <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }} disabled={!month}>📤 Importar</button>
                            <input type="file" accept=".xlsx" onChange={handleFileUpload} disabled={!month} style={{ position: 'absolute', left: 0, top: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <button onClick={() => setShowFilters(!showFilters)} style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', color: showFilters ? '#10b981' : '#60a5fa', background: 'transparent', border: 'none', cursor: 'pointer' }} title={showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}>
                            {showFilters ? '🔍' : '📊'}
                        </button>
                        <button onClick={clearFilters} style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer' }}>Limpiar</button>
                    </div>
                </div>

                {/* Resultado */}
                {result && <div style={{ padding: '0.3rem 0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', fontSize: '0.75rem' }}>Última operación: {result.updated} actualizados, {result.skipped} omitidos.</div>}

                {/* Tabla */}
                <div className="table-container" style={{ flex: 1, overflow: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--card-bg)' }}>
                            <tr>
                                {columns.map(col => (
                                    <th key={col} style={{ padding: '0.5rem', textAlign: 'left', minWidth: '100px' }}>
                                        <div style={{ marginBottom: showFilters ? '0.25rem' : '0' }}>{col.replace('_', ' ')}</div>
                                        {showFilters && (
                                            <input value={filters[col]} onChange={(e) => handleFilterChange(col, e.target.value)} placeholder="..." style={{ width: '100%', padding: '0.2rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '4px' }} />
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: '1rem' }}>Cargando...</td></tr>
                            ) : currentItems.length === 0 ? (
                                <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: '1rem' }}>No se encontraron registros.</td></tr>
                            ) : (
                                currentItems.map((item, index) => (
                                    <tr key={index} onDoubleClick={() => handleEditClick(item)} style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer' }} className="hover-row">
                                        <td style={{ padding: '0.5rem' }}>{item.NUMERO}</td>
                                        <td style={{ padding: '0.5rem' }}>{item.FECHA_ACTIVACION}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación Compacta */}
                <div style={{ padding: '0.5rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                    <span>{filteredSales.length} registros</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>Anterior</button>
                        <span style={{ padding: '0.3rem 0.6rem' }}>{currentPage} / {totalPages || 1}</span>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>Siguiente</button>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isEditModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-panel" style={{ width: '400px', padding: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>{isNewRecord ? 'Nuevo Registro' : 'Editar Fecha'}</h3>
                        <form onSubmit={handleSave}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem' }}>Número</label>
                                <input required value={editForm.NUMERO} onChange={e => setEditForm({ ...editForm, NUMERO: e.target.value })} style={{ width: '100%', padding: '0.5rem' }} disabled={!isNewRecord} />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem' }}>Fecha Activación</label>
                                <input type="date" value={editForm.FECHA_ACTIVACION || ''} onChange={e => setEditForm({ ...editForm, FECHA_ACTIVACION: e.target.value })} style={{ width: '100%', padding: '0.5rem' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn-secondary" disabled={loading}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
