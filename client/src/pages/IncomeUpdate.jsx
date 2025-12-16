import { useState, useEffect } from 'react';
import { updateIncome, getAllMonths, listenToSalesByMonth } from '../services/SalesService';
import * as XLSX from 'xlsx';
import { useZxing } from "react-zxing";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

// Internal Scanner Component
const Scanner = ({ onScan, onClose }) => {
    const { ref } = useZxing({
        onResult(result) {
            onScan(result.getText());
        },
        options: {
            hints: new Map([
                [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE]]
            ])
        }
    });

    return (
        <div style={{ marginBottom: '2rem', background: '#000', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
            <video ref={ref} style={{ width: '100%', display: 'block' }} />
            <button
                onClick={onClose}
                style={{ position: 'absolute', top: '10px', right: '10px', background: 'red', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '4px', zIndex: 10 }}
            >
                Cerrar
            </button>
            <p style={{ color: 'white', textAlign: 'center', padding: '0.5rem', position: 'absolute', bottom: 0, width: '100%', background: 'rgba(0,0,0,0.5)' }}>
                Apuntando a Código de Barras (ICCID)
            </p>
        </div>
    );
};

export default function IncomeUpdate() {
    const [month, setMonth] = useState('');
    const [existingMonths, setExistingMonths] = useState([]);

    // Real-time data
    const [sales, setSales] = useState([]);
    const [filteredSales, setFilteredSales] = useState([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Columns
    const columns = ['NUMERO', 'REGISTRO_SIM', 'FECHA_INGRESO', 'ICCID'];
    const selectFields = ['REGISTRO_SIM'];

    const [filters, setFilters] = useState({ NUMERO: '', REGISTRO_SIM: '', FECHA_INGRESO: '', ICCID: '' });
    const [uniqueValues, setUniqueValues] = useState({});

    // Modes & Modals
    const [isScanning, setIsScanning] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [isNewRecord, setIsNewRecord] = useState(false);

    // Scan Result Modal State
    const [scanResult, setScanResult] = useState(null); // { found: bool, data: object, iccid: string }

    useEffect(() => {
        getAllMonths().then(setExistingMonths).catch(console.error);
    }, []);

    // Listen to sales
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

    // Calculate unique values for Select filters
    useEffect(() => {
        if (sales.length > 0) {
            const unique = {};
            selectFields.forEach(field => {
                const values = [...new Set(sales.map(s => {
                    let val = s[field];
                    if (val === true) return 'true';
                    if (val === false) return 'false';
                    return val;
                }).filter(v => v !== null && v !== undefined && v !== ''))];
                unique[field] = values.sort();
            });
            setUniqueValues(unique);
        }
    }, [sales]);

    // Apply filters
    useEffect(() => {
        let filtered = sales;
        columns.forEach(col => {
            if (filters[col]) {
                const filterVal = filters[col].toLowerCase();
                filtered = filtered.filter(item => {
                    let val = item[col];
                    if (val === true) val = 'true';
                    else if (val === false) val = 'false';
                    else val = val ? String(val) : '';

                    return val.toLowerCase().includes(filterVal);
                });
            }
        });
        setFilteredSales(filtered);
    }, [filters, sales]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setCurrentPage(1);
    };

    const clearFilters = () => setFilters({ NUMERO: '', REGISTRO_SIM: '', FECHA_INGRESO: '', ICCID: '' });

    // --- Scanner Logic ---
    const handleScanMatch = (scannedIccid) => {
        if (!scannedIccid) return;
        const cleanIccid = String(scannedIccid).trim();
        setIsScanning(false); // Stop scanning on detection

        const found = sales.find(s => { // Search in local real-time sales
            if (!s.ICCID) return false;
            const dbIccid = String(s.ICCID).trim();
            return dbIccid === cleanIccid || dbIccid.includes(cleanIccid) || cleanIccid.includes(dbIccid);
        });

        if (found) {
            setScanResult({ found: true, data: found, iccid: cleanIccid });
        } else {
            setScanResult({ found: false, data: null, iccid: cleanIccid });
        }
    };

    const handleMarkRegistroSIM = async (value) => {
        if (!scanResult?.data) return;

        const payload = {
            NUMERO: scanResult.data.NUMERO,
            ICCID: scanResult.data.ICCID,
            REGISTRO_SIM: value,
            FECHA_INGRESO: new Date().toISOString().split('T')[0]
        };

        setLoading(true);
        try {
            const res = await updateIncome(month, [payload]);
            setResult(res);
            setScanResult(null); // Close result modal
            // Automatically resume scanning after short delay if desired, or stay closed
        } catch (err) {
            alert("Error: " + err.message);
        }
        setLoading(false);
    };

    const closeScanResult = () => {
        setScanResult(null);
        setIsScanning(true); // Resume scanning
    };

    // --- Editing Logic ---
    const handleEditClick = (record) => {
        setEditForm({ ...record });
        setIsNewRecord(false);
        setIsEditModalOpen(true);
    };

    const handleNewRecord = () => {
        setEditForm({
            NUMERO: '',
            REGISTRO_SIM: '',
            FECHA_INGRESO: new Date().toISOString().split('T')[0],
            ICCID: ''
        });
        setIsNewRecord(true);
        setIsEditModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Convert select value to boolean/null if needed, but endpoint might handle string 'true'/'false'
            // Let's standardise to boolean for REGISTRO_SIM
            const finalForm = { ...editForm };
            if (finalForm.REGISTRO_SIM === 'true' || finalForm.REGISTRO_SIM === true) finalForm.REGISTRO_SIM = true;
            else if (finalForm.REGISTRO_SIM === 'false' || finalForm.REGISTRO_SIM === false) finalForm.REGISTRO_SIM = false;
            else finalForm.REGISTRO_SIM = null;

            const res = await updateIncome(month, [finalForm]);
            setResult(res);
            setIsEditModalOpen(false);
        } catch (err) {
            alert(err.message);
        }
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
                const updates = data.map(row => {
                    const numero = row['NUMERO'] || row['Numero'] || row['numero'];
                    const registro = row['REGISTRO SIM'] || row['Registro Sim'] || row['REGISTRO_SIM'];
                    const fecha = row['FECHA INGRESO'] || row['Fecha Ingreso'] || row['FECHA_INGRESO'];
                    const iccid = row['ICCID'] || row['Iccid'] || row['ICID'] || row['icid'];

                    return {
                        NUMERO: String(numero || '').trim(),
                        REGISTRO_SIM: registro ? String(registro).trim() : null,
                        FECHA_INGRESO: fecha ? String(fecha).trim() : null,
                        ICCID: iccid ? String(iccid).trim() : null
                    };
                }).filter(r => r.NUMERO);

                const res = await updateIncome(month, updates);
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
                    <h2 style={{ fontSize: '1.25rem' }}>Actualizar Ingresos</h2>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                            value={month}
                            onChange={e => setMonth(e.target.value)}
                            style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', minWidth: '150px' }}
                        >
                            <option value="">-- Seleccionar Mes --</option>
                            {existingMonths.map(m => <option key={m}>{m}</option>)}
                        </select>


                        <button onClick={() => { if (!month) return alert("Selecciona Mes"); setIsScanning(!isScanning); }} disabled={!month} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', background: 'var(--accent)' }}>
                            📷 {isScanning ? 'Cerrar Escáner' : 'Escanear'}
                        </button>

                        <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
                            <button className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} disabled={!month}>
                                📤 Importar Excel
                            </button>
                            <input
                                type="file"
                                accept=".xlsx"
                                onChange={handleFileUpload}
                                disabled={!month}
                                style={{ position: 'absolute', left: 0, top: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                            />
                        </div>
                    </div>
                </div>

                {isScanning && (
                    <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.5)' }}>
                        <Scanner onScan={handleScanMatch} onClose={() => setIsScanning(false)} />
                    </div>
                )}

                {/* Scan Result Modal Overlays */}
                {scanResult && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                        <div className="glass-panel" style={{ maxWidth: '90%', width: '500px', padding: '2rem' }}>
                            {scanResult.found ? (
                                <>
                                    <div style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#10b981', fontSize: '1.5rem' }}>✓ ¡ICCID Encontrado!</div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <strong>Número:</strong> {scanResult.data.NUMERO}<br />
                                        <strong>ICCID:</strong> {scanResult.data.ICCID}<br />
                                        <strong>Estado:</strong> {scanResult.data.REGISTRO_SIM ? 'Registrado' : 'No Registrado'}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                        <button onClick={() => handleMarkRegistroSIM(true)} className="btn-primary" style={{ background: '#10b981' }}>✓ VERDADERO</button>
                                        <button onClick={() => handleMarkRegistroSIM(false)} className="btn-primary" style={{ background: '#ef4444' }}>✗ FALSO</button>
                                    </div>
                                    <button onClick={closeScanResult} style={{ marginTop: '1rem', width: '100%', padding: '0.5rem', background: 'transparent', border: '1px solid white', color: 'white', borderRadius: '4px' }}>Cancelar</button>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <h3 style={{ color: '#f59e0b' }}>ICCID No Encontrado</h3>
                                    <p>{scanResult.iccid}</p>
                                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <button onClick={() => { setScanResult(null); setIsScanning(true); }} className="btn-primary">Seguir Escaneando</button>
                                        <button onClick={() => setScanResult(null)} className="btn-secondary">Cerrar</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {result && (
                    <div style={{ padding: '0.5rem 1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', fontSize: '0.9rem' }}>
                        Última operación: {result.updated} actualizados, {result.skipped} omitidos.
                    </div>
                )}

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
                                                {(uniqueValues[col] || []).map(val => <option key={val} value={val}>{val === 'true' ? 'VERDADERO' : val === 'false' ? 'FALSO' : val}</option>)}
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
                                <tr
                                    key={index}
                                    onDoubleClick={() => handleEditClick(item)}
                                    style={{
                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        cursor: 'pointer',
                                        background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'
                                    }}
                                    className="table-row-hover"
                                >
                                    <td style={{ padding: '0.6rem' }}>{item.NUMERO}</td>
                                    <td style={{ padding: '0.6rem' }}>{item.REGISTRO_SIM ? 'VERDADERO' : (item.REGISTRO_SIM === false ? 'FALSO' : '')}</td>
                                    <td style={{ padding: '0.6rem' }}>{item.FECHA_INGRESO}</td>
                                    <td style={{ padding: '0.6rem' }}>{item.ICCID}</td>
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

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-panel" style={{ width: '400px', padding: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>{isNewRecord ? 'Nuevo Registro' : 'Editar Registro'}</h3>
                        <form onSubmit={handleSave}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Número</label>
                                <input required value={editForm.NUMERO} onChange={e => setEditForm({ ...editForm, NUMERO: e.target.value })} style={{ width: '100%', padding: '0.5rem' }} disabled={!isNewRecord} />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Registro SIM</label>
                                <select
                                    value={editForm.REGISTRO_SIM === true ? 'true' : editForm.REGISTRO_SIM === false ? 'false' : ''}
                                    onChange={e => setEditForm({ ...editForm, REGISTRO_SIM: e.target.value })}
                                    style={{ width: '100%', padding: '0.5rem' }}
                                >
                                    <option value="">(Seleccionar)</option>
                                    <option value="true">VERDADERO</option>
                                    <option value="false">FALSO</option>
                                </select>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Fecha Ingreso</label>
                                <input type="date" value={editForm.FECHA_INGRESO || ''} onChange={e => setEditForm({ ...editForm, FECHA_INGRESO: e.target.value })} style={{ width: '100%', padding: '0.5rem' }} />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>ICCID</label>
                                <input value={editForm.ICCID || ''} onChange={e => setEditForm({ ...editForm, ICCID: e.target.value })} style={{ width: '100%', padding: '0.5rem' }} />
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
