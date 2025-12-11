import { useState, useEffect } from 'react';
import { updateGuides, getAllMonths } from '../services/SalesService';
import * as XLSX from 'xlsx';

export default function GuidesUpdate() {
    const [month, setMonth] = useState('');
    const [existingMonths, setExistingMonths] = useState([]);
    const [mode, setMode] = useState('single');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        getAllMonths().then(setExistingMonths).catch(console.error);
    }, []);

    const [formData, setFormData] = useState({
        NUMERO: '', GUIA: '', ESTADO_GUIA: '', TRANSPORTADORA: '', NOVEDAD: '',
        FECHA_HORA_REPORTE: '', DESCRIPCION_NOVEDAD: ''
    });

    const handleSingleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await updateGuides(month, [formData]);
            setResult(res);
            if (res.updated > 0) setFormData({ NUMERO: '', GUIA: '', ESTADO_GUIA: '', TRANSPORTADORA: '', NOVEDAD: '', FECHA_HORA_REPORTE: '', DESCRIPCION_NOVEDAD: '' });
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
                const updates = data.map(r => ({
                    NUMERO: String(r['NUMERO'] || r['Numero'] || '').trim(),
                    GUIA: r['GUIA'] || r['Guia'] || null,
                    ESTADO_GUIA: r['ESTADO GUIA'] || r['Estado Guia'] || r['ESTADO_GUIA'] || null,
                    TRANSPORTADORA: r['TRANSPORTADORA'] || r['Transportadora'] || null,
                    NOVEDAD: r['NOVEDAD'] || r['Novedad'] || null,
                    FECHA_HORA_REPORTE: r['FECHA Y HORA DEL REPORTE'] || r['FECHA_HORA_REPORTE'] || null,
                    DESCRIPCION_NOVEDAD: r['DESCRIPCIÓN DE LA NOVEDAD ACTUAL'] || r['DESCRIPCION_NOVEDAD'] || r['Descripcion Novedad'] || null
                })).filter(r => r.NUMERO);

                const res = await updateGuides(month, updates);
                setResult(res);
            } catch (err) { alert(err.message); }
            setLoading(false);
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="container">
            <div className="glass-panel" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
                <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>Actualizar Guías</h2>

                <select value={month} onChange={e => setMonth(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '1.5rem' }}>
                    <option value="">-- Mes --</option>
                    {existingMonths.map(m => <option key={m}>{m}</option>)}
                </select>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <button onClick={() => setMode('single')} className="btn-primary" style={{ opacity: mode === 'single' ? 1 : 0.5 }}>Individual</button>
                    <button onClick={() => setMode('excel')} className="btn-primary" style={{ opacity: mode === 'excel' ? 1 : 0.5 }}>Masiva</button>
                </div>

                {result && <div style={{ color: '#34d399', marginBottom: '1rem' }}>Actualizados: {result.updated}, Omitidos: {result.skipped}</div>}

                {mode === 'single' ? (
                    <form onSubmit={handleSingleSubmit} style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
                        <input required placeholder="Número" value={formData.NUMERO} onChange={e => setFormData({ ...formData, NUMERO: e.target.value })} style={{ gridColumn: 'span 2' }} />
                        <input placeholder="Guía" value={formData.GUIA} onChange={e => setFormData({ ...formData, GUIA: e.target.value })} />
                        <input placeholder="Estado Guía" value={formData.ESTADO_GUIA} onChange={e => setFormData({ ...formData, ESTADO_GUIA: e.target.value })} />
                        <input placeholder="Transportadora" value={formData.TRANSPORTADORA} onChange={e => setFormData({ ...formData, TRANSPORTADORA: e.target.value })} />
                        <input placeholder="Novedad" value={formData.NOVEDAD} onChange={e => setFormData({ ...formData, NOVEDAD: e.target.value })} />
                        <input placeholder="Fecha/Hora Reporte" value={formData.FECHA_HORA_REPORTE} onChange={e => setFormData({ ...formData, FECHA_HORA_REPORTE: e.target.value })} />
                        <input placeholder="Desc. Novedad" value={formData.DESCRIPCION_NOVEDAD} onChange={e => setFormData({ ...formData, DESCRIPCION_NOVEDAD: e.target.value })} />
                        <button type="submit" disabled={!month || loading} className="btn-primary" style={{ gridColumn: 'span 2' }}>Guardar</button>
                    </form>
                ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed var(--glass-border)' }}>
                        <ul style={{ listStyle: 'none', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
                            <li><code>NUMERO</code> (Requerido)</li>
                            <li><code>GUIA</code>, <code>ESTADO GUIA</code>, <code>TRANSPORTADORA</code></li>
                            <li><code>NOVEDAD</code>, <code>FECHA Y HORA DEL REPORTE</code></li>
                            <li><code>DESCRIPCIÓN DE LA NOVEDAD ACTUAL</code></li>
                        </ul>
                        <input type="file" accept=".xlsx" onChange={handleFileUpload} />
                    </div>
                )}
            </div>
        </div>
    );
}
