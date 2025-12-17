import { useState, useEffect } from 'react';
import { updateClientInfo, getAllMonths, listenToSalesByMonth } from '../services/SalesService';
import { updateUserActivity } from '../services/UserService';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import LoadingOverlay from '../components/LoadingOverlay';
import { downloadTemplate } from '../utils/ExcelUtils';

export default function ClientUpdate() {
    const { currentUser } = useAuth();
    const [month, setMonth] = useState('');
    const [existingMonths, setExistingMonths] = useState([]);
    const [mode, setMode] = useState('single'); // 'single' or 'excel'
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const [sales, setSales] = useState([]);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Filters State
    const [filters, setFilters] = useState({
        NUMERO: '',
        CONTACTO_1: '',
        CONTACTO_2: '',
        NOMBRE: ''
    });

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [showFilters, setShowFilters] = useState(false);

    const clearFilters = () => {
        setFilters({
            NUMERO: '',
            CONTACTO_1: '',
            CONTACTO_2: '',
            NOMBRE: ''
        });
        setCurrentPage(1);
    };

    // Initial Load
    useEffect(() => {
        const fetchMonths = async () => {
            try {
                const months = await getAllMonths();
                setExistingMonths(months);
            } catch (error) {
                console.error("Error cargando meses:", error);
            }
        };
        fetchMonths();
    }, []);

    // Real-time Listener
    useEffect(() => {
        if (!month) return;
        setLoading(true);
        const unsubscribe = listenToSalesByMonth(month, (data) => {
            // Sort by FECHA_INGRESO (oldest first)
            const sortedData = [...data].sort((a, b) => {
                const dateA = a.FECHA_INGRESO ? new Date(a.FECHA_INGRESO + 'T00:00:00') : new Date(0);
                const dateB = b.FECHA_INGRESO ? new Date(b.FECHA_INGRESO + 'T00:00:00') : new Date(0);
                return dateA - dateB; // Ascending order (oldest first)
            });

            setSales(sortedData);
            setLoading(false);
        });
        return () => { if (unsubscribe) unsubscribe(); };
    }, [month]);

    // Single Entry / Edit Form Data
    const [formData, setFormData] = useState({
        NUMERO: '',
        CONTACTO_1: '',
        CONTACTO_2: '',
        NOMBRE: ''
    });

    // Filter Logic
    const getFilteredSales = () => {
        return sales.filter(item => {
            const matchNumero = item.NUMERO?.toString().includes(filters.NUMERO) || filters.NUMERO === '';
            const matchC1 = item.CONTACTO_1?.toString().includes(filters.CONTACTO_1) || filters.CONTACTO_1 === '';
            const matchC2 = item.CONTACTO_2?.toString().includes(filters.CONTACTO_2) || filters.CONTACTO_2 === '';
            const matchNombre = item.NOMBRE?.toString().toLowerCase().includes(filters.NOMBRE.toLowerCase()) || filters.NOMBRE === '';
            return matchNumero && matchC1 && matchC2 && matchNombre;
        });
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setCurrentPage(1); // Reset page on filter
    };

    const handleDoubleClick = (record) => {
        setFormData({
            NUMERO: record.NUMERO,
            CONTACTO_1: record.CONTACTO_1 || '',
            CONTACTO_2: record.CONTACTO_2 || '',
            NOMBRE: record.NOMBRE || ''
        });
        setModalOpen(true);
    };

    const handleSingleSubmit = async (e) => {
        e.preventDefault();
        if (!month) return;

        setLoading(true);
        setResult(null);
        try {
            const res = await updateClientInfo(month, [formData]);
            setResult(res);
            if (res.updated > 0) {
                if (currentUser) updateUserActivity(currentUser.uid);
                setModalOpen(false); // Close if updated
                // Reset form data if in 'new entry' mode, but here we only have edit mode via table or modal.
                // If it was a new entry, we should clear. If edit, we close.
            }
        } catch (err) {
            alert("Error: " + err.message);
        }
        setLoading(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!month) {
            alert("Por favor seleccione un mes de operación antes de cargar el archivo.");
            e.target.value = null;
            return;
        }

        setLoading(true);
        setResult(null);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                const updates = data.map(row => {
                    const numero = row['NUMERO'] || row['Numero'] || row['numero'];
                    const contacto1 = row['CONTACTO_1'] || row['Contacto 1'] || row['CONTACTO 1'] || row['celular'] || row['CELULAR'];
                    const contacto2 = row['CONTACTO_2'] || row['Contacto 2'] || row['CONTACTO 2'];
                    const nombre = row['NOMBRE'] || row['Nombre'] || row['nombre'] || row['CLIENTE'] || row['Cliente'];

                    return {
                        NUMERO: String(numero || '').trim(),
                        CONTACTO_1: contacto1 ? String(contacto1).trim() : null,
                        CONTACTO_2: contacto2 ? String(contacto2).trim() : null,
                        NOMBRE: nombre ? String(nombre).trim() : null
                    };
                }).filter(item => item.NUMERO);

                if (updates.length === 0) {
                    alert("No se encontraron datos válidos. Asegúrese de tener la columna NUMERO.");
                    setLoading(false);
                    return;
                }

                const res = await updateClientInfo(month, updates);
                setResult(res);
                if (currentUser) updateUserActivity(currentUser.uid);
            } catch (err) {
                console.error(err);
                alert("Error procesando el archivo: " + err.message);
            }
            setLoading(false);
        };
        reader.readAsBinaryString(file);
        e.target.value = null;
    };

    const filteredData = getFilteredSales();

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    return (
        <div className="container" style={{ padding: '0.5rem', maxWidth: '100%', height: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column' }}>
            {loading && <LoadingOverlay />}
            <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Header Compacto */}
                <div style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h2 style={{ fontSize: '0.85rem', margin: 0, fontWeight: '600', whiteSpace: 'nowrap' }}>Info Cliente</h2>
                        <select value={month} onChange={(e) => setMonth(e.target.value)} style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem', minWidth: '110px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', borderRadius: '4px' }}>
                            <option value="">Mes...</option>
                            {existingMonths.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-secondary" onClick={() => downloadTemplate(['NUMERO', 'CONTACTO_1', 'CONTACTO_2', 'NOMBRE'], 'Plantilla_Clientes')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>📥 Plantilla</button>
                            <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block', flexShrink: 0 }}>
                                <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }} disabled={!month}>📤 Importar</button>
                                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={!month} style={{ position: 'absolute', left: 0, top: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
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

                {/* Notificación de Resultado */}
                {result && <div style={{ padding: '0.3rem 0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', fontSize: '0.75rem' }}>Última operación: {result.updated} actualizados, {result.skipped} omitidos.</div>}

                {/* Tabla */}
                <div className="table-container" style={{ flex: 1, overflow: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--card-bg)' }}>
                            <tr>
                                <th style={{ padding: '0.5rem', textAlign: 'left', minWidth: '100px' }}>
                                    <div style={{ marginBottom: showFilters ? '0.25rem' : '0' }}>NÚMERO</div>
                                    {showFilters && <input name="NUMERO" value={filters.NUMERO} onChange={handleFilterChange} placeholder="..." style={{ width: '100%', padding: '0.2rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '4px' }} />}
                                </th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', minWidth: '100px' }}>
                                    <div style={{ marginBottom: showFilters ? '0.25rem' : '0' }}>CONTACTO 1</div>
                                    {showFilters && <input name="CONTACTO_1" value={filters.CONTACTO_1} onChange={handleFilterChange} placeholder="..." style={{ width: '100%', padding: '0.2rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '4px' }} />}
                                </th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', minWidth: '100px' }}>
                                    <div style={{ marginBottom: showFilters ? '0.25rem' : '0' }}>CONTACTO 2</div>
                                    {showFilters && <input name="CONTACTO_2" value={filters.CONTACTO_2} onChange={handleFilterChange} placeholder="..." style={{ width: '100%', padding: '0.2rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '4px' }} />}
                                </th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', minWidth: '150px' }}>
                                    <div style={{ marginBottom: showFilters ? '0.25rem' : '0' }}>NOMBRE</div>
                                    {showFilters && <input name="NOMBRE" value={filters.NOMBRE} onChange={handleFilterChange} placeholder="..." style={{ width: '100%', padding: '0.2rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '4px' }} />}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1rem' }}>Cargando datos...</td></tr>
                            ) : currentItems.length === 0 ? (
                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1rem' }}>No se encontraron registros.</td></tr>
                            ) : (
                                currentItems.map((item, index) => (
                                    <tr key={index} onDoubleClick={() => handleDoubleClick(item)} className="hover-row" style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer' }}>
                                        <td style={{ padding: '0.5rem' }}>{item.NUMERO}</td>
                                        <td style={{ padding: '0.5rem' }}>{item.CONTACTO_1 || '-'}</td>
                                        <td style={{ padding: '0.5rem' }}>{item.CONTACTO_2 || '-'}</td>
                                        <td style={{ padding: '0.5rem' }}>{item.NOMBRE || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación Compacta */}
                <div style={{ padding: '0.5rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                    <span>{filteredData.length} registros</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>Anterior</button>
                        <span style={{ padding: '0.3rem 0.6rem' }}>{currentPage} / {totalPages || 1}</span>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>Siguiente</button>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {modalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className="glass-panel" style={{ padding: '2rem', width: '100%', maxWidth: '500px', margin: '1rem' }}>
                        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>{formData.NUMERO && sales.find(s => s.NUMERO === formData.NUMERO) ? 'Editar Cliente' : 'Nuevo Registro'}</h3>
                        <form onSubmit={handleSingleSubmit} style={{ display: 'grid', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Número *</label>
                                <input required value={formData.NUMERO} onChange={e => setFormData({ ...formData, NUMERO: e.target.value })} placeholder="Ej: 3001234567" style={{ width: '100%', padding: '0.5rem' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Contacto 1</label>
                                    <input value={formData.CONTACTO_1} onChange={e => setFormData({ ...formData, CONTACTO_1: e.target.value })} style={{ width: '100%', padding: '0.5rem' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Contacto 2</label>
                                    <input value={formData.CONTACTO_2} onChange={e => setFormData({ ...formData, CONTACTO_2: e.target.value })} style={{ width: '100%', padding: '0.5rem' }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Nombre</label>
                                <input value={formData.NOMBRE} onChange={e => setFormData({ ...formData, NOMBRE: e.target.value })} style={{ width: '100%', padding: '0.5rem' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
                                <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Guardando...' : 'Guardar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
