import { useState, useEffect } from 'react';
import { updateIncome, getAllMonths } from '../services/SalesService';
import * as XLSX from 'xlsx';

export default function IncomeUpdate() {
    const [month, setMonth] = useState('');
    const [existingMonths, setExistingMonths] = useState([]);
    const [mode, setMode] = useState('single'); // 'single' or 'excel'
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

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

    // Single Entry State
    const [formData, setFormData] = useState({
        NUMERO: '',
        REGISTRO_SIM: '',
        FECHA_INGRESO: ''
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
            const res = await updateIncome(month, [formData]);
            setResult(res);
            if (res.updated > 0) {
                setFormData({ NUMERO: '', REGISTRO_SIM: '', FECHA_INGRESO: '' });
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

                // Mapear columnas del Excel a nuestras variables y limpiar vacíos
                const updates = data.map(row => {
                    // Intentar encontrar columnas por nombres probables
                    const numero = row['NUMERO'] || row['Numero'] || row['numero'];
                    const registro = row['REGISTRO SIM'] || row['Registro Sim'] || row['REGISTRO_SIM'];
                    const fecha = row['FECHA INGRESO'] || row['Fecha Ingreso'] || row['FECHA_INGRESO'];

                    return {
                        NUMERO: String(numero || '').trim(),
                        REGISTRO_SIM: registro ? String(registro).trim() : null,
                        FECHA_INGRESO: fecha ? String(fecha).trim() : null
                    };
                }).filter(item => item.NUMERO); // Filtrar filas sin número

                if (updates.length === 0) {
                    alert("No se encontraron datos válidos en el archivo. Asegúrese de tener la columna NUMERO.");
                    setLoading(false);
                    return;
                }

                const res = await updateIncome(month, updates);
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
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        * Si el mes no aparece, debe crearlo primero en "Actualizar Ventas".
                    </p>
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
                        <strong>Resultado:</strong> {result.updated} actualizados/creados, {result.skipped} omitidos (sin datos nuevos).
                        {result.errors.length > 0 && <div style={{ color: '#f87171', marginTop: '0.5rem' }}>Errores: {result.errors.length} (ver consola)</div>}
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
                            <label>Registro SIM (Opcional)</label>
                            <input
                                value={formData.REGISTRO_SIM}
                                onChange={e => setFormData({ ...formData, REGISTRO_SIM: e.target.value })}
                            />
                        </div>
                        <div>
                            <label>Fecha Ingreso (Opcional)</label>
                            <input
                                type="date"
                                value={formData.FECHA_INGRESO}
                                onChange={e => setFormData({ ...formData, FECHA_INGRESO: e.target.value })}
                            />
                        </div>
                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? 'Guardando...' : 'Actualizar Ingreso'}
                        </button>
                    </form>
                ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                        <p style={{ marginBottom: '1rem' }}>Sube un archivo Excel (.xlsx) con las columnas:</p>
                        <ul style={{ listStyle: 'none', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
                            <li><code>NUMERO</code> (Requerido)</li>
                            <li><code>REGISTRO SIM</code> (Opcional)</li>
                            <li><code>FECHA INGRESO</code> (Opcional)</li>
                        </ul>
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileUpload}
                            disabled={loading}
                            style={{ margin: '0 auto' }}
                        />
                        {loading && <p style={{ marginTop: '1rem' }}>Procesando archivo...</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
