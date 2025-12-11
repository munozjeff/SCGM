import { useState, useEffect } from 'react';
import { updateSimStatus, getAllMonths } from '../services/SalesService';
import * as XLSX from 'xlsx';

export default function SimStatusUpdate() {
    const [month, setMonth] = useState('');
    const [existingMonths, setExistingMonths] = useState([]);
    const [mode, setMode] = useState('single');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

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

    const [formData, setFormData] = useState({
        NUMERO: '',
        ESTADO_SIM: '',
        ICCID: ''
    });

    const handleSingleSubmit = async (e) => {
        e.preventDefault();
        if (!month) {
            alert("Por favor seleccione un mes de operación.");
            return;
        }

        setLoading(true);
        setResult(null);
        try {
            const res = await updateSimStatus(month, [formData]);
            setResult(res);
            if (res.updated > 0) {
                setFormData({ NUMERO: '', ESTADO_SIM: '', ICCID: '' });
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
                    const estado = row['ESTADO SIM'] || row['Estado Sim'] || row['ESTADO_SIM'] || row['estado sim'];
                    const iccid = row['ICCID'] || row['Iccid'] || row['iccid'];

                    return {
                        NUMERO: String(numero || '').trim(),
                        ESTADO_SIM: estado ? String(estado).trim() : null,
                        ICCID: iccid ? String(iccid).trim() : null
                    };
                }).filter(item => item.NUMERO);

                if (updates.length === 0) {
                    alert("No se encontraron datos válidos. Asegúrese de tener la columna NUMERO.");
                    setLoading(false);
                    return;
                }

                const res = await updateSimStatus(month, updates);
                setResult(res);
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
                    Actualizar Estado SIM
                </h2>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Mes de Operación</label>
                    <select
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}
                    >
                        <option value="">-- Seleccionar Mes --</option>
                        {existingMonths.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

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
                        style={{ background: mode === 'excel' ? '' : 'transparent', border: mode === 'excel' ? '' : '1px solid var(--glass-border)' }}
                        onClick={() => setMode('excel')}
                    >
                        Carga Masiva (Excel)
                    </button>
                </div>

                {result && (
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: '#34d399',
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '1.5rem'
                    }}>
                        <strong>Resultado:</strong> {result.updated} registros actualizados, {result.skipped} omitidos (sin nuevos datos).
                        {result.errors.length > 0 && <div style={{ color: '#f87171', marginTop: '0.5rem' }}>Errores: {result.errors.length}</div>}
                    </div>
                )}

                {mode === 'single' ? (
                    <form onSubmit={handleSingleSubmit} style={{ display: 'grid', gap: '1rem' }}>
                        <div>
                            <label>Número *</label>
                            <input
                                required
                                value={formData.NUMERO}
                                onChange={e => setFormData({ ...formData, NUMERO: e.target.value })}
                                placeholder="Ej: 3001234567"
                            />
                        </div>
                        <div>
                            <label>Estado SIM</label>
                            <input
                                value={formData.ESTADO_SIM}
                                onChange={e => setFormData({ ...formData, ESTADO_SIM: e.target.value })}
                                placeholder="Ej: ACTIVA, SUSPENDIDA..."
                            />
                        </div>
                        <div>
                            <label>ICCID</label>
                            <input
                                value={formData.ICCID}
                                onChange={e => setFormData({ ...formData, ICCID: e.target.value })}
                                placeholder="Ej: 8957..."
                            />
                        </div>
                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? 'Guardando...' : 'Actualizar Estado'}
                        </button>
                    </form>
                ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                        <p style={{ marginBottom: '1rem' }}>Sube un archivo Excel (.xlsx) con las columnas:</p>
                        <ul style={{ listStyle: 'none', marginBottom: '1.5rem', color: 'var(--text-muted)', textAlign: 'left', display: 'inline-block' }}>
                            <li><code>NUMERO</code> (Requerido)</li>
                            <li><code>ESTADO SIM</code> (Opcional)</li>
                            <li><code>ICCID</code> (Opcional)</li>
                        </ul>
                        <br />
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileUpload}
                            disabled={loading}
                            style={{ margin: '0 auto' }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
