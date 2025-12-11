import { useState, useEffect } from 'react';
import { getSalesByMonth, getAllMonths } from '../services/SalesService';

export default function Dashboard() {
    const [months, setMonths] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [sales, setSales] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadMonths();
    }, []);

    useEffect(() => {
        if (selectedMonth) {
            loadSalesAndCalculateMetrics(selectedMonth);
        }
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

    const loadSalesAndCalculateMetrics = async (month) => {
        setLoading(true);
        try {
            const salesData = await getSalesByMonth(month);
            setSales(salesData);
            calculateAllMetrics(salesData);
        } catch (error) {
            console.error('Error loading sales:', error);
            alert('Error al cargar datos del mes');
        } finally {
            setLoading(false);
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

    // Métrica 1: SIMs Activos Recientes (ESTADO_SIM=ACTIVO, FECHA_ACTIVACION ≥5 días)
    const calculateActiveSims = (salesData) => {
        return salesData.filter(sale => {
            if (sale.ESTADO_SIM !== 'ACTIVO') return false;
            if (!sale.FECHA_ACTIVACION) return false;

            const daysDiff = getDaysDifference(sale.FECHA_ACTIVACION);
            return daysDiff !== null && daysDiff >= 5;
        }).length;
    };

    // Métrica 2: Gestión Pendiente (NOVEDAD_EN_GESTION vacío, FECHA_INGRESO >5 días)
    const calculatePendingManagement = (salesData) => {
        return salesData.filter(sale => {
            const hasNoManagement = !sale.NOVEDAD_EN_GESTION || sale.NOVEDAD_EN_GESTION.trim() === '';
            if (!hasNoManagement) return false;

            if (!sale.FECHA_INGRESO) return false;
            const daysDiff = getDaysDifference(sale.FECHA_INGRESO);

            return daysDiff !== null && daysDiff > 5;
        }).length;
    };

    // Métrica 3: Ventas con Novedades (DESCRIPCION_NOVEDAD no vacío)
    const calculateSalesWithIssues = (salesData) => {
        return salesData.filter(sale => {
            return sale.DESCRIPCION_NOVEDAD && sale.DESCRIPCION_NOVEDAD.trim() !== '';
        }).length;
    };

    // Métrica 4: Distribución de Estados SIM (porcentajes)
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

    // Métrica 5: Alertas de Saldo Alto (SALDO >10000, ABONO ≤10000)
    const calculateHighBalanceAlerts = (salesData) => {
        return salesData.filter(sale => {
            const saldo = parseFloat(sale.SALDO) || 0;
            const abono = parseFloat(sale.ABONO) || 0;

            return saldo > 10000 && abono <= 10000;
        }).length;
    };

    // Calcula todas las métricas
    const calculateAllMetrics = (salesData) => {
        const calculatedMetrics = {
            activeSims: calculateActiveSims(salesData),
            pendingManagement: calculatePendingManagement(salesData),
            salesWithIssues: calculateSalesWithIssues(salesData),
            simStatusDistribution: calculateSimStatusDistribution(salesData),
            highBalanceAlerts: calculateHighBalanceAlerts(salesData),
            totalSales: salesData.length
        };
        setMetrics(calculatedMetrics);
    };

    // Componente: Pie Chart
    const PieChart = ({ data }) => {
        const size = 200;
        const center = size / 2;
        const radius = size / 2 - 10;

        // Paleta de colores vibrantes
        const colors = [
            '#6366f1', // Indigo
            '#ec4899', // Pink
            '#8b5cf6', // Purple
            '#14b8a6', // Teal
            '#f59e0b', // Amber
            '#ef4444', // Red
            '#10b981', // Green
            '#3b82f6', // Blue
            '#f97316', // Orange
            '#06b6d4'  // Cyan
        ];

        // Pre-calculate all slices
        const slices = [];
        let currentAngle = -90; // Start from top

        data.forEach((item, index) => {
            const percentage = parseFloat(item.percentage);
            const angle = (percentage / 100) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;

            // Convert to radians
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;

            // Calculate arc points
            const x1 = center + radius * Math.cos(startRad);
            const y1 = center + radius * Math.sin(startRad);
            const x2 = center + radius * Math.cos(endRad);
            const y2 = center + radius * Math.sin(endRad);

            // Large arc flag
            const largeArc = angle > 180 ? 1 : 0;

            // Create path
            const path = [
                `M ${center} ${center}`,
                `L ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
                'Z'
            ].join(' ');

            slices.push({
                path,
                color: colors[index % colors.length],
                item
            });

            currentAngle = endAngle;
        });

        return (
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                {/* Pie Chart SVG */}
                <svg width={size} height={size} style={{ flexShrink: 0 }}>
                    {slices.map((slice, index) => (
                        <g key={index}>
                            <path
                                d={slice.path}
                                fill={slice.color}
                                stroke="rgba(255, 255, 255, 0.1)"
                                strokeWidth="2"
                                style={{
                                    transition: 'opacity 0.2s',
                                    cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                                onMouseLeave={(e) => e.target.style.opacity = '1'}
                            >
                                <title>{`${slice.item.status}: ${slice.item.percentage}% (${slice.item.count} ventas)`}</title>
                            </path>
                        </g>
                    ))}
                </svg>

                {/* Legend */}
                <div style={{ flex: 1, minWidth: '150px' }}>
                    {slices.map((slice, index) => (
                        <div key={index} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.5rem',
                            fontSize: '0.85rem'
                        }}>
                            <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '2px',
                                background: slice.color,
                                flexShrink: 0
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontWeight: '500',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {slice.item.status}
                                </div>
                                <div style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    {slice.item.percentage}% ({slice.item.count})
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };


    // Componente reutilizable: Metric Card
    const MetricCard = ({ icon, title, value, subtitle, color, children }) => {
        const colorStyles = {
            success: {
                bg: 'rgba(34, 197, 94, 0.1)',
                border: 'rgba(34, 197, 94, 0.3)',
                text: '#4ade80'
            },
            warning: {
                bg: 'rgba(234, 179, 8, 0.1)',
                border: 'rgba(234, 179, 8, 0.3)',
                text: '#facc15'
            },
            danger: {
                bg: 'rgba(239, 68, 68, 0.1)',
                border: 'rgba(239, 68, 68, 0.3)',
                text: '#f87171'
            },
            info: {
                bg: 'rgba(99, 102, 241, 0.1)',
                border: 'rgba(99, 102, 241, 0.3)',
                text: '#818cf8'
            }
        };

        const style = colorStyles[color] || colorStyles.info;

        return (
            <div className="glass-panel" style={{
                padding: '1.5rem',
                background: style.bg,
                border: `1px solid ${style.border}`,
                transition: 'transform 0.2s, box-shadow 0.2s'
            }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.4)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '2rem' }}>{icon}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                            {title}
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: style.text }}>
                            {value}
                        </div>
                    </div>
                </div>
                {subtitle && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        {subtitle}
                    </div>
                )}
                {children}
            </div>
        );
    };

    return (
        <div className="container" style={{ maxWidth: '1400px', padding: '2rem' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    marginBottom: '0.5rem',
                    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    📊 Dashboard
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                    Resumen de métricas clave del mes seleccionado
                </p>
            </div>

            {/* Month Selector */}
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1', minWidth: '250px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            color: 'var(--text-muted)',
                            fontSize: '0.9rem',
                            fontWeight: '500'
                        }}>
                            📅 Seleccionar Mes
                        </label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            style={{
                                width: '100%',
                                fontSize: '1rem',
                                padding: '0.75rem'
                            }}
                        >
                            <option value="">Seleccionar mes...</option>
                            {months.map(month => (
                                <option key={month} value={month}>{month}</option>
                            ))}
                        </select>
                    </div>
                    {metrics && (
                        <div style={{
                            padding: '1rem 1.5rem',
                            background: 'rgba(99, 102, 241, 0.1)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Ventas</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                {metrics.totalSales}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem',
                    color: 'var(--text-muted)',
                    fontSize: '1.1rem'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
                    Cargando datos...
                </div>
            )}

            {/* Metrics Grid */}
            {!loading && metrics && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '1.5rem',
                    alignItems: 'stretch'
                }}>
                    {/* Métrica 1: SIMs Activos Recientes */}
                    <MetricCard
                        icon="✅"
                        title="SIMs Activos Recientes"
                        value={metrics.activeSims}
                        subtitle="Estado ACTIVO con activación ≥ 5 días"
                        color="success"
                    />

                    {/* Métrica 2: Gestión Pendiente */}
                    <MetricCard
                        icon="⚠️"
                        title="Gestión Pendiente"
                        value={metrics.pendingManagement}
                        subtitle="Sin novedad en gestión y > 5 días de ingreso"
                        color="warning"
                    />

                    {/* Métrica 3: Ventas con Novedades */}
                    <MetricCard
                        icon="🚨"
                        title="Ventas con Novedades"
                        value={metrics.salesWithIssues}
                        subtitle="Ventas con descripción de novedad"
                        color="danger"
                    />

                    {/* Métrica 5: Alertas de Saldo Alto */}
                    <MetricCard
                        icon="💰"
                        title="Alertas de Saldo Alto"
                        value={metrics.highBalanceAlerts}
                        subtitle="Saldo > $10,000 con abono ≤ $10,000"
                        color="danger"
                    />

                    {/* Métrica 4: Distribución de Estados SIM */}
                    <MetricCard
                        icon="📊"
                        title="Distribución Estados SIM"
                        value={metrics.simStatusDistribution.length}
                        subtitle="Estados únicos encontrados"
                        color="info"
                    >
                        <div style={{ marginTop: '1rem' }}>
                            {metrics.simStatusDistribution.length > 0 ? (
                                <PieChart data={metrics.simStatusDistribution} />
                            ) : (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '2rem',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.9rem'
                                }}>
                                    No hay datos para mostrar
                                </div>
                            )}
                        </div>
                    </MetricCard>
                </div>
            )}

            {/* Empty State */}
            {!loading && !metrics && selectedMonth && (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem',
                    color: 'var(--text-muted)',
                    fontSize: '1.1rem'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                    No hay datos disponibles para este mes
                </div>
            )}

            {!loading && !selectedMonth && (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem',
                    color: 'var(--text-muted)',
                    fontSize: '1.1rem'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
                    Selecciona un mes para ver las métricas
                </div>
            )}
        </div>
    );
}
