import { useState, useEffect } from 'react';
import { getSalesByMonth, getAllMonths, updateIncome } from '../../services/SalesService';
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

    useEffect(() => {
        loadMonths();
    }, []);

    useEffect(() => {
        if (selectedMonth) {
            loadSales();
        }
    }, [selectedMonth]);

    useEffect(() => {
        // Filter pending sales (REGISTRO_SIM is null, empty, or false)
        const pending = sales.filter(s =>
            s.REGISTRO_SIM === null ||
            s.REGISTRO_SIM === '' ||
            s.REGISTRO_SIM === undefined ||
            s.REGISTRO_SIM === false
        );
        setPendingSales(pending);
    }, [sales]);

    const loadMonths = async () => {
        try {
            const monthsList = await getAllMonths();
            setMonths(monthsList);
            if (monthsList.length > 0) {
                setSelectedMonth(monthsList[0]);
            }
        } catch (error) {
            console.error('Error loading months:', error);
        }
    };

    const loadSales = async () => {
        if (!selectedMonth) return;

        setLoading(true);
        try {
            const salesData = await getSalesByMonth(selectedMonth);
            setSales(salesData);
        } catch (error) {
            console.error('Error loading sales:', error);
            alert('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const handleScanMatch = (scannedIccid) => {
        if (!scannedIccid) return;

        const cleanIccid = String(scannedIccid).trim();
        console.log("Scanned ICCID:", cleanIccid);

        setIsScanning(false);

        const found = pendingSales.find(s => {
            if (!s.ICCID) return false;
            const dbIccid = String(s.ICCID).trim();
            return dbIccid === cleanIccid || dbIccid.includes(cleanIccid) || cleanIccid.includes(dbIccid);
        });

        if (found) {
            console.log("Match found:", found);
            setScanResult({ found: true, data: found, iccid: cleanIccid });
        } else {
            console.warn("No match for ICCID:", cleanIccid);
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
                loadSales();  // Reload data
                setEditingRecord(null);
                setScanResult(null);
                setTimeout(() => setResult(null), 3000);
            }
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = () => {
        if (pendingSales.length === 0) {
            alert("No hay registros pendientes para exportar");
            return;
        }

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
        if (!file) return;

        if (!selectedMonth) {
            alert("Por favor selecciona un mes primero");
            e.target.value = null;
            return;
        }

        setLoading(true);
        try {
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
                        const registro = row['REGISTRO SIM'] || row['REGISTRO_SIM'] || row['Registro Sim'];
                        const fecha = row['FECHA INGRESO'] || row['FECHA_INGRESO'] || row['Fecha Ingreso'];
                        const iccid = row['ICCID'] || row['Iccid'] || row['ICID'];

                        return {
                            NUMERO: String(numero || '').trim(),
                            REGISTRO_SIM: registro ? String(registro).trim() : null,
                            FECHA_INGRESO: fecha ? String(fecha).trim() : null,
                            ICCID: iccid ? String(iccid).trim() : null
                        };
                    }).filter(item => item.NUMERO);

                    if (updates.length === 0) {
                        alert("No se encontraron datos válidos en el archivo");
                        setLoading(false);
                        return;
                    }

                    const res = await updateIncome(selectedMonth, updates);
                    setResult(res);
                    loadSales();
                    setTimeout(() => setResult(null), 3000);
                } catch (err) {
                    console.error(err);
                    alert("Error procesando el archivo: " + err.message);
                }
                setLoading(false);
            };
            reader.readAsBinaryString(file);
        } catch (err) {
            alert("Error leyendo el archivo: " + err.message);
            setLoading(false);
        }
        e.target.value = null; // Reset input
    };

    const closeScanResult = () => {
        setScanResult(null);
        setIsScanning(true);
    };

    return (
        <div className="container">
            <div className="glass-panel" style={{ padding: '2rem' }}>
                <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                    Actualizar REGISTRO SIM
                </h2>

                {/* Month Selector */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                        Mes de Operación
                    </label>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        style={{ width: '100%', maxWidth: '300px' }}
                    >
                        <option value="">Seleccionar mes...</option>
                        {months.map(month => (
                            <option key={month} value={month}>{month}</option>
                        ))}
                    </select>
                </div>

                {/* Action Buttons */}
                {selectedMonth && (
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                        <button
                            className="btn-primary"
                            onClick={() => {
                                if (!selectedMonth) return alert("Selecciona un mes primero");
                                setIsScanning(!isScanning);
                            }}
                            style={{ background: isScanning ? 'var(--accent)' : '', flex: '1', minWidth: '200px' }}
                        >
                            {isScanning ? '⏸️ Pausar Escáner' : '📷 Escanear Código'}
                        </button>
                        <button
                            className="btn-primary"
                            onClick={handleExportExcel}
                            disabled={pendingSales.length === 0}
                            style={{ background: 'transparent', border: '1px solid var(--glass-border)', flex: '1', minWidth: '200px' }}
                        >
                            📥 Exportar Excel ({pendingSales.length})
                        </button>
                        <label
                            className="btn-primary"
                            style={{ background: 'transparent', border: '1px solid var(--glass-border)', flex: '1', minWidth: '200px', cursor: 'pointer', textAlign: 'center' }}
                        >
                            📤 Importar Excel
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleImportExcel}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>
                )}

                {/* Scanner */}
                {isScanning && (
                    <Scanner
                        onScan={handleScanMatch}
                        onClose={() => setIsScanning(false)}
                    />
                )}

                {/* Scan Result Modal - Reusing from IncomeUpdate */}
                {scanResult && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.85)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem',
                        animation: 'fadeIn 0.2s ease-out'
                    }}>
                        <div className="glass-panel" style={{
                            maxWidth: '500px',
                            width: '100%',
                            padding: '2rem',
                            animation: 'slideUp 0.3s ease-out'
                        }}>
                            {scanResult.found ? (
                                <>
                                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                        <div style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 1rem',
                                            fontSize: '3rem',
                                            animation: 'scaleIn 0.4s ease-out'
                                        }}>✓</div>
                                        <h2 style={{ color: '#10b981', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
                                            ¡ICCID Encontrado!
                                        </h2>
                                    </div>

                                    <div style={{
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '1.5rem',
                                        marginBottom: '1.5rem',
                                        border: '1px solid rgba(16, 185, 129, 0.2)'
                                    }}>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                Número de Teléfono
                                            </label>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)', fontFamily: 'monospace' }}>
                                                {scanResult.data.NUMERO}
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                ICCID
                                            </label>
                                            <div style={{ fontSize: '0.95rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                                {scanResult.data.ICCID}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', marginBottom: '1rem' }}>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center' }}>
                                            Actualizar estado de REGISTRO SIM:
                                        </p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <button
                                                onClick={() => handleUpdateRegistroSIM(scanResult.data.NUMERO, scanResult.data.ICCID, true)}
                                                disabled={loading}
                                                style={{
                                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '1rem',
                                                    borderRadius: 'var(--radius-md)',
                                                    fontWeight: '700',
                                                    cursor: loading ? 'not-allowed' : 'pointer',
                                                    opacity: loading ? 0.6 : 1
                                                }}
                                            >
                                                <div>✓</div>
                                                <div>VERDADERO</div>
                                            </button>
                                            <button
                                                onClick={() => handleUpdateRegistroSIM(scanResult.data.NUMERO, scanResult.data.ICCID, false)}
                                                disabled={loading}
                                                style={{
                                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '1rem',
                                                    borderRadius: 'var(--radius-md)',
                                                    fontWeight: '700',
                                                    cursor: loading ? 'not-allowed' : 'pointer',
                                                    opacity: loading ? 0.6 : 1
                                                }}
                                            >
                                                <div>✗</div>
                                                <div>FALSO</div>
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        onClick={closeScanResult}
                                        disabled={loading}
                                        style={{
                                            width: '100%',
                                            background: 'transparent',
                                            color: 'var(--text-muted)',
                                            border: '1px solid var(--glass-border)',
                                            padding: '0.75rem',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: loading ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {loading ? 'Procesando...' : 'Cancelar y Seguir Escaneando'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                        <div style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 1rem',
                                            fontSize: '3rem'
                                        }}>⚠</div>
                                        <h2 style={{ color: '#f59e0b' }}>ICCID No Encontrado</h2>
                                    </div>

                                    <div style={{
                                        background: 'rgba(245, 158, 11, 0.1)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '1.5rem',
                                        marginBottom: '1.5rem',
                                        border: '1px solid rgba(245, 158, 11, 0.2)'
                                    }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ICCID Escaneado</label>
                                        <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '1rem' }}>
                                            {scanResult.iccid}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            <p>• Verifica que el mes sea correcto</p>
                                            <p>• El ICCID puede ya estar registrado</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={closeScanResult}
                                        className="btn-primary"
                                        style={{ width: '100%' }}
                                    >
                                        Continuar Escaneando
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {editingRecord && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.85)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem'
                    }}>
                        <div className="glass-panel" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
                            <h3 style={{ marginBottom: '1.5rem' }}>Actualizar Registro</h3>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Número</label>
                                <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>{editingRecord.NUMERO}</div>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ICCID</label>
                                <div style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{editingRecord.ICCID || 'N/A'}</div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <button
                                    onClick={() => handleUpdateRegistroSIM(editingRecord.NUMERO, editingRecord.ICCID, true)}
                                    disabled={loading}
                                    className="btn-primary"
                                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                                >
                                    ✓ VERDADERO
                                </button>
                                <button
                                    onClick={() => handleUpdateRegistroSIM(editingRecord.NUMERO, editingRecord.ICCID, false)}
                                    disabled={loading}
                                    className="btn-primary"
                                    style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                                >
                                    ✗ FALSO
                                </button>
                            </div>

                            <button
                                onClick={() => setEditingRecord(null)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    background: 'transparent',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-muted)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* Result Message */}
                {result && (
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: '#34d399',
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '1.5rem'
                    }}>
                        <strong>Resultado:</strong> {result.updated} actualizados, {result.skipped} omitidos
                    </div>
                )}

                {/* Pending Records Table */}
                {selectedMonth && (
                    <>
                        <h3 style={{ marginBottom: '1rem' }}>
                            Registros Pendientes ({pendingSales.length})
                        </h3>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                Cargando...
                            </div>
                        ) : pendingSales.length > 0 ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--primary)' }}>NÚMERO</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--primary)' }}>ICCID</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--primary)' }}>ACCIÓN</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingSales.map((sale, index) => (
                                            <tr
                                                key={sale.NUMERO}
                                                style={{
                                                    borderBottom: '1px solid var(--glass-border)',
                                                    background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => setEditingRecord(sale)}
                                            >
                                                <td style={{ padding: '0.75rem', fontWeight: '600' }}>{sale.NUMERO}</td>
                                                <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                    {sale.ICCID || '-'}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingRecord(sale);
                                                        }}
                                                        style={{
                                                            padding: '0.5rem 1rem',
                                                            background: 'var(--primary)',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: 'var(--radius-md)',
                                                            cursor: 'pointer',
                                                            fontSize: '0.85rem'
                                                        }}
                                                    >
                                                        ✏️ Editar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                                <div>¡No hay registros pendientes!</div>
                                <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                    Todos los registros de este mes tienen REGISTRO_SIM completado
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
