import { useState, useEffect } from 'react';
import { updateIncome, getAllMonths, getSalesByMonth } from '../services/SalesService';
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
    const [mode, setMode] = useState('single'); // 'single', 'excel', 'scan'
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [salesForLookup, setSalesForLookup] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    // Cargar meses al montar
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

    // Cargar datos para lookup cuando cambia el mes
    useEffect(() => {
        if (month) {
            setLoading(true);
            getSalesByMonth(month).then(data => {
                setSalesForLookup(data);
                setLoading(false);
            }).catch(err => {
                console.error("Error cargando ventas para lookup:", err);
                setLoading(false);
            });
        } else {
            setSalesForLookup([]);
        }
    }, [month]);

    // Single Entry State
    const [formData, setFormData] = useState({
        NUMERO: '',
        REGISTRO_SIM: '',
        FECHA_INGRESO: '',
        ICCID: ''
    });

    // State for scan result modal
    const [scanResult, setScanResult] = useState(null); // { found: bool, data: object, iccid: string }

    const handleScanMatch = (scannedIccid) => {
        if (!scannedIccid) return;

        const cleanIccid = String(scannedIccid).trim();
        console.log("Scanned ICCID:", cleanIccid);

        // Stop scanning immediately on detection to prevent duplicate alerts
        setIsScanning(false);

        const found = salesForLookup.find(s => {
            if (!s.ICCID) return false;
            const dbIccid = String(s.ICCID).trim();
            // Check for match
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
            if (res.updated > 0) {
                // Actualizar cache local
                getSalesByMonth(month).then(setSalesForLookup);
                // Close modal and show success
                setScanResult(null);
                // Optionally resume scanning after success
                setTimeout(() => setIsScanning(true), 1500);
            }
        } catch (err) {
            alert("Error: " + err.message);
        }
        setLoading(false);
    };

    const closeScanResult = () => {
        setScanResult(null);
        setIsScanning(true); // Resume scanning
    };

    const handleSingleSubmit = async (e) => {
        e.preventDefault();
        if (!month) {
            alert("Por favor seleccione un mes de operación.");
            return;
        }
        setLoading(true);
        setResult(null);
        try {
            const payload = {
                ...formData,
                REGISTRO_SIM: formData.REGISTRO_SIM === 'true' || formData.REGISTRO_SIM === true
            };

            const res = await updateIncome(month, [payload]);
            setResult(res);
            if (res.updated > 0) {
                // Limpiar form
                setFormData({ NUMERO: '', REGISTRO_SIM: '', FECHA_INGRESO: '', ICCID: '' });
                // Actualizar cache local
                getSalesByMonth(month).then(setSalesForLookup);
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
            e.target.value = null; // Reset input
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
                    const registro = row['REGISTRO SIM'] || row['Registro Sim'] || row['REGISTRO_SIM'];
                    const fecha = row['FECHA INGRESO'] || row['Fecha Ingreso'] || row['FECHA_INGRESO'];
                    const iccid = row['ICCID'] || row['Iccid'] || row['ICID'] || row['icid'];

                    return {
                        NUMERO: String(numero || '').trim(),
                        REGISTRO_SIM: registro ? String(registro).trim() : null,
                        FECHA_INGRESO: fecha ? String(fecha).trim() : null,
                        ICCID: iccid ? String(iccid).trim() : null
                    };
                }).filter(item => item.NUMERO);

                if (updates.length === 0) {
                    alert("No se encontraron datos válidos en el archivo. Asegúrese de tener la columna NUMERO.");
                    setLoading(false);
                    return;
                }

                const res = await updateIncome(month, updates);
                setResult(res);
                getSalesByMonth(month).then(setSalesForLookup);
            } catch (err) {
                console.error(err);
                alert("Error procesando el archivo: " + err.message);
            }
            setLoading(false);
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="container">
            <div className="glass-panel" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
                <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                    Actualizar Ingresos
                </h2>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Mes de Operación</label>
                    <select
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}
                    >
                        <option value="">-- Seleccionar Mes --</option>
                        {existingMonths.length === 0 && <option disabled>No hay meses registrados</option>}
                        {existingMonths.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                    <button
                        className={`btn-primary`}
                        style={{ background: mode === 'single' ? '' : 'transparent', border: mode === 'single' ? '' : '1px solid var(--glass-border)' }}
                        onClick={() => { setMode('single'); setIsScanning(false); }}
                    >
                        Registro Individual
                    </button>
                    <button
                        className={`btn-primary`}
                        style={{ background: mode === 'excel' ? '' : 'transparent', border: mode === 'excel' ? '' : '1px solid var(--glass-border)' }}
                        onClick={() => { setMode('excel'); setIsScanning(false); }}
                    >
                        Carga Masiva (Excel)
                    </button>
                    <button
                        className="btn-primary"
                        style={{ background: isScanning ? 'var(--accent)' : 'transparent', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        onClick={() => {
                            if (!month) return alert("Selecciona un mes primero");
                            setIsScanning(!isScanning);
                            setMode('scan');
                        }}
                    >
                        📷 Escanear Cámara
                    </button>
                </div>

                {isScanning && (
                    <Scanner
                        onScan={handleScanMatch}
                        onClose={() => setIsScanning(false)}
                    />
                )}

                {/* Scan Result Modal */}
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
                                    {/* Success State */}
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
                                        }}>
                                            ✓
                                        </div>
                                        <h2 style={{ color: '#10b981', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
                                            ¡ICCID Encontrado!
                                        </h2>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                            Se encontró un registro coincidente
                                        </p>
                                    </div>

                                    {/* Data Display */}
                                    <div style={{
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '1.5rem',
                                        marginBottom: '1.5rem',
                                        border: '1px solid rgba(16, 185, 129, 0.2)'
                                    }}>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Número de Teléfono
                                            </label>
                                            <div style={{
                                                fontSize: '1.5rem',
                                                fontWeight: '700',
                                                color: 'var(--primary)',
                                                fontFamily: 'monospace'
                                            }}>
                                                {scanResult.data.NUMERO}
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                ICCID Escaneado
                                            </label>
                                            <div style={{
                                                fontSize: '0.95rem',
                                                color: 'var(--text-main)',
                                                fontFamily: 'monospace',
                                                wordBreak: 'break-all'
                                            }}>
                                                {scanResult.data.ICCID}
                                            </div>
                                        </div>
                                        {scanResult.data.REGISTRO_SIM !== null && (
                                            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                                    Estado Actual
                                                </label>
                                                <div style={{
                                                    fontSize: '0.9rem',
                                                    color: scanResult.data.REGISTRO_SIM ? '#10b981' : '#f59e0b',
                                                    fontWeight: '600'
                                                }}>
                                                    {scanResult.data.REGISTRO_SIM ? '✓ Registrado' : '⚠ No Registrado'}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{
                                        borderTop: '1px solid var(--glass-border)',
                                        paddingTop: '1.5rem',
                                        marginBottom: '1rem'
                                    }}>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center' }}>
                                            Actualizar estado de REGISTRO SIM:
                                        </p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <button
                                                onClick={() => handleMarkRegistroSIM(true)}
                                                disabled={loading}
                                                style={{
                                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '1rem',
                                                    borderRadius: 'var(--radius-md)',
                                                    fontWeight: '700',
                                                    fontSize: '1rem',
                                                    cursor: loading ? 'not-allowed' : 'pointer',
                                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                                    opacity: loading ? 0.6 : 1,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}
                                                onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-2px)')}
                                                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                                            >
                                                <span style={{ fontSize: '1.5rem' }}>✓</span>
                                                <span>VERDADERO</span>
                                            </button>
                                            <button
                                                onClick={() => handleMarkRegistroSIM(false)}
                                                disabled={loading}
                                                style={{
                                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '1rem',
                                                    borderRadius: 'var(--radius-md)',
                                                    fontWeight: '700',
                                                    fontSize: '1rem',
                                                    cursor: loading ? 'not-allowed' : 'pointer',
                                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                                    opacity: loading ? 0.6 : 1,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}
                                                onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-2px)')}
                                                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                                            >
                                                <span style={{ fontSize: '1.5rem' }}>✗</span>
                                                <span>FALSO</span>
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
                                            fontWeight: '500',
                                            cursor: loading ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s',
                                            opacity: loading ? 0.4 : 1
                                        }}
                                        onMouseEnter={(e) => !loading && (e.target.style.borderColor = 'var(--primary)')}
                                        onMouseLeave={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                                    >
                                        {loading ? 'Procesando...' : 'Cancelar y Seguir Escaneando'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* Error/Not Found State */}
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
                                            fontSize: '3rem',
                                            animation: 'scaleIn 0.4s ease-out'
                                        }}>
                                            ⚠
                                        </div>
                                        <h2 style={{ color: '#f59e0b', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
                                            ICCID No Encontrado
                                        </h2>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                            No se encontró ningún registro en el mes seleccionado
                                        </p>
                                    </div>

                                    <div style={{
                                        background: 'rgba(245, 158, 11, 0.1)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '1.5rem',
                                        marginBottom: '1.5rem',
                                        border: '1px solid rgba(245, 158, 11, 0.2)'
                                    }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            ICCID Escaneado
                                        </label>
                                        <div style={{
                                            fontSize: '1rem',
                                            color: 'var(--text-main)',
                                            fontFamily: 'monospace',
                                            wordBreak: 'break-all',
                                            marginBottom: '1rem'
                                        }}>
                                            {scanResult.iccid}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                            <p style={{ marginBottom: '0.5rem' }}>• Verifica que el mes seleccionado sea correcto</p>
                                            <p style={{ marginBottom: '0.5rem' }}>• Asegúrate de que el ICCID esté en la base de datos</p>
                                            <p>• El código puede no estar registrado aún</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={closeScanResult}
                                        style={{
                                            width: '100%',
                                            background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                                            color: 'white',
                                            border: 'none',
                                            padding: '1rem',
                                            borderRadius: 'var(--radius-md)',
                                            fontWeight: '600',
                                            fontSize: '1rem',
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                                        onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                                    >
                                        Continuar Escaneando
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}


                {result && (
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: '#34d399',
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '1.5rem'
                    }}>
                        <strong>Resultado:</strong> {result.updated} actualizados/creados, {result.skipped} omitidos.
                        {result.errors.length > 0 && <div style={{ color: '#f87171', marginTop: '0.5rem' }}>Errores: {result.errors.length}</div>}
                    </div>
                )}

                {(mode === 'single' || mode === 'scan') && !isScanning && (
                    <form onSubmit={handleSingleSubmit} style={{ display: 'grid', gap: '1rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px' }}>
                            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--primary)' }}>Datos de la Venta</h3>
                            <div>
                                <label>Número *</label>
                                <input
                                    required
                                    value={formData.NUMERO}
                                    onChange={e => setFormData({ ...formData, NUMERO: e.target.value })}
                                    placeholder="Ej: 3001234567"
                                />
                            </div>
                            <div style={{ marginTop: '1rem' }}>
                                <label>ICCID (Opcional)</label>
                                <input
                                    value={formData.ICCID}
                                    onChange={e => setFormData({ ...formData, ICCID: e.target.value })}
                                    placeholder="Ej: 8957..."
                                />
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                            <label style={{ color: 'var(--accent)', fontWeight: 'bold' }}>Registro SIM *</label>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                Confirme si el registro físico llegó correctamente.
                            </p>
                            <select
                                value={formData.REGISTRO_SIM}
                                onChange={e => setFormData({ ...formData, REGISTRO_SIM: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', fontWeight: 'bold' }}
                            >
                                <option value="">(Seleccionar)</option>
                                <option value="true">VERDADERO (Sí)</option>
                                <option value="false">FALSO (No)</option>
                            </select>
                        </div>

                        <div>
                            <label>Fecha Ingreso (Opcional)</label>
                            <input
                                type="date"
                                value={formData.FECHA_INGRESO}
                                onChange={e => setFormData({ ...formData, FECHA_INGRESO: e.target.value })}
                            />
                        </div>
                        <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '1rem' }}>
                            {loading ? 'Guardando...' : 'Actualizar Ingreso'}
                        </button>
                    </form>
                )}

                {mode === 'excel' && (
                    <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                        <p style={{ marginBottom: '1rem' }}>Sube un archivo Excel con: <code>NUMERO</code>, <code>REGISTRO SIM</code>, <code>FECHA INGRESO</code>, <code>ICCID</code></p>
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileUpload}
                            disabled={loading}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
