import { useState, useEffect } from 'react';
import { updateClientInfo, getAllMonths, listenToSalesByMonth } from '../services/SalesService';
import * as XLSX from 'xlsx';

export default function ClientUpdate() {
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
            setSales(data);
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

    return (
        <div className="container">
            <div className="glass-panel" style={{ padding: '2rem' }}>
                <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Actualizar Info Cliente</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{filteredData.length} registros</span>
                </h2>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Mes de Operación</label>
                    <select
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        style={{ width: '100%', maxWidth: '300px', padding: '0.5rem' }}
                    >
                        <option value="">-- Seleccionar Mes --</option>
                        {existingMonths.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

                {month && (() => {
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
                        <div style={{ marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>

                                <label className="btn-primary" style={{ background: 'transparent', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>
                                    📤 Importar Excel
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleFileUpload}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            </div>

                            {result && (
                                <div style={{
                                    background: result.updated > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                    border: result.updated > 0 ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                                    color: result.updated > 0 ? '#34d399' : '#f87171',
                                    padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem'
                                }}>
                                    <strong>Resultado:</strong> {result.updated} registros actualizados, {result.skipped} omitidos.
                                </div>
                            )}

                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                <span>* Doble click en una fila para editar.</span>
                                <span>Página {currentPage} de {totalPages || 1} ({filteredData.length} registros)</span>
                            </div>

                            <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 5 }}>
                                        <tr>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>
                                                <div style={{ marginBottom: '0.5rem' }}>NÚMERO</div>
                                                <input name="NUMERO" value={filters.NUMERO} onChange={handleFilterChange} placeholder="Filtrar..." style={{ width: '100%', padding: '0.25rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'white' }} />
                                            </th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>
                                                <div style={{ marginBottom: '0.5rem' }}>CONTACTO 1</div>
                                                <input name="CONTACTO_1" value={filters.CONTACTO_1} onChange={handleFilterChange} placeholder="Filtrar..." style={{ width: '100%', padding: '0.25rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'white' }} />
                                            </th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>
                                                <div style={{ marginBottom: '0.5rem' }}>CONTACTO 2</div>
                                                <input name="CONTACTO_2" value={filters.CONTACTO_2} onChange={handleFilterChange} placeholder="Filtrar..." style={{ width: '100%', padding: '0.25rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'white' }} />
                                            </th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>
                                                <div style={{ marginBottom: '0.5rem' }}>NOMBRE</div>
                                                <input name="NOMBRE" value={filters.NOMBRE} onChange={handleFilterChange} placeholder="Filtrar..." style={{ width: '100%', padding: '0.25rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', color: 'white' }} />
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Cargando datos...</td></tr>
                                        ) : filteredData.length === 0 ? (
                                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No se encontraron registros.</td></tr>
                                        ) : (
                                            currentItems.map((item, index) => (
                                                <tr
                                                    key={index}
                                                    onDoubleClick={() => handleDoubleClick(item)}
                                                    className="hover-row"
                                                    style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer' }}
                                                    title="Doble click para editar"
                                                >
                                                    <td style={{ padding: '0.75rem' }}>{item.NUMERO}</td>
                                                    <td style={{ padding: '0.75rem' }}>{item.CONTACTO_1 || '-'}</td>
                                                    <td style={{ padding: '0.75rem' }}>{item.CONTACTO_2 || '-'}</td>
                                                    <td style={{ padding: '0.75rem' }}>{item.NOMBRE || '-'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Control de Paginación */}
                            {filteredData.length > 0 && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginTop: '1rem',
                                    paddingTop: '1rem',
                                    borderTop: '1px solid var(--glass-border)',
                                    fontSize: '0.8rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                                        <span style={{ margin: '0 0.5rem' }}>
                                            Página <strong style={{ color: 'white' }}>{currentPage}</strong> de {totalPages}
                                        </span>
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
                    );
                })()}

            </div>

            {/* Edit/Create Modal */}
            {modalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="glass-panel" style={{ padding: '2rem', width: '100%', maxWidth: '500px', margin: '1rem' }}>
                        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                            {formData.NUMERO && sales.find(s => s.NUMERO === formData.NUMERO) ? 'Editar Cliente' : 'Nuevo Registro'}
                        </h3>
                        <form onSubmit={handleSingleSubmit} style={{ display: 'grid', gap: '1rem' }}>
                            <div>
                                <label>Número *</label>
                                <input
                                    required
                                    value={formData.NUMERO}
                                    onChange={e => setFormData({ ...formData, NUMERO: e.target.value })}
                                    placeholder="Ej: 3001234567"
                                    style={{ width: '100%', padding: '0.75rem' }}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label>Contacto 1</label>
                                    <input
                                        value={formData.CONTACTO_1}
                                        onChange={e => setFormData({ ...formData, CONTACTO_1: e.target.value })}
                                        placeholder="Ej: 3xxxxxxxxx"
                                        style={{ width: '100%', padding: '0.75rem' }}
                                    />
                                </div>
                                <div>
                                    <label>Contacto 2</label>
                                    <input
                                        value={formData.CONTACTO_2}
                                        onChange={e => setFormData({ ...formData, CONTACTO_2: e.target.value })}
                                        placeholder="Ej: 3xxxxxxxxx"
                                        style={{ width: '100%', padding: '0.75rem' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label>Nombre</label>
                                <input
                                    value={formData.NOMBRE}
                                    onChange={e => setFormData({ ...formData, NOMBRE: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="btn-secondary"
                                    style={{ background: 'transparent', border: '1px solid var(--glass-border)' }}
                                >
                                    Cancelar
                                </button>
                                <button type="submit" disabled={loading} className="btn-primary">
                                    {loading ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
