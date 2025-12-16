import { useState, useEffect } from 'react';
import { updateSalesType, getAllMonths, listenToSalesByMonth } from '../services/SalesService';
import * as XLSX from 'xlsx';

export default function SalesTypeUpdate() {
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
    const columns = ['NUMERO', 'TIPO_VENTA'];
    const selectFields = ['TIPO_VENTA'];

    const [filters, setFilters] = useState({ NUMERO: '', TIPO_VENTA: '' });
    const [uniqueValues, setUniqueValues] = useState({});

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
                setSales(data);
                setFilteredSales(data);
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
            selectFields.forEach(field => {
                const values = [...new Set(sales.map(s => s[field]).filter(v => v !== null && v !== undefined && v !== ''))];
                unique[field] = values.sort();
            });
            setUniqueValues(unique);
        }
    }, [sales]);

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

    const clearFilters = () => setFilters({ NUMERO: '', TIPO_VENTA: '' });

    const handleEditClick = (record) => {
        setEditForm({ ...record });
        setIsNewRecord(false);
        setIsEditModalOpen(true);
    };

    const handleNewRecord = () => {
        setEditForm({ NUMERO: '', TIPO_VENTA: '' });
        setIsNewRecord(true);
        setIsEditModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await updateSalesType(month, [editForm]);
            setResult(res);
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
                    TIPO_VENTA: String(row['TIPO VENTA'] || row['Tipo Venta'] || row['TIPO_VENTA'] || '').trim() || null
                })).filter(item => item.NUMERO);
                const res = await updateSalesType(month, updates);
                setResult(res);
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
        <div className="container" style={{ padding: '1rem', maxWidth: '100%', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
            <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ fontSize: '1.25rem' }}>Actualizar Tipo Venta</h2>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                            value={month}
                            onChange={e => setMonth(e.target.value)}
                            style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', minWidth: '150px' }}
                        >
                            <option value="">-- Seleccionar Mes --</option>
                            {existingMonths.map(m => <option key={m}>{m}</option>)}
                        </select>

                        <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
                            <button className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} disabled={!month}>📤 Importar Excel</button>
                            <input type="file" accept=".xlsx" onChange={handleFileUpload} disabled={!month} style={{ position: 'absolute', left: 0, top: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                        </div>
                    </div>
                </div>

                {result && <div style={{ padding: '0.5rem 1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', fontSize: '0.9rem' }}>Última operación: {result.updated} actualizados, {result.skipped} omitidos.</div>}

                <div style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={clearFilters} style={{ fontSize: '0.8rem', color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer' }}>Limpiar Filtros</button>
                </div>

                <div className="table-container" style={{ flex: 1, overflow: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--card-bg)' }}>
                            <tr>
                                {columns.map(col => (
                                    <th key={col} style={{ padding: '0.75rem', textAlign: 'left', minWidth: '150px' }}>
                                        <div style={{ marginBottom: '0.25rem' }}>{col.replace('_', ' ')}</div>
                                        {selectFields.includes(col) ? (
                                            <select
                                                value={filters[col]}
                                                onChange={(e) => handleFilterChange(col, e.target.value)}
                                                style={{ width: '100%', padding: '0.2rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '4px' }}
                                            >
                                                <option value="">Todos</option>
                                                {(uniqueValues[col] || []).map(val => <option key={val} value={val}>{val}</option>)}
                                            </select>
                                        ) : (
                                            <input value={filters[col]} onChange={(e) => handleFilterChange(col, e.target.value)} placeholder="..." style={{ width: '100%', padding: '0.2rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '4px' }} />
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {currentItems.map((item, index) => (
                                <tr key={index} onDoubleClick={() => handleEditClick(item)} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }} className="table-row-hover">
                                    <td style={{ padding: '0.6rem' }}>{item.NUMERO}</td>
                                    <td style={{ padding: '0.6rem' }}>{item.TIPO_VENTA}</td>
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
                        <h3 style={{ marginBottom: '1.5rem' }}>{isNewRecord ? 'Nuevo Registro' : 'Editar Tipo'}</h3>
                        <form onSubmit={handleSave}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Número</label>
                                <input required value={editForm.NUMERO} onChange={e => setEditForm({ ...editForm, NUMERO: e.target.value })} style={{ width: '100%', padding: '0.5rem' }} disabled={!isNewRecord} />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Tipo Venta</label>
                                <select
                                    value={editForm.TIPO_VENTA || ''}
                                    onChange={e => setEditForm({ ...editForm, TIPO_VENTA: e.target.value })}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--glass-border)' }}
                                >
                                    <option value="">(Seleccionar)</option>
                                    <option value="portabilidad">portabilidad</option>
                                    <option value="linea nueva">linea nueva</option>
                                    <option value="ppt">ppt</option>
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
