import { useState, useEffect } from 'react';
import { updateManagementStatus, getAllMonths } from '../services/SalesService';
import * as XLSX from 'xlsx';

export default function ManagementStatusUpdate() {
    const [month, setMonth] = useState('');
    const [existingMonths, setExistingMonths] = useState([]);
    const [mode, setMode] = useState('single');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        getAllMonths().then(setExistingMonths).catch(console.error);
    }, []);

    const [formData, setFormData] = useState({ NUMERO: '', NOVEDAD_EN_GESTION: '' });

    const handleSingleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await updateManagementStatus(month, [formData]);
            setResult(res);
            if (res.updated > 0) setFormData({ NUMERO: '', NOVEDAD_EN_GESTION: '' });
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
                    NOVEDAD_EN_GESTION: String(r['NOVEDAD'] || r['Novedad'] || r['NOVEDAD_EN_GESTION'] || '').trim() || null
                })).filter(r => r.NUMERO);

                const res = await updateManagementStatus(month, updates);
                setResult(res);
            } catch (err) { alert(err.message); }
            setLoading(false);
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="container">
            <div className="glass-panel" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
                <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>Actualizar Novedad Gestión</h2>

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
                    <form onSubmit={handleSingleSubmit} style={{ display: 'grid', gap: '1rem' }}>
                        <input required placeholder="Número" value={formData.NUMERO} onChange={e => setFormData({ ...formData, NUMERO: e.target.value })} />
                        <select
                            value={formData.NOVEDAD_EN_GESTION}
                            onChange={e => setFormData({ ...formData, NOVEDAD_EN_GESTION: e.target.value })}
                            style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)' }}
                        >
                            <option value="">(Seleccionar Novedad)</option>
                            <option value="RECHAZADO">RECHAZADO</option>
                            <option value="CE">CE</option>
                            <option value="EN ESPERA">EN ESPERA</option>
                        </select>
                        <button type="submit" disabled={!month || loading} className="btn-primary">Guardar</button>
                    </form>
                ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed var(--glass-border)' }}>
                        <ul style={{ listStyle: 'none', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
                            <li><code>NUMERO</code> (Requerido)</li>
                            <li><code>NOVEDAD</code> (Opcional)</li>
                        </ul>
                        <input type="file" accept=".xlsx" onChange={handleFileUpload} />
                    </div>
                )}
            </div>
        </div>
    );
}
