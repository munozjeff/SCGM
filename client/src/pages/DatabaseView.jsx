import { useState, useEffect } from 'react';
import { getAllMonths, listenToSalesByMonth, importSales } from '../services/SalesService';
import * as XLSX from 'xlsx';
import LoadingOverlay from '../components/LoadingOverlay';

export default function DatabaseView() {
    const [months, setMonths] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [sales, setSales] = useState([]);
    const [filteredSales, setFilteredSales] = useState([]);
    const [loading, setLoading] = useState(false);

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

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
                let values = [...new Set(sales.map(sale => sale[field]).filter(v => v != null))];

                // Convert boolean values to SÍ/NO for REGISTRO_SIM
                if (field === 'REGISTRO_SIM') {
                    values = values.map(v => typeof v === 'boolean' ? (v ? 'SÍ' : 'NO') : v);
                }

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

    // Listen to real-time changes cuando cambia el mes
    useEffect(() => {
        if (!selectedMonth) return;

        setLoading(true);

        // Setup real-time listener
        const unsubscribe = listenToSalesByMonth(selectedMonth, (salesData) => {
            setSales(salesData);
            setLoading(false);
        });

        // Cleanup listener when component unmounts or month changes
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [selectedMonth]);

    const handleMonthChange = (month) => {
        setSelectedMonth(month);
    };

    const applyFilters = () => {
        let filtered = [...sales];

        columns.forEach(col => {
            if (filters[col]) {
                filtered = filtered.filter(sale => {
                    let value = sale[col];

                    // Convert REGISTRO_SIM boolean to SÍ/NO for comparison
                    if (col === 'REGISTRO_SIM' && typeof value === 'boolean') {
                        value = value ? 'SÍ' : 'NO';
                    }

                    return value?.toString().toLowerCase().includes(filters[col].toLowerCase());
                });
            }
        });

        setFilteredSales(filtered);
    };

    const handleFilterChange = (field, value) => {
        setFilters({ ...filters, [field]: value });
        setCurrentPage(1); // Reset a primera pagina al filtrar
    };

    const clearFilters = () => {
        setFilters(columns.reduce((acc, col) => ({ ...acc, [col]: '' }), {}));
    };

    const handleExportExcel = () => {
        if (filteredSales.length === 0) return alert("No hay datos para exportar.");

        const dataToExport = filteredSales.map(sale => {
            const row = {};
            columns.forEach(col => {
                let val = sale[col];
                if (col === 'REGISTRO_SIM' && typeof val === 'boolean') {
                    val = val ? 'SÍ' : 'NO';
                }
                row[col.replace(/_/g, ' ')] = val;
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "BaseDatos");
        XLSX.writeFile(wb, `BaseDatos_${selectedMonth || 'Export'}.xlsx`);
    };

    const handleImportClick = () => {
        document.getElementById('import-excel-input').click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!selectedMonth) {
            alert("Por favor selecciona un mes antes de importar.");
            e.target.value = ''; // Reset input
            return;
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const workbook = XLSX.read(bstr, { type: 'binary' });
                const wsname = workbook.SheetNames[0];
                const ws = workbook.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    alert("El archivo parece estar vacío.");
                    return;
                }

                // Normalización de claves (Headers)
                // Convertir "REGISTRO SIM" -> "REGISTRO_SIM", etc.
                const normalizedData = data.map(row => {
                    const newRow = {};
                    Object.keys(row).forEach(key => {
                        // Reemplazar espacios por _ y mayúsculas
                        const normalizedKey = key.trim().toUpperCase().replace(/\s+/g, '_');
                        newRow[normalizedKey] = row[key];
                    });
                    return newRow;
                });

                if (confirm(`Se van a procesar ${normalizedData.length} registros en el mes ${selectedMonth}. ¿Continuar?`)) {
                    setLoading(true);
                    const result = await importSales(selectedMonth, normalizedData);
                    setLoading(false);

                    let message = `Importación completada.\n\n` +
                        `✅ Agregados: ${result.added}\n` +
                        `🔄 Actualizados: ${result.updated}\n` +
                        `⏭️ Omitidos: ${result.skipped}\n`;

                    if (result.errors.length > 0) {
                        message += `\n❌ Errores (${result.errors.length}):\n` + result.errors.slice(0, 5).join('\n') + (result.errors.length > 5 ? '\n...' : '');
                    }

                    alert(message);
                    // Forzar recarga si es necesario, aunque el listener debería hacerlo
                    // loadSales(selectedMonth); // El listener ya actualiza `sales`
                }

            } catch (error) {
                console.error("Error importing file:", error);
                alert("Error al procesar el archivo: " + error.message);
                setLoading(false);
            } finally {
                e.target.value = ''; // Reset para permitir importar el mismo archivo de nuevo si se desea
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="container" style={{ maxWidth: '100%', padding: '1rem' }}>
            {loading && <LoadingOverlay />}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', fontSize: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Base de Datos</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {/* Input file oculto */}
                        <input
                            type="file"
                            id="import-excel-input"
                            accept=".xlsx, .xls"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                        <button
                            onClick={handleImportClick}
                            disabled={!selectedMonth || loading}
                            style={{
                                fontSize: '0.8rem',
                                padding: '0.5rem 1rem',
                                background: 'var(--primary)',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                opacity: (!selectedMonth || loading) ? 0.6 : 1
                            }}
                            title={!selectedMonth ? "Selecciona un mes primero" : "Importar Excel"}
                        >
                            📤 Importar Excel
                        </button>

                        {filteredSales.length > 0 && (
                            <button
                                onClick={handleExportExcel}
                                style={{
                                    fontSize: '0.8rem',
                                    padding: '0.5rem 1rem',
                                    background: '#10b981',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                📥 Exportar Excel
                            </button>
                        )}
                    </div>
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
                    <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <span>{filteredSales.length} registros encontrados (Total: {sales.length})</span>
                    </div>
                )}

                {/* Lógica de Paginación */}
                {(() => {
                    const indexOfLastItem = currentPage * itemsPerPage;
                    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
                    const currentItems = filteredSales.slice(indexOfFirstItem, indexOfLastItem);
                    const totalPages = Math.ceil(filteredSales.length / itemsPerPage);

                    const handlePageChange = (newPage) => {
                        if (newPage >= 1 && newPage <= totalPages) {
                            setCurrentPage(newPage);
                        }
                    };

                    return (
                        <>
                            {/* Tabla ultra compacta */}
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    Cargando datos...
                                </div>
                            ) : filteredSales.length > 0 ? (
                                <>
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
                                                {currentItems.map((sale, index) => (
                                                    <tr
                                                        key={sale.NUMERO}
                                                        style={{
                                                            borderBottom: '1px solid var(--glass-border)',
                                                            background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'
                                                        }}
                                                    >
                                                        {columns.map(col => {
                                                            let displayValue = sale[col];

                                                            // Convert REGISTRO_SIM boolean to SÍ/NO
                                                            if (col === 'REGISTRO_SIM' && typeof displayValue === 'boolean') {
                                                                displayValue = displayValue ? 'SÍ' : 'NO';
                                                            }

                                                            // Convert to string for display and title
                                                            const valueStr = displayValue != null ? String(displayValue) : '-';

                                                            return (
                                                                <td key={col} style={{
                                                                    padding: '0.35rem 0.25rem',
                                                                    color: col === 'NUMERO' ? 'white' : 'var(--text-muted)',
                                                                    fontWeight: col === 'NUMERO' ? '600' : 'normal',
                                                                    fontSize: '0.6rem',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                                    title={valueStr}
                                                                >
                                                                    {valueStr}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Controles de Paginación */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginTop: '1rem',
                                        paddingTop: '1rem',
                                        borderTop: '1px solid var(--glass-border)',
                                        fontSize: '0.8rem',
                                        color: 'var(--text-muted)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <span>Filas por página:</span>
                                            <select
                                                value={itemsPerPage}
                                                onChange={(e) => {
                                                    setItemsPerPage(Number(e.target.value));
                                                    setCurrentPage(1);
                                                }}
                                                style={{
                                                    padding: '0.2rem',
                                                    fontSize: '0.8rem',
                                                    borderRadius: '4px',
                                                    border: '1px solid var(--glass-border)',
                                                    background: 'var(--bg-card)',
                                                    color: 'white'
                                                }}
                                            >
                                                <option value={50}>50</option>
                                                <option value={100}>100</option>
                                                <option value={200}>200</option>
                                                <option value={500}>500</option>
                                            </select>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage === 1}
                                                className="btn-secondary"
                                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', opacity: currentPage === 1 ? 0.5 : 1 }}
                                            >
                                                Anterior
                                            </button>
                                            <span style={{ margin: '0 0.5rem' }}>
                                                Página <strong style={{ color: 'white' }}>{currentPage}</strong> de {totalPages}
                                            </span>
                                            <button
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                                className="btn-secondary"
                                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', opacity: currentPage === totalPages ? 0.5 : 1 }}
                                            >
                                                Siguiente
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : sales.length === 0 && selectedMonth ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    No hay datos para este mes
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    Selecciona un mes para ver los datos
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>
        </div>
    );
}
