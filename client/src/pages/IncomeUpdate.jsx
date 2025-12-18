import { useState, useEffect } from 'react';
import { updateIncome, getAllMonths, listenToSalesByMonth } from '../services/SalesService';
import { updateUserActivity } from '../services/UserService';
import { logUserAction } from '../services/UserActivityService';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import LoadingOverlay from '../components/LoadingOverlay';
import { downloadTemplate } from '../utils/ExcelUtils';
import { useZxing } from "react-zxing";
import MultiSelectFilter, { EMPTY_VALUE } from '../components/MultiSelectFilter';

import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import Tesseract from 'tesseract.js';

// Internal Scanner Component
const Scanner = ({ onScan, onClose, initialMode = 'barcode' }) => {
    const [mode, setMode] = useState(initialMode); // 'barcode' | 'ocr'
    const [ocrStatus, setOcrStatus] = useState('');
    const [processing, setProcessing] = useState(false);

    // Barcode Scanner Hook
    const { ref } = useZxing({
        // Do NOT pause, otherwise the stream stops and the screen goes black
        // We will just ignore the result in onResult if mode !== 'barcode'
        onResult(result) {
            if (mode === 'barcode') onScan(result.getText());
        },
        options: {
            hints: new Map([
                [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE, BarcodeFormat.EAN_13]]
            ])
        },
        constraints: {
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                focusMode: 'continuous'
            }
        }
    });

    const [worker, setWorker] = useState(null);

    // Initialize Tesseract Worker
    useEffect(() => {
        let active = true;
        const initWorker = async () => {
            try {
                const w = await Tesseract.createWorker('eng');
                await w.setParameters({
                    tessedit_char_whitelist: '0123456789',
                });
                if (active) setWorker(w);
                else w.terminate();
            } catch (err) {
                console.error("Worker Init Error", err);
            }
        };

        if (mode === 'ocr' && !worker) {
            initWorker();
        }

        return () => {
            active = false;
        };
    }, [mode]);

    // Cleanup worker on unmount or mode change (optional, but good for memory)
    // We'll keep it simple: if we switch away from OCR, we can keep it for a bit or terminate.
    // Let's terminate to save memory when not using OCR.
    useEffect(() => {
        if (mode !== 'ocr' && worker) {
            worker.terminate();
            setWorker(null);
        }
    }, [mode, worker]);

    // OCR Loop
    useEffect(() => {
        let interval;
        if (mode === 'ocr' && ref.current && worker) {
            interval = setInterval(async () => {
                if (processing) return;

                const video = ref.current;
                if (!video || !video.videoWidth) return;

                setProcessing(true);
                setOcrStatus('Analizando...');

                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    const { data: { text } } = await worker.recognize(canvas);

                    // Look for ICCID pattern (18-22 digits)
                    const match = text.match(/\b\d{18,22}\b/);

                    if (match) {
                        setOcrStatus('¡Encontrado!');
                        onScan(match[0]);
                    } else {
                        setOcrStatus('Buscando números...');
                    }

                } catch (err) {
                    console.error("OCR Error:", err);
                    setOcrStatus('Error');
                } finally {
                    setProcessing(false);
                }

            }, 1000); // Check every 1s is responsive enough if worker is ready
        }
        return () => clearInterval(interval);
    }, [mode, ref, processing, onScan, worker]);

    const [zoom, setZoom] = useState(1);
    const [maxZoom, setMaxZoom] = useState(1);
    const [hasZoom, setHasZoom] = useState(false);
    const [showControls, setShowControls] = useState(false);

    // Initial stream setup to detect capabilities
    useEffect(() => {
        const video = ref.current;
        if (!video) return;

        const handleStream = () => {
            if (!video.srcObject) return;
            const track = video.srcObject.getVideoTracks()[0];
            if (!track) return;

            const capabilities = track.getCapabilities();
            if (capabilities.zoom) {
                setHasZoom(true);
                setMaxZoom(capabilities.zoom.max);
                setZoom(capabilities.zoom.min || 1);
                setShowControls(true);
            }
        };

        video.addEventListener('loadedmetadata', handleStream);
        return () => video.removeEventListener('loadedmetadata', handleStream);
    }, [ref]);

    const handleZoomChange = async (e) => {
        const newZoom = Number(e.target.value);
        setZoom(newZoom);

        const video = ref.current;
        if (video && video.srcObject) {
            const track = video.srcObject.getVideoTracks()[0];
            if (track) {
                try {
                    await track.applyConstraints({ advanced: [{ zoom: newZoom }] });
                } catch (err) {
                    console.error("Zoom failed", err);
                }
            }
        }
    };

    return (
        <div style={{ marginBottom: '2rem', background: '#000', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
            <video ref={ref} style={{ width: '100%', display: 'block', filter: 'contrast(1.2) brightness(1.1)' }} />

            {/* Visual Guide Overlay */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: '80%', height: '150px',
                border: '2px solid rgba(255, 0, 0, 0.7)',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                zIndex: 5,
                pointerEvents: 'none',
                borderRadius: '8px'
            }}>
                <div style={{ position: 'absolute', top: '-25px', left: 0, width: '100%', textAlign: 'center', color: '#fff', fontSize: '0.9rem', fontWeight: 'bold', textShadow: '1px 1px 2px black' }}>
                    {mode === 'barcode' ? 'Centra el código aquí' : 'Centra el número ICCID aquí'}
                </div>
            </div>

            <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '10px', zIndex: 10 }}>
                <button
                    onClick={() => setMode('barcode')}
                    style={{
                        background: mode === 'barcode' ? '#10b981' : 'rgba(0,0,0,0.5)',
                        color: 'white', border: '1px solid white', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.8rem'
                    }}>
                    Barcode
                </button>
                <button
                    onClick={() => setMode('ocr')}
                    style={{
                        background: mode === 'ocr' ? '#10b981' : 'rgba(0,0,0,0.5)',
                        color: 'white', border: '1px solid white', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.8rem'
                    }}>
                    OCR (Texto)
                </button>
            </div>

            {mode === 'ocr' && (
                <div style={{ position: 'absolute', top: '60px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', padding: '5px 10px', borderRadius: '4px', color: '#fbbf24', fontSize: '0.9rem', zIndex: 10 }}>
                    {ocrStatus}
                </div>
            )}

            {hasZoom && (
                <div style={{ position: 'absolute', bottom: '50px', left: '10%', width: '80%', zIndex: 20 }}>
                    <label style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '20px' }}>
                        <span>🔍 1x</span>
                        <input
                            type="range"
                            min="1"
                            max={maxZoom}
                            step="0.1"
                            value={zoom}
                            onChange={handleZoomChange}
                            style={{ flex: 1 }}
                        />
                        <span>{Math.round(maxZoom)}x</span>
                    </label>
                </div>
            )}

            <button
                onClick={onClose}
                style={{ position: 'absolute', top: '10px', right: '10px', background: 'red', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '4px', zIndex: 10 }}
            >
                Cerrar
            </button>
            <p style={{ color: 'white', textAlign: 'center', padding: '0.5rem', position: 'absolute', bottom: 0, width: '100%', background: 'rgba(0,0,0,0.5)' }}>
                {mode === 'barcode' ? 'Apuntando a Código de Barras' : 'Apuntando a Número ICCID (Texto)'}
            </p>
        </div>
    );
};

