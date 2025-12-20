import { useState, useEffect } from 'react';
import { getAllMonths, updateIncome, listenToSalesByMonth } from '../../services/SalesService';
import { Scanner } from '../../components/BarcodeScanner';
import * as XLSX from 'xlsx';

export default function RegistroSIMUpdate() {
    const [months, setMonths] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [sales, setSales] = useState([]);
    const [pendingSales, setPendingSales] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    // Modal state
    const [editingRecord, setEditingRecord] = useState(null);
    const [scanResult, setScanResult] = useState(null);
    const [result, setResult] = useState(null);

    // Filter state
    const [filters, setFilters] = useState({ NUMERO: '', ICCID: '' });
    const [filteredPending, setFilteredPending] = useState([]);

    useEffect(() => {
        loadMonths();
    }, []);

    // Listen to real-time changes
    useEffect(() => {
        if (!selectedMonth) return;
        setLoading(true);
        const unsubscribe = listenToSalesByMonth(selectedMonth, (salesData) => {
            setSales(salesData);
            setLoading(false);
        });
        return () => { if (unsubscribe) unsubscribe(); };
    }, [selectedMonth]);

    useEffect(() => {
        // 1. Filter pending (REGISTRO_SIM is null/false)
        const pending = sales.filter(s =>
            s.REGISTRO_SIM !== 'LLEGO' && s.REGISTRO_SIM !== true && String(s.REGISTRO_SIM).toUpperCase() !== 'TRUE'
        );
        setPendingSales(pending);

        // 2. Apply UI filters
        const lowerFilters = {
            NUMERO: filters.NUMERO.toLowerCase(),
            ICCID: filters.ICCID.toLowerCase()
        };

        const finalFiltered = pending.filter(item => {
            return (
                (item.NUMERO || '').toLowerCase().includes(lowerFilters.NUMERO) &&
                (item.ICCID || '').toLowerCase().includes(lowerFilters.ICCID)
            );
        });
        setFilteredPending(finalFiltered);

    }, [sales, filters]);

    const loadMonths = async () => {
        try {
            const monthsList = await getAllMonths();
            setMonths(monthsList);
            if (monthsList.length > 0) setSelectedMonth(monthsList[0]);
        } catch (error) { console.error('Error loading months:', error); }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const clearFilters = () => setFilters({ NUMERO: '', ICCID: '' });

    const handleScanMatch = (scannedIccid) => {
        if (!scannedIccid) return;
        const cleanIccid = String(scannedIccid).trim();
        setIsScanning(false);
        const found = pendingSales.find(s => {
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

    const handleUpdateRegistroSIM = async (numero, iccid, value) => {
        const payload = {
            NUMERO: numero,
            ICCID: iccid,
            REGISTRO_SIM: value,
            FECHA_INGRESO: new Date().toISOString().split('T')[0]
        };
        setLoading(true);
        try {
            const res = await updateIncome(selectedMonth, [payload]);
            setResult(res);
            if (res.updated > 0) {
                setEditingRecord(null);
                setScanResult(null);
                setTimeout(() => setResult(null), 3000);
            }
        } catch (err) { alert("Error: " + err.message); }
        setLoading(false);
    };

    const handleExportExcel = () => {
        if (pendingSales.length === 0) { alert("No hay registros"); return; }
        const dataToExport = pendingSales.map(s => ({
            NUMERO: s.NUMERO,
            ICCID: s.ICCID || '',
            REGISTRO_SIM: '',
            FECHA_INGRESO: ''
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pendientes");
        XLSX.writeFile(wb, `Registro_SIM_Pendientes_${selectedMonth}.xlsx`);
    };

    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedMonth) return;
        setLoading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const wb = XLSX.read(evt.target.result, { type: 'binary' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const data = XLSX.utils.sheet_to_json(ws);
                    const updates = data.map(row => ({
                        NUMERO: String(row['NUMERO'] || row['Numero'] || '').trim(),
                        REGISTRO_SIM: row['REGISTRO SIM'] || row['REGISTRO_SIM'] ? String(row['REGISTRO SIM'] || row['REGISTRO_SIM']).trim() : null,
                        FECHA_INGRESO: row['FECHA INGRESO'] || row['FECHA_INGRESO'] ? String(row['FECHA INGRESO'] || row['FECHA_INGRESO']).trim() : null,
                        ICCID: row['ICCID'] || row['Iccid'] ? String(row['ICCID'] || row['Iccid']).trim() : null
                    })).filter(item => item.NUMERO);

                    if (updates.length > 0) {
                        const res = await updateIncome(selectedMonth, updates);
                        setResult(res);
                        setTimeout(() => setResult(null), 3000);
                    } else { alert("No se encontraron datos válidos"); }
                } catch (err) { alert("Error procesando: " + err.message); }
                setLoading(false);
            };
            reader.readAsBinaryString(file);
        } catch (err) { alert("Error leyendo: " + err.message); setLoading(false); }
        e.target.value = null;
    };

    const closeScanResult = () => { setScanResult(null); setIsScanning(true); };

    return (
        <div className="container" style={{ padding: '1rem', maxWidth: '100%', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
            <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>Actualizar REGISTRO SIM</h2>

                <div style={{ marginBottom: '1rem' }}>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        style={{ width: '100%', maxWidth: '300px', padding: '0.5rem', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid var(--glass-border)' }}
                    >
                        <option value="">Seleccionar mes...</option>
                        {months.map(month => <option key={month} value={month}>{month}</option>)}
                    </select>
                </div>

                {selectedMonth && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <button className="btn-primary" onClick={() => setIsScanning(!isScanning)} style={{ background: isScanning ? 'var(--accent)' : '' }}>
                            {isScanning ? '⏸️ Pausar' : '📷 Escanear'}
                        </button>
                        <button className="btn-secondary" onClick={handleExportExcel} disabled={pendingSales.length === 0}>
                            📥 Exportar ({pendingSales.length})
                        </button>
                        <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
                            <button className="btn-secondary">📤 Importar</button>
                            <input type="file" accept=".xlsx" onChange={handleImportExcel} style={{ position: 'absolute', left: 0, top: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                        </div>
                    </div>
                )}

                {isScanning && <div style={{ marginBottom: '1rem' }}><Scanner onScan={handleScanMatch} onClose={() => setIsScanning(false)} /></div>}

                {/* Scan Result Modal */}
                {scanResult && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
                        <div className="glass-panel" style={{ width: '90%', maxWidth: '400px', padding: '2rem' }}>
                            {scanResult.found ? (
                                <>
                                    <div style={{ textAlign: 'center', color: '#10b981', fontSize: '1.5rem', marginBottom: '1rem' }}>✓ ¡Encontrado!</div>
                                    <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{scanResult.data.NUMERO}</div>
                                        <div style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{scanResult.data.ICCID}</div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                        <button onClick={() => handleUpdateRegistroSIM(scanResult.data.NUMERO, scanResult.data.ICCID, "LLEGO")} className="btn-primary" style={{ background: '#10b981' }}>✓ LLEGO</button>
                                        <button onClick={() => handleUpdateRegistroSIM(scanResult.data.NUMERO, scanResult.data.ICCID, "NO LLEGO")} className="btn-primary" style={{ background: '#ef4444' }}>✗ NO LLEGO</button>
                                    </div>
                                    <button onClick={closeScanResult} className="btn-secondary" style={{ width: '100%' }}>Cancelar</button>
                                </>
                            ) : (
                                <>
                                    <div style={{ textAlign: 'center', color: '#f59e0b', fontSize: '1.2rem', marginBottom: '1rem' }}>⚠ No Encontrado</div>
                                    <div style={{ textAlign: 'center', fontFamily: 'monospace', marginBottom: '1.5rem' }}>{scanResult.iccid}</div>
                                    <button onClick={closeScanResult} className="btn-primary" style={{ width: '100%' }}>Continuar</button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {editingRecord && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
                        <div className="glass-panel" style={{ width: '90%', maxWidth: '400px', padding: '2rem' }}>
                            <h3 style={{ marginBottom: '1.5rem' }}>Actualizar</h3>
                            <div style={{ marginBottom: '1rem' }}><strong>Número:</strong> {editingRecord.NUMERO}</div>
                            <div style={{ marginBottom: '1.5rem' }}><small>{editingRecord.ICCID}</small></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <button onClick={() => handleUpdateRegistroSIM(editingRecord.NUMERO, editingRecord.ICCID, "LLEGO")} className="btn-primary" style={{ background: '#10b981' }}>✓ LLEGO</button>
                                <button onClick={() => handleUpdateRegistroSIM(editingRecord.NUMERO, editingRecord.ICCID, "NO LLEGO")} className="btn-primary" style={{ background: '#ef4444' }}>✗ NO LLEGO</button>
                            </div>
                            <button onClick={() => setEditingRecord(null)} className="btn-secondary" style={{ width: '100%' }}>Cancelar</button>
                        </div>
                    </div>
                )}

                {result && <div style={{ padding: '0.5rem', marginBottom: '0.5rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.1)' }}>{result.updated} actualizados</div>}

                {/* Table */}
                {selectedMonth && (
                    <div className="table-container" style={{ flex: 1, overflow: 'auto' }}>
                        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--card-bg)' }}>
                                <tr>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>
                                        NUMERO
                                        <input value={filters.NUMERO || ''} onChange={(e) => handleFilterChange('NUMERO', e.target.value)} placeholder="..." style={{ display: 'block', width: '100%', padding: '0.25rem', fontSize: '0.75rem', marginTop: '0.25rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '4px' }} />
                                    </th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>
                                        ICCID
                                        <input value={filters.ICCID || ''} onChange={(e) => handleFilterChange('ICCID', e.target.value)} placeholder="..." style={{ display: 'block', width: '100%', padding: '0.25rem', fontSize: '0.75rem', marginTop: '0.25rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '4px' }} />
                                    </th>
                                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>
                                        <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.75rem' }}>x Filtros</button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPending.map((item, index) => (
                                    <tr key={index} onDoubleClick={() => setEditingRecord(item)} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                                        <td style={{ padding: '0.75rem' }}>{item.NUMERO}</td>
                                        <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{item.ICCID || '-'}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <button onClick={() => setEditingRecord(item)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--primary)', border: 'none', color: 'white', borderRadius: '4px' }}>Editar</button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredPending.length === 0 && (
                                    <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>{pendingSales.length === 0 ? '¡Todo al día!' : 'No hay coincidencias'}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
