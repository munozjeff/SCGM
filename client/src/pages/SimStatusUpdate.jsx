import { useState, useEffect } from 'react';
import { updateSimStatus, getAllMonths, listenToSalesByMonth } from '../services/SalesService';
import { updateUserActivity } from '../services/UserService';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import LoadingOverlay from '../components/LoadingOverlay';
import { downloadTemplate } from '../utils/ExcelUtils';
import MultiSelectFilter, { EMPTY_VALUE } from '../components/MultiSelectFilter';

export default function SimStatusUpdate() {
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
    const columns = ['NUMERO', 'ESTADO_SIM', 'ICCID'];
    const selectFields = ['ESTADO_SIM'];

    const [filters, setFilters] = useState({
        NUMERO: '',
        ESTADO_SIM: [],  // Array for multi-select
        ICCID: ''
    });
    const [uniqueValues, setUniqueValues] = useState({});
    const [hasEmptyValues, setHasEmptyValues] = useState({});

    // Filter Visibility State
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
        if (sales.length > 0) {
            const unique = {};
            const hasEmpty = {};
            selectFields.forEach(field => {
                const allValues = sales.map(s => s[field]);
                hasEmpty[field] = allValues.some(v => v == null || v === '');
                const values = [...new Set(allValues.filter(v => v !== null && v !== undefined && v !== ''))];
                unique[field] = values.sort();
            });
            setUniqueValues(unique);
            setHasEmptyValues(hasEmpty);
        }
    }, [sales]);

    useEffect(() => {
        let filtered = sales;
        columns.forEach(col => {
            const filterVal = filters[col];

            // Skip empty filters
            if (!filterVal || (Array.isArray(filterVal) && filterVal.length === 0)) {
                return;
            }

            filtered = filtered.filter(item => {
                const val = item[col] ? String(item[col]).toLowerCase() : '';

                // Multi-select filter (array)
                if (Array.isArray(filterVal)) {
                    if (filterVal.includes(EMPTY_VALUE)) {
                        const checkEmpty = item[col] == null || item[col] === '';
                        const otherValues = filterVal.filter(v => v !== EMPTY_VALUE);
                        const checkOthers = otherValues.length > 0 ? otherValues.includes(item[col]) : false;
                        return checkEmpty || checkOthers;
                    }
                    return filterVal.includes(item[col]);
                }

                // Text filter (string)
                return val.includes(filterVal.toLowerCase());
            });
        });
        setFilteredSales(filtered);
    }, [filters, sales]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setCurrentPage(1);
    };

    const handleMultiSelectChange = (field, selectedValues) => {
        setFilters(prev => ({ ...prev, [field]: selectedValues }));
        setCurrentPage(1);
    };

    const clearFilters = () => setFilters({ NUMERO: '', ESTADO_SIM: [], ICCID: '' });

    const handleEditClick = (record) => {
        setEditForm({ ...record });
        setIsNewRecord(false);
        setIsEditModalOpen(true);
    };

    const handleNewRecord = () => {
        setEditForm({ NUMERO: '', ESTADO_SIM: '', ICCID: '' });
        setIsNewRecord(true);
        setIsEditModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await updateSimStatus(month, [editForm]);
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
                const wb = XLSX.read(evt.target.result, { type: 'binary' });
                const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                const updates = data.map(row => ({
                    NUMERO: String(row['NUMERO'] || row['Numero'] || '').trim(),
                    ESTADO_SIM: row['ESTADO SIM'] || row['Estado Sim'] || row['ESTADO_SIM'],
                    ICCID: row['ICCID'] || row['Iccid'] || row['ICID']
                })).filter(r => r.NUMERO);
                const res = await updateSimStatus(month, updates);
                setResult(res);
                if (currentUser) updateUserActivity(currentUser.uid);
            } catch (err) { alert(err.message); }
            setLoading(false);
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadTemplate = () => {
        downloadTemplate(['NUMERO', 'ESTADO_SIM', 'ICCID'], 'Plantilla_Estado_SIM');
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
                <div style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h2 style={{ fontSize: '0.85rem', margin: 0, fontWeight: '600', whiteSpace: 'nowrap' }}>Estado SIM</h2>
                        <select value={month} onChange={e => setMonth(e.target.value)} style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem', minWidth: '110px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', borderRadius: '4px' }}>
                            <option value="">Mes...</option>
                            {existingMonths.map(m => <option key={m}>{m}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-secondary" onClick={handleDownloadTemplate} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>📥 Plantilla</button>
                            <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block', flexShrink: 0 }}>
                                <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }} disabled={!month}>📤 Importar</button>
                                <input type="file" accept=".xlsx" onChange={handleFileUpload} disabled={!month} style={{ position: 'absolute', left: 0, top: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <button onClick={() => setShowFilters(!showFilters)} style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', color: showFilters ? '#10b981' : '#60a5fa', background: 'transparent', border: 'none', cursor: 'pointer' }} title={showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}>
                            {showFilters ? 'Ocultar' : '🔍 Filtros'}
                        </button>
                        <button onClick={clearFilters} style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer' }}>Limpiar</button>
                    </div>
                </div>

                {result && <div style={{ padding: '0.3rem 0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', fontSize: '0.75rem' }}>Última operación: {result.updated} actualizados, {result.skipped} omitidos.</div>}

                <div className="table-container" style={{ flex: 1, overflow: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--card-bg)' }}>
                            <tr>
                                {columns.map(col => (
                                    <th key={col} style={{ padding: '0.5rem', textAlign: 'left', minWidth: '120px' }}>
                                        <div style={{ marginBottom: showFilters ? '0.25rem' : '0' }}>{col.replace('_', ' ')}</div>
                                        {showFilters && (
                                            selectFields.includes(col) ? (
                                                <MultiSelectFilter
                                                    label={col.replace('_', ' ')}
                                                    values={uniqueValues[col] || []}
                                                    selectedValues={filters[col] || []}
                                                    onChange={(values) => handleMultiSelectChange(col, values)}
                                                    hasEmptyValues={hasEmptyValues[col] || false}
                                                />
                                            ) : (
                                                <input value={filters[col]} onChange={(e) => handleFilterChange(col, e.target.value)} placeholder="..." style={{ width: '100%', padding: '0.2rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '4px' }} />
                                            )
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {currentItems.map((item, index) => (
                                <tr key={index} onDoubleClick={() => handleEditClick(item)} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }} className="table-row-hover">
                                    <td style={{ padding: '0.6rem' }}>{item.NUMERO}</td>
                                    <td style={{ padding: '0.6rem' }}>{item.ESTADO_SIM}</td>
                                    <td style={{ padding: '0.6rem' }}>{item.ICCID || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredSales.length > 0 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem',
                        borderTop: '1px solid var(--glass-border)',
                        background: 'var(--bg-secondary)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <span>Filas por página:</span>
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
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={200}>200</option>
                                <option value={500}>500</option>
                            </select>
                            <span>Página {currentPage} de {totalPages || 1} ({filteredSales.length} registros)</span>
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

            {isEditModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-panel" style={{ width: '400px', padding: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>{isNewRecord ? 'Nuevo Registro' : 'Editar Estado'}</h3>
                        <form onSubmit={handleSave}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Número</label>
                                <input required value={editForm.NUMERO} onChange={e => setEditForm({ ...editForm, NUMERO: e.target.value })} style={{ width: '100%', padding: '0.5rem' }} disabled={!isNewRecord} />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Estado SIM</label>
                                <select
                                    value={editForm.ESTADO_SIM || ''}
                                    onChange={e => setEditForm({ ...editForm, ESTADO_SIM: e.target.value })}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--glass-border)' }}
                                >
                                    <option value="">(Seleccionar)</option>
                                    <option value="ACTIVA">ACTIVA</option>
                                    <option value="INACTIVA">INACTIVA</option>
                                    <option value="ENVIADA">ENVIADA</option>
                                    <option value="OTRO CANAL">OTRO CANAL</option>
                                    <option value="No se encontro información del cliente">No se encontro información del cliente</option>
                                </select>
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>ICCID</label>
                                <input value={editForm.ICCID || ''} onChange={e => setEditForm({ ...editForm, ICCID: e.target.value })} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)' }} />
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
