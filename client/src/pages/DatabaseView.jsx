import { useState, useEffect } from 'react';
import { getAllMonths, listenToSalesByMonth, importSales, deleteSales } from '../services/SalesService';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import LoadingOverlay from '../components/LoadingOverlay';
import MultiSelectFilter, { EMPTY_VALUE } from '../components/MultiSelectFilter';

export default function DatabaseView() {
    const { currentUser, userRole } = useAuth();
    const [months, setMonths] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [sales, setSales] = useState([]);
    const [filteredSales, setFilteredSales] = useState([]);
    const [loading, setLoading] = useState(false);

    // ... (rest of code) ...



    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Todas las columnas
    const columns = [
        'NUMERO', 'ICCID', 'REGISTRO_SIM', 'FECHA_INGRESO', 'FECHA_ACTIVACION', 'FECHA_SERIALIZACION',
        'ESTADO_SIM', 'TIPO_VENTA', 'NOVEDAD_EN_GESTION', 'CONTACTO_1', 'CONTACTO_2',
        'NOMBRE', 'SALDO', 'ABONO', 'FECHA_CARTERA', 'GUIA', 'ESTADO_GUIA',
        'TRANSPORTADORA', 'NOVEDAD', 'FECHA_HORA_REPORTE', 'DESCRIPCION_NOVEDAD'
    ];

    // Campos que usan selectores en lugar de inputs
    const selectFields = [
        'REGISTRO_SIM', 'FECHA_INGRESO', 'FECHA_ACTIVACION', 'FECHA_SERIALIZACION', 'ESTADO_SIM',
        'TIPO_VENTA', 'TRANSPORTADORA', 'NOVEDAD_EN_GESTION'
    ];

    // Filtros dinámicos - arrays para multi-select, strings para text inputs
    const [filters, setFilters] = useState(
        columns.reduce((acc, col) => ({
            ...acc,
            [col]: selectFields.includes(col) ? [] : ''
        }), {})
    );

    // Opciones únicas para selectores
    const [uniqueValues, setUniqueValues] = useState({});
    const [hasEmptyValues, setHasEmptyValues] = useState({});

    // Filter Visibility State
    const [showFilters, setShowFilters] = useState(false);

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
            const hasEmpty = {};

            selectFields.forEach(field => {
                const allValues = sales.map(sale => sale[field]);
                const hasEmptyValues = allValues.some(v => v == null || v === '');
                hasEmpty[field] = hasEmptyValues;

                let values = [...new Set(allValues.filter(v => v != null && v !== ''))];

                // Convert boolean values to LLEGO/NO LLEGO for REGISTRO_SIM
                if (field === 'REGISTRO_SIM') {
                    values = values.map(v => {
                        if (v === true) return 'LLEGO';
                        if (v === false) return 'NO LLEGO';
                        return v;
                    });
                }

                unique[field] = values.sort();
            });
            setUniqueValues(unique);
            setHasEmptyValues(hasEmpty);
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
        }, 'CREATED_DESC');

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
            const filterValue = filters[col];

            // Skip empty filters
            if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) {
                return;
            }

            filtered = filtered.filter(sale => {
                let value = sale[col];

                // Convert REGISTRO_SIM boolean to LLEGO/NO LLEGO for comparison
                if (col === 'REGISTRO_SIM') {
                    if (value === true) value = 'LLEGO';
                    if (value === false) value = 'NO LLEGO';
                }

                // Multi-select filter (array)
                if (Array.isArray(filterValue)) {
                    // Check if filtering for empty values
                    if (filterValue.includes(EMPTY_VALUE)) {
                        const checkEmpty = value == null || value === '';
                        const otherValues = filterValue.filter(v => v !== EMPTY_VALUE);
                        const checkOthers = otherValues.length > 0 ? otherValues.includes(value) : false;
                        return checkEmpty || checkOthers;
                    }
                    return filterValue.includes(value);
                }

                // Text filter (string)
                return value?.toString().toLowerCase().includes(filterValue.toLowerCase());
            });
        });

        setFilteredSales(filtered);
    };

    const handleFilterChange = (field, value) => {
        setFilters({ ...filters, [field]: value });
        setCurrentPage(1); // Reset a primera pagina al filtrar
    };

    const handleMultiSelectChange = (field, selectedValues) => {
        setFilters({ ...filters, [field]: selectedValues });
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters(columns.reduce((acc, col) => ({
            ...acc,
            [col]: selectFields.includes(col) ? [] : ''
        }), {}));
    };

    const handleExportExcel = () => {
        if (filteredSales.length === 0) return alert("No hay datos para exportar.");

        const dataToExport = filteredSales.map(sale => {
            const row = {};
            columns.forEach(col => {
                let val = sale[col];
                if (col === 'REGISTRO_SIM') {
                    if (val === true) val = 'LLEGO';
                    if (val === false) val = 'NO LLEGO';
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

    const handleDeleteFiltered = async () => {
        if (!userRole || userRole !== 'admin') {
            return alert("Acceso denegado. Solo administradores pueden eliminar registros.");
        }
        if (!selectedMonth) return alert("Selecciona un mes.");
        if (filteredSales.length === 0) return alert("No hay registros filtrados para eliminar.");

        const count = filteredSales.length;
        const confirmMsg = `⚠️ ADVERTENCIA ⚠️\n\nEstás a punto de eliminar ${count} registros visualizados actualmente.\n\nEsta acción NO se puede deshacer.\n\n¿Estás seguro de que deseas continuar?`;

        if (window.confirm(confirmMsg)) {
            // Second confirmation for safety
            if (!window.confirm(`Confirma nuevamente: ¿Realmente deseas ELIMINAR ${count} registros de la base de datos?`)) return;

            setLoading(true);
            try {
                const numerosToDelete = filteredSales.map(s => s.NUMERO);
                const result = await deleteSales(selectedMonth, numerosToDelete);

                setLoading(false);
                let msg = `Eliminación completada.\n\n🗑️ Eliminados: ${result.deleted}`;
                if (result.errors.length > 0) {
                    msg += `\n❌ Errores: ${result.errors.length}`;
                }
                alert(msg);
                // Sales list will update automatically via listener
            } catch (error) {
                console.error("Error deleting sales:", error);
                alert("Error al eliminar: " + error.message);
                setLoading(false);
            }
        }
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

        setLoading(true); // Show spinner immediately

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

                // Hide spinner temporarily for confirm dialog if needed, or keep it.
                // Keeping it is safer for state consistency, but confirm blocks UI.
                // We will defer the confirm slightly if we want spinner to render first?
                // For now, let's keep it simple.

                if (confirm(`Se van a procesar ${normalizedData.length} registros en el mes ${selectedMonth}. ¿Continuar?`)) {
                    // setLoading(true); // Already set
                    const result = await importSales(selectedMonth, normalizedData);

                    let message = `Importación completada.\n\n` +
                        `✅ Agregados: ${result.added}\n` +
                        `🔄 Actualizados: ${result.updated}\n` +
                        `⏭️ Omitidos: ${result.skipped}\n`;

                    if (result.errors.length > 0) {
                        message += `\n❌ Errores (${result.errors.length}):\n` + result.errors.slice(0, 5).join('\n') + (result.errors.length > 5 ? '\n...' : '');
                    }

                    alert(message);
                }
            } catch (error) {
                console.error("Error importing file:", error);
                alert("Error al procesar el archivo: " + error.message);
            } finally {
                setLoading(false); // Ensure loading is turned off
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="container" style={{ maxWidth: '100%', padding: '0.5rem' }}>
            {loading && <LoadingOverlay />}
            <div className="glass-panel" style={{ padding: '0.75rem' }}>
                <h2 style={{ marginBottom: '0.75rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', fontSize: '0.95rem', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

                        {filteredSales.length > 0 && userRole === 'admin' && (
                            <button
                                onClick={handleDeleteFiltered}
                                style={{
                                    fontSize: '0.8rem',
                                    padding: '0.5rem 1rem',
                                    background: '#ef4444',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    marginLeft: '0.5rem'
                                }}
                                title="Eliminar registros filtrados"
                            >
                                🗑️ Eliminar Filtrados
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

                {/* Filtros Colapsables */}
                {sales.length > 0 && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Base de Datos</h2>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: showFilters
                                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))'
                                        : 'rgba(255,255,255,0.05)',
                                    border: showFilters
                                        ? '1px solid rgba(99, 102, 241, 0.5)'
                                        : '1px solid rgba(255,255,255,0.1)',
                                    color: 'white',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: '500',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {showFilters ? '🔍 Ocultar Filtros' : '📊 Mostrar Filtros'}
                            </button>
                        </div>
                        {showFilters && (
                            <div className="glass-panel" style={{ padding: '0.75rem', marginBottom: '0.75rem' }}>
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
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', padding: '0.5rem' }}>
                                    {columns.map(col => (
                                        <div key={col}>
                                            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                {col.replace(/_/g, ' ')}
                                            </label>
                                            {selectFields.includes(col) ? (
                                                <MultiSelectFilter
                                                    label={col.replace(/_/g, ' ')}
                                                    values={uniqueValues[col] || []}
                                                    selectedValues={filters[col] || []}
                                                    onChange={(values) => handleMultiSelectChange(col, values)}
                                                    hasEmptyValues={hasEmptyValues[col] || false}
                                                    forcePosition="top"
                                                />
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
                    </>
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
                                            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 5 }}>
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

                                                            // Convert REGISTRO_SIM boolean to LLEGO/NO LLEGO
                                                            if (col === 'REGISTRO_SIM') {
                                                                if (displayValue === true) displayValue = 'LLEGO';
                                                                if (displayValue === false) displayValue = 'NO LLEGO';
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
