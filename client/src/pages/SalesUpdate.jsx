import { useState, useEffect } from 'react';
import { addSales, getAllMonths } from '../services/SalesService';
import * as XLSX from 'xlsx';
import LoadingOverlay from '../components/LoadingOverlay';

export default function SalesUpdate() {
    const [month, setMonth] = useState("");
    const [isNewMonth, setIsNewMonth] = useState(false);
    const [newMonthName, setNewMonthName] = useState("");
    const [existingMonths, setExistingMonths] = useState([]);

    const [mode, setMode] = useState('single'); // 'single' or 'bulk'
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    // Single Entry State
    const [formData, setFormData] = useState({
        NUMERO: '',
        ICCID: ''
    });

    // Bulk Entry State
    const [bulkText, setBulkText] = useState("");

    // Cargar meses al inicio
    useEffect(() => {
        loadMonths();
    }, []);

    const loadMonths = async () => {
        try {
            const months = await getAllMonths();
            setExistingMonths(months);
        } catch (error) {
            console.error("Error loading months", error);
        }
    };

    const handleMonthSelection = (e) => {
        const val = e.target.value;
        if (val === '__new__') {
            setIsNewMonth(true);
            setMonth('');
        } else {
            setIsNewMonth(false);
            setMonth(val);
        }
    };

    const getTargetMonth = () => {
        if (isNewMonth) {
            return newMonthName.trim().replace(/\s+/g, '_'); // Sanitizar nombre
        }
        return month;
    };

    const handleSingleSubmit = async (e) => {
        e.preventDefault();
        const targetMonth = getTargetMonth();

        if (!targetMonth) {
            alert("Debe seleccionar o crear un mes válido.");
            return;
        }

        setLoading(true);
        setResult(null);
        try {
            // Backend will fill in all defaults (ESTADO_SIM="", REGISTRO_SIM=false, etc.)
            const res = await addSales(targetMonth, [{
                NUMERO: String(formData.NUMERO),
                ICCID: formData.ICCID ? String(formData.ICCID) : null
            }]);

            setResult(res);
            if (res.added > 0) {
                setFormData({ NUMERO: '', ICCID: '' });
                if (isNewMonth) loadMonths();
            }
        } catch (err) {
            alert("Error: " + err.message);
        }
        setLoading(false);
    };

    const handleBulkSubmit = async (e) => {
        e.preventDefault();
        const targetMonth = getTargetMonth();

        if (!targetMonth) {
            alert("Debe seleccionar o crear un mes válido.");
            return;
        }

        setLoading(true);
        setResult(null);
        try {
            // Process bulk text: one number per line
            const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l);
            const sales = lines.map(num => ({
                NUMERO: String(num),
                ICCID: null
            }));

            if (sales.length === 0) {
                alert("No numbers found.");
                setLoading(false);
                return;
            }

            const res = await addSales(targetMonth, sales);
            setResult(res);
            if (res.added > 0) {
                setBulkText("");
                if (isNewMonth) loadMonths();
            }
        } catch (err) {
            alert("Error: " + err.message);
        }
        setLoading(false);
    };

    return (
        <div className="container">
            {loading && <LoadingOverlay />}
            <div className="glass-panel" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
                <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                    Registrar Nuevas Ventas
                </h2>

                {/* Month Selector */}
                <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Mes de Operación</label>

                    {!isNewMonth ? (
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <select
                                value={month}
                                onChange={handleMonthSelection}
                                style={{ flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-md)' }}
                            >
                                <option value="">-- Seleccionar Mes Existente --</option>
                                {existingMonths.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                                <option value="__new__" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>+ Crear Nuevo Mes</option>
                            </select>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                                type="text"
                                value={newMonthName}
                                onChange={(e) => setNewMonthName(e.target.value)}
                                placeholder="Nombre del nuevo mes (Ej: Septiembre_2025)"
                                style={{ flex: 1 }}
                                autoFocus
                            />
                            <button
                                onClick={() => { setIsNewMonth(false); setMonth(""); }}
                                style={{ padding: '0.5rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                        </div>
                    )}
                    {isNewMonth && <p style={{ fontSize: '0.8rem', color: '#fbbf24', marginTop: '0.5rem' }}>⚠️ Se creará una nueva carpeta para este mes.</p>}
                </div>

                {/* Mode Toggles */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <button
                        className={`btn-primary`}
                        style={{ background: mode === 'single' ? '' : 'transparent', border: mode === 'single' ? '' : '1px solid var(--glass-border)' }}
                        onClick={() => setMode('single')}
                    >
                        Registro Individual
                    </button>
                    <button
                        className={`btn-primary`}
                        style={{ background: mode === 'bulk' ? '' : 'transparent', border: mode === 'bulk' ? '' : '1px solid var(--glass-border)' }}
                        onClick={() => setMode('bulk')}
                    >
                        Carga Masiva (Solo Números)
                    </button>
                </div>

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
                        <strong>Resultado:</strong> {result.added} agregados, {result.skipped} duplicados (omitidos).
                        {result.errors.length > 0 && <div style={{ color: '#f87171', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{result.errors.length} Errores: {result.errors.join('\n')}</div>}
                    </div>
                )}

                {/* Single Form */}
                {mode === 'single' ? (
                    <form onSubmit={handleSingleSubmit} style={{ display: 'grid', gap: '1rem' }}>
                        <div>
                            <label>Número (10 dígitos, empieza por 3) *</label>
                            <input
                                required
                                value={formData.NUMERO}
                                onChange={e => setFormData({ ...formData, NUMERO: e.target.value })}
                                placeholder="300xxxxxxx"
                            />
                        </div>
                        <div>
                            <label>ICCID (Opcional)</label>
                            <input
                                value={formData.ICCID}
                                onChange={e => setFormData({ ...formData, ICCID: e.target.value })}
                                placeholder="Ej: 8957..."
                            />
                        </div>
                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? 'Validando y Guardando...' : 'Guardar Venta'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleBulkSubmit}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Lista de Números</label>
                            <textarea
                                required
                                value={bulkText}
                                onChange={e => setBulkText(e.target.value)}
                                placeholder={`3001234567\n3009876543\n...`}
                                rows={10}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'monospace'
                                }}
                            />
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                * Solo se registrará el NUMERO. El resto de campos quedarán con valores por defecto (vacíos o false).
                            </p>
                        </div>
                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? 'Procesando...' : 'Cargar Lista Rápida'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
