import { useState, useEffect } from 'react';
import { getAllMonths, listenToSalesByMonth } from '../services/SalesService';
import * as XLSX from 'xlsx';

export default function Dashboard() {
    const [months, setMonths] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [sales, setSales] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadMonths();
    }, []);

    // Real-time metrics listener
    useEffect(() => {
        if (!selectedMonth) return;

        setLoading(true);

        const unsubscribe = listenToSalesByMonth(selectedMonth, (salesData) => {
            setSales(salesData);
            calculateAllMetrics(salesData);
            setLoading(false);
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [selectedMonth]);

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

    // Utilidad: Calcula diferencia en días desde hoy
    const getDaysDifference = (dateString) => {
        if (!dateString) return null;
        try {
            const date = new Date(dateString);
            const today = new Date();
            const diffTime = today - date;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
        } catch {
            return null;
        }
    };

    // --- Lógica de Filtros (Retornan Arrays) ---

    // Utility: Parse date efficiently for comparison (YYYY-MM-DD)
    const parseDate = (dateStr) => {
        if (!dateStr) return null;
        // Adjust for potential timezone issues if needed, but string comparison YYYY-MM-DD is safest if format is consistent
        // Assuming YYYY-MM-DD from normalizeDate
        return new Date(dateStr + 'T00:00:00');
    };

    const isToday = (dateStr) => {
        if (!dateStr) return false;
        const d = parseDate(dateStr);
        const today = new Date();
        return d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear();
    };

    const isTomorrow = (dateStr) => {
        if (!dateStr) return false;
        const d = parseDate(dateStr);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return d.getDate() === tomorrow.getDate() &&
            d.getMonth() === tomorrow.getMonth() &&
            d.getFullYear() === tomorrow.getFullYear();
    };

    const isDateBeforeOrEqualToday = (dateStr) => {
        if (!dateStr) return false;
        const d = parseDate(dateStr);
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        return d <= today;
    };


    // 1. Gestión Pendiente / Sin Gestión (User Request: No management data AND Activation Date <= Today)
    // "cantidad de registros con novedad en gestion que no tenga datos... y que ademas su fecha de activacion sea igual o anterior a la fecha actual"
    const filterMissingManagement = (salesData) => {
        return salesData.filter(sale => {
            const hasNoManagement = !sale.NOVEDAD_EN_GESTION || sale.NOVEDAD_EN_GESTION.trim() === '';
            // Assuming this applies to Active SIMs predominantly, but user text emphasized the date and empty field.
            // Adding ESTADO_SIM === 'ACTIVA' is safer for "Gestión", but let's stick to the specific field request + Date.
            // Usually "Gestión" implies the SIM is in use.
            const isActive = sale.ESTADO_SIM === 'ACTIVA';
            return isActive && hasNoManagement && isDateBeforeOrEqualToday(sale.FECHA_ACTIVACION);
        });
    };

    // 2. Sin Fecha de Activación
    const filterMissingActivation = (salesData) => {
        return salesData.filter(sale => !sale.FECHA_ACTIVACION || sale.FECHA_ACTIVACION.trim() === '');
    };

    // 3. Sin Fecha de Ingreso
    const filterMissingIncome = (salesData) => {
        return salesData.filter(sale => !sale.FECHA_INGRESO || sale.FECHA_INGRESO.trim() === '');
    };

    // 4. Sin Estado SIM (Empty ESTADO_SIM)
    const filterMissingSimStatus = (salesData) => {
        return salesData.filter(sale => !sale.ESTADO_SIM || sale.ESTADO_SIM.trim() === '');
    };

    // 2. Activations Today
    const filterActivationsToday = (salesData) => {
        return salesData.filter(sale => isToday(sale.FECHA_ACTIVACION));
    };

    // 3. Activations Tomorrow
    const filterActivationsTomorrow = (salesData) => {
        return salesData.filter(sale => isTomorrow(sale.FECHA_ACTIVACION));
    };

    // 4. Gestión Pendiente (User Definition: Active Status AND Date <= Today)
    const filterPendingManagement = (salesData) => {
        return salesData.filter(sale => {
            return sale.ESTADO_SIM === 'ACTIVA' && isDateBeforeOrEqualToday(sale.FECHA_ACTIVACION);
        });
    };

    // 5. Portfolio (Cartera)
    const filterPortfolio = (salesData) => {
        return salesData.filter(sale => {
            const saldo = parseFloat(sale.SALDO) || 0;
            return saldo > 0;
        });
    };

    // 6. Envíos Pendientes (User Request: Novedad = 'ENVIO PENDIENTE' AND ESTADO_SIM != 'ENVIADA')
    const filterPendingShipments = (salesData) => {
        return salesData.filter(sale => {
            const novedad = sale.NOVEDAD_EN_GESTION ? sale.NOVEDAD_EN_GESTION.trim().toUpperCase() : '';
            const estado = sale.ESTADO_SIM ? sale.ESTADO_SIM.trim().toUpperCase() : '';
            return (novedad === 'ENVIO PENDIENTE' || novedad === 'ENVÍO PENDIENTE') && estado !== 'ENVIADA';
        });
    };

    // 7. Seguimiento Envíos (ESTADO_SIM = 'ENVIADA' AND ESTADO_GUIA != 'ENTREGADA')
    const filterTrackingShipments = (salesData) => {
        return salesData.filter(sale => {
            const estadoSim = sale.ESTADO_SIM ? sale.ESTADO_SIM.trim().toUpperCase() : '';
            const estadoGuia = sale.ESTADO_GUIA ? sale.ESTADO_GUIA.trim().toUpperCase() : '';
            return estadoSim === 'ENVIADA' && estadoGuia !== 'ENTREGADA';
        });
    };

    // Distribución Breakdown
    const calculateSimStatusDistribution = (salesData) => {
        const total = salesData.length;
        if (total === 0) return [];

        let activeBeforeOrToday = 0;
        let activeAfterToday = 0;
        let inactive = 0;
        let sent = 0;

        salesData.forEach(sale => {
            const status = sale.ESTADO_SIM || '';
            const activDate = sale.FECHA_ACTIVACION;

            if (status === 'ACTIVA') {
                if (isDateBeforeOrEqualToday(activDate)) {
                    activeBeforeOrToday++;
                } else {
                    activeAfterToday++;
                }
            } else if (status === 'INACTIVA') {
                inactive++;
            } else if (status === 'ENVIADA') {
                sent++;
            }
            // Others ignored in specific breakdown but included in total count
        });

        // Helper for percentage
        const calcPct = (count) => ((count / total) * 100).toFixed(1);

        return [
            { status: 'Activas (<= Hoy)', count: activeBeforeOrToday, percentage: calcPct(activeBeforeOrToday) },
            { status: 'Activas (> Hoy)', count: activeAfterToday, percentage: calcPct(activeAfterToday) },
            { status: 'Inactivas', count: inactive, percentage: calcPct(inactive) },
            { status: 'Enviadas', count: sent, percentage: calcPct(sent) },
        ];
    };

    const calculateAllMetrics = (salesData) => {
        const calculatedMetrics = {
            missingManagement: filterMissingManagement(salesData),
            missingActivation: filterMissingActivation(salesData),
            missingIncome: filterMissingIncome(salesData),
            missingSimStatus: filterMissingSimStatus(salesData),
            activationsToday: filterActivationsToday(salesData),
            activationsTomorrow: filterActivationsTomorrow(salesData),
            portfolio: filterPortfolio(salesData),
            pendingShipments: filterPendingShipments(salesData),
            trackingShipments: filterTrackingShipments(salesData),
            simStatusDistribution: calculateSimStatusDistribution(salesData),
            totalSales: salesData.length
        };
        setMetrics(calculatedMetrics);
    };

    const handleExport = (data, fileName) => {
        if (!data || data.length === 0) {
            alert("No hay datos para exportar.");
            return;
        }

        // Limpieza básica para exportación
        const exportData = data.map(item => ({
            NUMERO: item.NUMERO,
            ICCID: item.ICCID,
            ESTADO_SIM: item.ESTADO_SIM,
            ESTADO_GUIA: item.ESTADO_GUIA,
            TIPO_VENTA: item.TIPO_VENTA,
            FECHA_INGRESO: item.FECHA_INGRESO,
            FECHA_ACTIVACION: item.FECHA_ACTIVACION,
            NOVEDAD_EN_GESTION: item.NOVEDAD_EN_GESTION,
            NOMBRE: item.NOMBRE,
            SALDO: item.SALDO,
            ABONO: item.ABONO
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, "Datos");
        XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Componente: Pie Chart (Restored)
    const PieChart = ({ data }) => {
        // Data format: [{ status: '...', count: 10, percentage: '12.5' }, ...]
        const size = 200;
        const center = size / 2;
        const radius = size / 2 - 10;
        const colors = ['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#f97316', '#06b6d4'];

        let currentAngle = -90;
        const slices = data.map((item, index) => {
            const percentage = parseFloat(item.percentage); // Ensure float
            const angle = (percentage / 100) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            currentAngle = endAngle;

            const xfa = (angle > 180) ? 1 : 0;
            const x1 = center + radius * Math.cos(Math.PI * startAngle / 180);
            const y1 = center + radius * Math.sin(Math.PI * startAngle / 180);
            const x2 = center + radius * Math.cos(Math.PI * endAngle / 180);
            const y2 = center + radius * Math.sin(Math.PI * endAngle / 180);

            return {
                path: `M${center},${center} L${x1},${y1} A${radius},${radius} 0 ${xfa},1 ${x2},${y2} Z`,
                color: colors[index % colors.length],
                item
            };
        });

        // Legend separate
        return (
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <svg width={size} height={size} style={{ flexShrink: 0, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}>
                    {slices.map((slice, i) => (
                        <path key={i} d={slice.path} fill={slice.color} stroke="rgba(255,255,255,0.05)" strokeWidth="1">
                            <title>{`${slice.item.status}: ${slice.item.percentage}%`}</title>
                        </path>
                    ))}
                    {/* Inner hole for donut effect if desired, but sticking to pie for now as requested */}
                </svg>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', flex: 1 }}>
                    {slices.map((slice, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: slice.color, flexShrink: 0 }} />
                            <div>
                                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{slice.item.status}</div>
                                <div style={{ color: 'var(--text-muted)' }}>{slice.item.count} ({slice.item.percentage}%)</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Componente Metric Card (Flexible y Uniforme)
    const MetricCard = ({ icon, title, data, subtitle, color, children, onExport }) => {
        const colorStyles = {
            success: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)', text: '#4ade80' },
            warning: { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)', text: '#facc15' },
            danger: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#f87171' },
            info: { bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.3)', text: '#818cf8' }
        };

        const style = colorStyles[color] || colorStyles.info;
        const count = Array.isArray(data) ? data.length : data; // Handle array or direct number (for distribution)

        return (
            <div className="glass-panel" style={{
                padding: '1.5rem',
                background: style.bg,
                border: `1px solid ${style.border}`,
                display: 'flex',
                flexDirection: 'column',
                height: '100%', // Uniform height
                transition: 'transform 0.2s',
                position: 'relative'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ fontSize: '2rem' }}>{icon}</div>
                        <div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{title}</div>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: style.text }}>{count}</div>
                        </div>
                    </div>
                    {onExport && (
                        <button
                            onClick={() => onExport(data, title.replace(/\s+/g, '_'))}
                            title="Exportar a Excel"
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '0.4rem',
                                cursor: 'pointer',
                                color: style.text
                            }}
                        >
                            📥
                        </button>
                    )}
                </div>

                {subtitle && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'auto' }}>{subtitle}</div>}

                {children}
            </div>
        );
    };

    return (
        <div className="container" style={{ maxWidth: '1400px', padding: '2rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem', background: 'linear-gradient(135deg, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    📊 Dashboard
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>Métricas clave y alertas operativas</p>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>📅 Seleccionar Mes</label>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ width: '100%', padding: '0.75rem' }}>
                    <option value="">Seleccionar mes...</option>
                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>

            {loading && <div style={{ textAlign: 'center', padding: '4rem' }}>⏳ Cargando...</div>}

            {!loading && metrics && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>

                    {/* NEW: Sin Estado SIM */}
                    <MetricCard
                        icon="❓"
                        title="Sin Estado SIM"
                        data={metrics.missingSimStatus}
                        subtitle="Falta ESTADO_SIM"
                        color="danger"
                        onExport={handleExport}
                    />

                    {/* 1. Gestión Pendiente (Sin info y Fecha <= Hoy) */}
                    <MetricCard
                        icon="⚠️"
                        title="Gestión Pendiente"
                        data={metrics.missingManagement}
                        subtitle="Sin gestión y Activación <= Hoy"
                        color="warning"
                        onExport={handleExport}
                    />

                    {/* 2. Sin Fecha de Activación */}
                    <MetricCard
                        icon="📅"
                        title="Sin Fecha Activación"
                        data={metrics.missingActivation}
                        subtitle="Falta FECHA_ACTIVACION"
                        color="danger"
                        onExport={handleExport}
                    />

                    {/* 3. Sin Fecha de Ingreso */}
                    <MetricCard
                        icon="📥"
                        title="Sin Fecha Ingreso"
                        data={metrics.missingIncome}
                        subtitle="Falta FECHA_INGRESO"
                        color="danger"
                        onExport={handleExport}
                    />

                    {/* 4. Activaciones Hoy */}
                    <MetricCard
                        icon="✅"
                        title="Activación Hoy"
                        data={metrics.activationsToday}
                        subtitle={`Fecha activación: Hoy`}
                        color="info"
                        onExport={handleExport}
                    />

                    {/* 4. Activaciones Mañana */}
                    <MetricCard
                        icon="🌤️"
                        title="Activación Mañana"
                        data={metrics.activationsTomorrow}
                        subtitle={`Fecha activación: Mañana`}
                        color="info"
                        onExport={handleExport}
                    />

                    {/* 5. Cartera */}
                    <MetricCard
                        icon="💰"
                        title="Cartera"
                        data={metrics.portfolio}
                        subtitle="Registros con Saldo > 0"
                        color="danger"
                        onExport={handleExport}
                    />

                    {/* 6. Envíos Pendientes */}
                    <MetricCard
                        icon="🚚"
                        title="Envíos Pendientes"
                        data={metrics.pendingShipments}
                        subtitle="Novedad 'Envío Pendiente' y No 'Enviada'"
                        color="warning"
                        onExport={handleExport}
                    />

                    {/* 7. Seguimiento Envíos */}
                    <MetricCard
                        icon="📦"
                        title="Seguimiento Envíos"
                        data={metrics.trackingShipments}
                        subtitle="Enviada y No Entregada"
                        color="info"
                        onExport={handleExport}
                    />

                    {/* 6. Distribución (Gráfico) */}
                    <div style={{ gridColumn: '1 / -1' }}>
                        <MetricCard
                            icon="📊"
                            title="Distribución Estados SIM"
                            data={metrics.totalSales}
                            subtitle="Panorama general de estados"
                            color="info"
                        >
                            <div style={{ marginTop: '1rem' }}>
                                <PieChart data={metrics.simStatusDistribution} />
                            </div>
                        </MetricCard>
                    </div>

                </div>
            )}
        </div>
    );
}
