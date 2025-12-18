import { useState, useEffect } from 'react';
import { updateManagementStatus, getAllMonths, listenToSalesByMonth } from '../services/SalesService';
import { updateUserActivity } from '../services/UserService';
import { logUserAction } from '../services/UserActivityService';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import LoadingOverlay from '../components/LoadingOverlay';
import { downloadTemplate } from '../utils/ExcelUtils';
import MultiSelectFilter, { EMPTY_VALUE } from '../components/MultiSelectFilter';

export default function ManagementStatusUpdate() {
    //const { currentUser } = useAuth();
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
    const columns = ['NUMERO', 'NOVEDAD_EN_GESTION'];
    const selectFields = ['NOVEDAD_EN_GESTION'];

    const [filters, setFilters] = useState({
        NUMERO: '',
        NOVEDAD_EN_GESTION: []  // Array for multi-select
    });
    const [uniqueValues, setUniqueValues] = useState({});
    const [hasEmptyValues, setHasEmptyValues] = useState({});

    // Date Range Filter State
    const [dateFilterType, setDateFilterType] = useState('all'); // 'all', 'before', 'after'
    const [dateFilterValue, setDateFilterValue] = useState('');

    // Filter Visibility State
    const [showFilters, setShowFilters] = useState(false);

    // Modal
    //const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [isNewRecord, setIsNewRecord] = useState(false);

    useEffect(() => {
        getAllMonths().then(setExistingMonths).catch(console.error);
    }, []);

    const { currentUser, userRole } = useAuth(); // Enhanced destructuring

    // ... lines 10-27 ...

    // Modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    // ...

    useEffect(() => {
        if (month) {
            setLoading(true);
            const unsubscribe = listenToSalesByMonth(month, (data) => {
                // Filter to show records where ESTADO_SIM is 'ACTIVA' or empty/null
                let processedData = data.filter(item => {
                    const simStatus = item.ESTADO_SIM ? String(item.ESTADO_SIM).toUpperCase().trim() : '';
                    return simStatus === 'ACTIVA' || simStatus === '';
                });

                // Sort by FECHA_INGRESO (oldest first)
                processedData.sort((a, b) => {
                    const dateA = a.FECHA_INGRESO ? new Date(a.FECHA_INGRESO + 'T00:00:00') : new Date(0);
                    const dateB = b.FECHA_INGRESO ? new Date(b.FECHA_INGRESO + 'T00:00:00') : new Date(0);
                    return dateA - dateB; // Ascending order (oldest first)
                });

                setSales(processedData);
                setFilteredSales(processedData);
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

        // Apply column filters
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

        // Apply date range filter
        if (dateFilterType !== 'all' && dateFilterValue) {
            const filterDate = new Date(dateFilterValue + 'T00:00:00');
            filtered = filtered.filter(item => {
                if (!item.FECHA_ACTIVACION) return false;
                const itemDate = new Date(item.FECHA_ACTIVACION + 'T00:00:00');

                if (dateFilterType === 'before') {
                    return itemDate < filterDate;
                } else if (dateFilterType === 'after') {
                    return itemDate > filterDate;
                }
                return true;
            });
        }

        setFilteredSales(filtered);
    }, [filters, sales, dateFilterType, dateFilterValue]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setCurrentPage(1);
    };

    const handleMultiSelectChange = (field, selectedValues) => {
        setFilters(prev => ({ ...prev, [field]: selectedValues }));
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters({ NUMERO: '', NOVEDAD_EN_GESTION: [] });
        setDateFilterType('all');
        setDateFilterValue('');
    };

    const handleEditClick = (record) => {
        setEditForm({ ...record });
        setIsNewRecord(false);
        setIsEditModalOpen(true);
    };

    const handleNewRecord = () => {
        setEditForm({ NUMERO: '', NOVEDAD_EN_GESTION: '' });
        setIsNewRecord(true);
        setIsEditModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await updateManagementStatus(month, [editForm]);
            setResult(res);
            if (currentUser) {
                updateUserActivity(currentUser.uid);
                const actionDetails = isNewRecord
                    ? `Creó nuevo registro: ${editForm.NUMERO}`
                    : `Actualizó registro: ${editForm.NUMERO} a ${editForm.NOVEDAD_EN_GESTION}`;
                logUserAction(currentUser.uid, currentUser.email, 'UPDATE_MANAGEMENT', actionDetails, { month, ...res });
            }
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
                const updates = data.map(r => {
                    const obj = { NUMERO: String(r['NUMERO'] || r['Numero'] || '').trim() };
                    const nov = r['NOVEDAD'] || r['Novedad'] || r['NOVEDAD_EN_GESTION'];
                    if (nov !== undefined && nov !== null && String(nov).trim() !== '') {
                        obj.NOVEDAD_EN_GESTION = String(nov).trim();
                    }
                    return obj;
                }).filter(r => r.NUMERO);
                const res = await updateManagementStatus(month, updates);
                setResult(res);
                if (currentUser) {
                    updateUserActivity(currentUser.uid);
                    logUserAction(currentUser.uid, currentUser.email, 'IMPORT_MANAGEMENT', `Importó ${updates.length} registros`, { month, ...res });
                }
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
                <div style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h2 style={{ fontSize: '0.85rem', margin: 0, fontWeight: '600', whiteSpace: 'nowrap' }}>Gestión</h2>
                        <select value={month} onChange={e => setMonth(e.target.value)} style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem', minWidth: '110px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', borderRadius: '4px' }}>
                            <option value="">Mes...</option>
                            {existingMonths.map(m => <option key={m}>{m}</option>)}
                        </select>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-secondary" onClick={() => downloadTemplate(['NUMERO', 'NOVEDAD_EN_GESTION'], 'Plantilla_Gestion')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>📥 Plantilla</button>

                            <label className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center', margin: 0 }}>
                                📤 Importar Excel
                                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} style={{ display: 'none' }} />
                            </label>

                            <select value={dateFilterType} onChange={e => setDateFilterType(e.target.value)} style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem', minWidth: '90px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', borderRadius: '4px' }}>
                                <option value="all">Todas</option>
                                <option value="before">Antes</option>
                                <option value="after">Después</option>
                            </select>

                            {dateFilterType !== 'all' && (
                                <input type="date" value={dateFilterValue} onChange={e => setDateFilterValue(e.target.value)} style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', borderRadius: '4px' }} />
                            )}
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
                                    <td style={{ padding: '0.4rem' }}>{item.NOVEDAD_EN_GESTION}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {
                    filteredSales.length > 0 && (
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
                    )
                }
            </div >

            {isEditModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-panel" style={{ width: '400px', padding: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>{isNewRecord ? 'Nuevo Registro' : 'Editar Novedad'}</h3>
                        <form onSubmit={handleSave}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Número</label>
                                <input required value={editForm.NUMERO} onChange={e => setEditForm({ ...editForm, NUMERO: e.target.value })} style={{ width: '100%', padding: '0.5rem' }} disabled={!isNewRecord} />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Novedad</label>
                                <select
                                    value={editForm.NOVEDAD_EN_GESTION || ''}
                                    onChange={e => setEditForm({ ...editForm, NOVEDAD_EN_GESTION: e.target.value })}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--glass-border)' }}
                                >
                                    <option value="">(Seleccionar)</option>
                                    <option value="VACIO">VACIO (Limpiar)</option>
                                    <option value="NO LLEGO">NO LLEGO</option>
                                    <option value="RECHAZADO">RECHAZADO</option>
                                    <option value="CE">CE</option>
                                    <option value="EN ESPERA">EN ESPERA</option>
                                    <option value="ENVIO PENDIENTE">ENVIO PENDIENTE</option>
                                    <option value="SIN CONTACTO">SIN CONTACTO</option>
                                </select>
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