export default function IncomeUpdate() {
    const { currentUser } = useAuth();
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
    const selectFields = ['REGISTRO_SIM', 'FECHA_INGRESO'];

    const [filters, setFilters] = useState({
        NUMERO: '',
        REGISTRO_SIM: [],
        FECHA_INGRESO: [],
        ICCID: ''
    });
    const [uniqueValues, setUniqueValues] = useState({});
    const [hasEmptyValues, setHasEmptyValues] = useState({});

    // Modes & Modals
    const [isScanning, setIsScanning] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [isNewRecord, setIsNewRecord] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

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
                // Sort by FECHA_INGRESO (oldest first)
                const sortedData = [...data].sort((a, b) => {
                    const dateA = a.FECHA_INGRESO ? new Date(a.FECHA_INGRESO + 'T00:00:00') : new Date(0);
                    const dateB = b.FECHA_INGRESO ? new Date(b.FECHA_INGRESO + 'T00:00:00') : new Date(0);
                    return dateA - dateB; // Ascending order (oldest first)
                });

                setSales(sortedData);
                setFilteredSales(sortedData);
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
            const hasEmpty = {};
            selectFields.forEach(field => {
                const allValues = sales.map(s => s[field]);
                hasEmpty[field] = allValues.some(v => v == null || v === '');

                const values = [...new Set(allValues.map(v => {
                    if (v === true) return 'true';
                    if (v === false) return 'false';
                    return v;
                }).filter(v => v !== null && v !== undefined && v !== ''))];
                unique[field] = values.sort();
            });
            setUniqueValues(unique);
            setHasEmptyValues(hasEmpty);
        }
    }, [sales]);

    // Apply filters
    useEffect(() => {
        let filtered = sales;
        columns.forEach(col => {
            const filterVal = filters[col];
            if (!filterVal || (Array.isArray(filterVal) && filterVal.length === 0)) return;

            filtered = filtered.filter(item => {
                let val = item[col];
                if (val === true) val = 'true';
                else if (val === false) val = 'false';
                else val = val ? String(val) : '';

                // Multi-select filter (array)
                if (Array.isArray(filterVal)) {
                    if (filterVal.includes(EMPTY_VALUE)) {
                        const checkEmpty = val === '' || val == null;
                        const otherValues = filterVal.filter(v => v !== EMPTY_VALUE);
                        const checkOthers = otherValues.length > 0 ? otherValues.includes(item[col]) : false;
                        return checkEmpty || checkOthers;
                    }
                    return filterVal.includes(item[col]);
                }
                // Text filter
                return val.toLowerCase().includes(filterVal.toLowerCase());
            });
        });
        setFilteredSales(filtered);
    }, [filters, sales]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setCurrentPage(1);
    };

    const handleMultiSelectChange = (field, values) => {
        setFilters(prev => ({ ...prev, [field]: values }));
        setCurrentPage(1);
    };

    const clearFilters = () => setFilters({ NUMERO: '', REGISTRO_SIM: [], FECHA_INGRESO: [], ICCID: '' });

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
            if (currentUser) {
                updateUserActivity(currentUser.uid);
                logUserAction(currentUser.uid, currentUser.email, 'UPDATE_INCOME', `Marcó registro como ${value ? 'VERDADERO' : 'FALSO'} (Escaneo)`, { month, ...res });
            }
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
            if (currentUser) {
                updateUserActivity(currentUser.uid);
                const actionDetails = isNewRecord
                    ? `Creó nuevo registro: ${finalForm.NUMERO}`
                    : `Actualizó registro: ${finalForm.NUMERO}`;
                logUserAction(currentUser.uid, currentUser.email, 'UPDATE_INCOME', actionDetails, { month, ...res });
            }
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

                    const obj = { NUMERO: String(numero || '').trim() };
                    if (registro !== undefined && registro !== null && String(registro).trim() !== '') obj.REGISTRO_SIM = String(registro).trim();
                    if (fecha !== undefined && fecha !== null && String(fecha).trim() !== '') obj.FECHA_INGRESO = String(fecha).trim();
                    if (iccid !== undefined && iccid !== null && String(iccid).trim() !== '') obj.ICCID = String(iccid).trim();

                    return obj;
                }).filter(r => r.NUMERO);

                const res = await updateIncome(month, updates);
                setResult(res);
                if (currentUser) {
                    updateUserActivity(currentUser.uid);
                    logUserAction(currentUser.uid, currentUser.email, 'IMPORT_INCOME', `Importó ${updates.length} registros`, { month, ...res });
                }
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
        <div className="container" style={{ padding: '0.5rem', maxWidth: '100%', height: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column' }}>
            {loading && <LoadingOverlay />}
            <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header Compacto */}
                <div style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h2 style={{ fontSize: '0.85rem', margin: 0, fontWeight: '600', whiteSpace: 'nowrap' }}>Ingresos</h2>
                        <select
                            value={month}
                            onChange={e => setMonth(e.target.value)}
                            style={{ padding: '0.25rem 0.4rem', fontSize: '0.75rem', minWidth: '110px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', borderRadius: '4px' }}
                        >
                            <option value="">Mes...</option>
                            {existingMonths.map(m => <option key={m}>{m}</option>)}
                        </select>

                        <button onClick={() => { if (!month) return alert("Selecciona Mes"); setIsScanning(!isScanning); }} disabled={!month} className="btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--accent)', whiteSpace: 'nowrap' }}>
                            📷 {isScanning ? 'Cerrar' : 'Escanear'}
                        </button>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-secondary" onClick={() => downloadTemplate(['NUMERO', 'REGISTRO_SIM', 'FECHA_INGRESO', 'ICCID'], 'Plantilla_Ingresos')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>📥 Plantilla</button>
                            <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block', flexShrink: 0 }}>
                                <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }} disabled={!month}>📤 Importar</button>
                                <input type="file" accept=".xlsx" onChange={handleFileUpload} disabled={!month} style={{ position: 'absolute', left: 0, top: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <button onClick={() => setShowFilters(!showFilters)} style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', color: showFilters ? '#10b981' : '#60a5fa', background: 'transparent', border: 'none', cursor: 'pointer' }} title={showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}>
                            {showFilters ? 'Ocultar' : '🔍 Filtros'}
                        </button>
                        <button onClick={clearFilters} style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer' }}>Limpiar</button>
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
                    <div style={{ padding: '0.3rem 0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', fontSize: '0.75rem' }}>
                        Última operación: {result.updated} actualizados, {result.skipped} omitidos.
                    </div>
                )}

                {/* Tabla */}
                <div className="table-container" style={{ flex: 1, overflow: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--card-bg)' }}>
                            <tr>
                                {columns.map(col => (
                                    <th key={col} style={{ padding: '0.5rem', textAlign: 'left', minWidth: '100px' }}>
                                        <div style={{ marginBottom: showFilters ? '0.25rem' : '0' }}>{col.replace('_', ' ')}</div>
                                        {showFilters && (
                                            selectFields.includes(col) ? (
                                                <MultiSelectFilter
                                                    label={col.replace('_', ' ')}
                                                    values={uniqueValues[col] || []}
                                                    selectedValues={filters[col] || []}
                                                    onChange={(values) => handleMultiSelectChange(col, values)}
                                                    hasEmptyValues={hasEmptyValues[col] || false}
                                                />
                                            ) : (
                                                <input value={filters[col]} onChange={(e) => handleFilterChange(col, e.target.value)} placeholder="..." style={{ width: '100%', padding: '0.2rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '4px' }} />
                                            )
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: '1rem' }}>Cargando datos...</td></tr>
                            ) : currentItems.length === 0 ? (
                                <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: '1rem' }}>No se encontraron registros.</td></tr>
                            ) : (
                                currentItems.map((item, index) => (
                                    <tr
                                        key={index}
                                        onDoubleClick={() => handleEditClick(item)}
                                        style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer' }}
                                        className="hover-row"
                                    >
                                        <td style={{ padding: '0.5rem' }}>{item.NUMERO}</td>
                                        <td style={{ padding: '0.5rem' }}>{item.REGISTRO_SIM ? 'VERDADERO' : (item.REGISTRO_SIM === false ? 'FALSO' : '')}</td>
                                        <td style={{ padding: '0.5rem' }}>{item.FECHA_INGRESO}</td>
                                        <td style={{ padding: '0.5rem' }}>{item.ICCID}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Compact */}
                <div style={{ padding: '0.5rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                    <span>{filteredSales.length} registros</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>Anterior</button>
                        <span style={{ padding: '0.3rem 0.6rem' }}>{currentPage} / {totalPages || 1}</span>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>Siguiente</button>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-panel" style={{ width: '400px', padding: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>{isNewRecord ? 'Nuevo Registro' : 'Editar Registro'}</h3>
                        <form onSubmit={handleSave}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem' }}>Número</label>
                                <input required value={editForm.NUMERO} onChange={e => setEditForm({ ...editForm, NUMERO: e.target.value })} style={{ width: '100%', padding: '0.5rem' }} disabled={!isNewRecord} />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem' }}>Registro SIM</label>
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
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem' }}>Fecha Ingreso</label>
                                <input type="date" value={editForm.FECHA_INGRESO || ''} onChange={e => setEditForm({ ...editForm, FECHA_INGRESO: e.target.value })} style={{ width: '100%', padding: '0.5rem' }} />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem' }}>ICCID</label>
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
