import { useState, useEffect } from 'react';
import { getSalesByMonth, getAllMonths } from '../services/SalesService';

export default function DatabaseView() {
    const [months, setMonths] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [sales, setSales] = useState([]);
    const [filteredSales, setFilteredSales] = useState([]);
    const [loading, setLoading] = useState(false);

    // Todas las columnas
    const columns = [
        'NUMERO', 'ICCID', 'REGISTRO_SIM', 'FECHA_INGRESO', 'FECHA_ACTIVACION',
        'ESTADO_SIM', 'TIPO_VENTA', 'NOVEDAD_EN_GESTION', 'CONTACTO_1', 'CONTACTO_2',
        'NOMBRE', 'SALDO', 'ABONO', 'FECHA_CARTERA', 'GUIA', 'ESTADO_GUIA',
        'TRANSPORTADORA', 'NOVEDAD', 'FECHA_HORA_REPORTE', 'DESCRIPCION_NOVEDAD'
    ];

    // Campos que usan selectores en lugar de inputs
    const selectFields = [
        'REGISTRO_SIM', 'FECHA_INGRESO', 'FECHA_ACTIVACION', 'ESTADO_SIM',
        'TIPO_VENTA', 'TRANSPORTADORA', 'NOVEDAD_EN_GESTION'
    ];

    // Filtros dinámicos
    const [filters, setFilters] = useState(
        columns.reduce((acc, col) => ({ ...acc, [col]: '' }), {})
    );

    // Opciones únicas para selectores
    const [uniqueValues, setUniqueValues] = useState({});

    useEffect(() => {
        loadMonths();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [sales, filters]);

    // Calcular valores únicos cuando cambien las ventas
    useEffect(() => {
        if (sales.length > 0) {
            const unique = {};
            selectFields.forEach(field => {
                const values = [...new Set(sales.map(sale => sale[field]).filter(v => v))];
                unique[field] = values.sort();
            });
            setUniqueValues(unique);
        }
    }, [sales]);

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

    const loadSales = async (month) => {
        if (!month) return;
        setLoading(true);
        try {
            const salesData = await getSalesByMonth(month);
            setSales(salesData);
        } catch (error) {
            console.error('Error loading sales:', error);
            alert('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...sales];

        columns.forEach(col => {
            if (filters[col]) {
                filtered = filtered.filter(sale =>
                    sale[col]?.toString().toLowerCase().includes(filters[col].toLowerCase())
                );
            }
        });

        setFilteredSales(filtered);
    };

    const handleMonthChange = (month) => {
        setSelectedMonth(month);
        loadSales(month);
    };

    const handleFilterChange = (field, value) => {
        setFilters({ ...filters, [field]: value });
    };

    const clearFilters = () => {
        setFilters(columns.reduce((acc, col) => ({ ...acc, [col]: '' }), {}));
    };

    return (
        <div className="container" style={{ maxWidth: '100%', padding: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', fontSize: '1.2rem' }}>
                    Base de Datos
                </h2>

                {/* Selector de Mes */}
                <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1', minWidth: '200px' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Mes</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => handleMonthChange(e.target.value)}
                            style={{ width: '100%', fontSize: '0.85rem' }}
                        >
                            <option value="">Seleccionar mes...</option>
                            {months.map(month => (
                                <option key={month} value={month}>{month}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        className="btn-primary"
                        onClick={() => loadSales(selectedMonth)}
                        disabled={!selectedMonth || loading}
                        style={{ marginTop: 'auto', fontSize: '0.85rem', padding: '0.6rem 1.2rem' }}
                    >
                        {loading ? 'Cargando...' : '🔄 Cargar'}
                    </button>
                </div>

                {/* Filtros */}
                {sales.length > 0 && (
                    <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Filtros</h3>
                            <button
                                onClick={clearFilters}
                                style={{
                                    padding: '0.4rem 0.8rem',
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    color: '#f87171',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                }}
                            >
                                Limpiar
                            </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', padding: '0.5rem' }}>
                            {columns.map(col => (
                                <div key={col}>
                                    <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {col.replace(/_/g, ' ')}
                                    </label>
                                    {selectFields.includes(col) ? (
                                        <select
                                            value={filters[col]}
                                            onChange={(e) => handleFilterChange(col, e.target.value)}
                                            style={{ fontSize: '0.7rem', padding: '0.4rem', width: '100%' }}
                                        >
                                            <option value="">Todos</option>
                                            {(uniqueValues[col] || []).map(value => (
                                                <option key={value} value={value}>{value}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={filters[col]}
                                            onChange={(e) => handleFilterChange(col, e.target.value)}
                                            placeholder="..."
                                            style={{ fontSize: '0.7rem', padding: '0.4rem' }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Resultados */}
                {sales.length > 0 && (
                    <div style={{ marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {filteredSales.length} de {sales.length} registros
                    </div>
                )}

                {/* Tabla ultra compacta */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Cargando datos...
                    </div>
                ) : filteredSales.length > 0 ? (
                    <div style={{ overflowY: 'auto', maxHeight: '500px' }}>
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.6rem',
                            tableLayout: 'fixed'
                        }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 10 }}>
                                <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                                    {columns.map(col => (
                                        <th key={col} style={{
                                            padding: '0.35rem 0.25rem',
                                            textAlign: 'left',
                                            color: 'var(--primary)',
                                            fontSize: '0.6rem',
                                            fontWeight: '600',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {col.replace(/_/g, ' ')}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSales.map((sale, index) => (
                                    <tr
                                        key={sale.NUMERO}
                                        style={{
                                            borderBottom: '1px solid var(--glass-border)',
                                            background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'
                                        }}
                                    >
                                        {columns.map(col => (
                                            <td key={col} style={{
                                                padding: '0.35rem 0.25rem',
                                                color: col === 'NUMERO' ? 'white' : 'var(--text-muted)',
                                                fontWeight: col === 'NUMERO' ? '600' : 'normal',
                                                fontSize: '0.6rem',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}
                                                title={sale[col] || '-'}
                                            >
                                                {sale[col] || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : sales.length === 0 && selectedMonth ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No hay datos para este mes
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Selecciona un mes para ver los datos
                    </div>
                )}
            </div>
        </div>
    );
}
