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

    // 1. SIMs Activas (ESTADO_SIM=ACTIVA)
    const filterActiveSims = (salesData) => {
        return salesData.filter(sale => sale.ESTADO_SIM === 'ACTIVA');
    };

    // 2. Gestión Pendiente (ESTADO=ACTIVA y NOVEDAD_EN_GESTION vacío)
    const filterPendingManagement = (salesData) => {
        return salesData.filter(sale => {
            const isActive = sale.ESTADO_SIM === 'ACTIVA';
            const hasNoManagement = !sale.NOVEDAD_EN_GESTION || sale.NOVEDAD_EN_GESTION.trim() === '';
            return isActive && hasNoManagement;
        });
    };

    // 3. Ventas con Novedades (DESCRIPCION_NOVEDAD no vacío)
    const filterSalesWithIssues = (salesData) => {
        return salesData.filter(sale => {
            return sale.DESCRIPCION_NOVEDAD && sale.DESCRIPCION_NOVEDAD.trim() !== '';
        });
    };

    // 4. Sin Fecha de Activación (FECHA_ACTIVACION vacío)
    const filterNoActivationDate = (salesData) => {
        return salesData.filter(sale => !sale.FECHA_ACTIVACION || sale.FECHA_ACTIVACION.trim() === '');
    };

    // 5. Estado Vacío (ESTADO_SIM vacío)
    const filterEmptyStatus = (salesData) => {
        return salesData.filter(sale => !sale.ESTADO_SIM || sale.ESTADO_SIM.trim() === '');
    };

    // 6. Alertas de Saldo Alto
    const filterHighBalance = (salesData) => {
        return salesData.filter(sale => {
            const saldo = parseFloat(sale.SALDO) || 0;
            const abono = parseFloat(sale.ABONO) || 0;
            return saldo > 10000 && abono <= 10000;
        });
    };

    // Distribución (Solo cálculo, no es filtro de exportación directa en formato lista simple igual que las otras)
    const calculateSimStatusDistribution = (salesData) => {
        const total = salesData.length;
        if (total === 0) return [];
        const statusCount = {};
        salesData.forEach(sale => {
            const status = sale.ESTADO_SIM || 'Sin Estado';
            statusCount[status] = (statusCount[status] || 0) + 1;
        });
        return Object.entries(statusCount).map(([status, count]) => ({
            status,
            count,
            percentage: ((count / total) * 100).toFixed(1)
        })).sort((a, b) => b.count - a.count);
    };

    const calculateAllMetrics = (salesData) => {
        const calculatedMetrics = {
            activeSims: filterActiveSims(salesData),
            pendingManagement: filterPendingManagement(salesData),
            salesWithIssues: filterSalesWithIssues(salesData),
            noActivationDate: filterNoActivationDate(salesData),
            emptyStatus: filterEmptyStatus(salesData),
            highBalanceAlerts: filterHighBalance(salesData),
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

    // Componente: Pie Chart
    const PieChart = ({ data }) => {
        const size = 200;
        const center = size / 2;
        const radius = size / 2 - 10;
        const colors = ['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#f97316', '#06b6d4'];

        let currentAngle = -90;
        const slices = data.map((item, index) => {
            const percentage = parseFloat(item.percentage);
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

        return (
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <svg width={size} height={size} style={{ flexShrink: 0 }}>
                    {slices.map((slice, i) => (
                        <path key={i} d={slice.path} fill={slice.color} stroke="rgba(255,255,255,0.1)" strokeWidth="2">
                            <title>{`${slice.item.status}: ${slice.item.percentage}%`}</title>
                        </path>
                    ))}
                </svg>
                <div style={{ flex: 1, minWidth: '150px' }}>
                    {slices.map((slice, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: slice.color }} />
                            <div>
                                <div style={{ fontWeight: '500' }}>{slice.item.status}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{slice.item.percentage}% ({slice.item.count})</div>
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

                    {/* 1. Gestión Pendiente */}
                    <MetricCard
                        icon="⚠️"
                        title="Gestión Pendiente"
                        data={metrics.pendingManagement}
                        subtitle="Activas SIN información de gestión"
                        color="warning"
                        onExport={handleExport}
                    />

                    {/* 2. Sin Fecha Activación */}
                    <MetricCard
                        icon="📅"
                        title="Sin Fecha Activación"
                        data={metrics.noActivationDate}
                        subtitle="Registros con fecha de activación vacía"
                        color="danger"
                        onExport={handleExport}
                    />

                    {/* 3. Estado Vacío */}
                    <MetricCard
                        icon="❓"
                        title="Sin Estado"
                        data={metrics.emptyStatus}
                        subtitle="Registros con campo ESTADO_SIM vacío"
                        color="danger"
                        onExport={handleExport}
                    />

                    {/* 4. Activas */}
                    <MetricCard
                        icon="✅"
                        title="Total Activas"
                        data={metrics.activeSims}
                        subtitle="Total líneas en estado ACTIVA"
                        color="success"
                        onExport={handleExport}
                    />

                    {/* 5. Saldo Alto */}
                    <MetricCard
                        icon="💰"
                        title="Saldo Alto / Bajo Abono"
                        data={metrics.highBalanceAlerts}
                        subtitle="Saldo > 10k y Abono <= 10k"
                        color="danger"
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
