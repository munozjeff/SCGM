import { db } from "../firebase";
import { ref, set, get, child, update, onValue, remove } from "firebase/database";

/**
 * Actualiza ingresos (REGISTRO_SIM, FECHA_INGRESO) para una lista de números.
 * @param {string} month - Mes de operación
 * @param {Array} updates - Lista de objetos { NUMERO, REGISTRO_SIM, FECHA_INGRESO }
 * @returns {Promise<Object>} - Resumen { updated, skipped, errors }
 */

const normalizeDate = (value) => {
    if (!value) return undefined;

    // 1. If it's already a JS Date
    if (value instanceof Date) {
        return value.toISOString().split('T')[0];
    }

    // 2. If it's an Excel Serial Number (e.g. 45000)
    // Excel base date: Dec 30, 1899. (There is a leap year bug in 1900, but usually this works)
    if (typeof value === 'number' && value > 20000) {
        const date = new Date((value - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
    }

    // 3. If it's a string
    const str = String(value).trim();
    if (!str) return undefined;

    // Try to detect DD/MM/YYYY or D/M/YYYY (common in Colombia/LATAM)
    // Regex matches: (1-2 digits) / (1-2 digits) / (4 digits)
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
    }

    // Try YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymdMatch) {
        const year = ymdMatch[1];
        const month = ymdMatch[2].padStart(2, '0');
        const day = ymdMatch[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Fallback: Try standard Date parse (May interpret 11/3 as Nov 3 for en-US locale)
    // But since we handled D/M/Y explicitly above, this catches odd formats
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }

    return str; // Return original if unknown format
};

const normalizeEstadoSim = (val) => {
    if (!val) return undefined;
    const str = String(val).trim().toUpperCase();
    const map = {
        "ACTIVA": "ACTIVA",
        "INACTIVA": "INACTIVA",
        "ENVIADA": "ENVIADA",
        "OTRO CANAL": "OTRO CANAL",
        "NO SE ENCONTRO INFORMACIÓN DEL CLIENTE": "No se encontro información del cliente",
        "NO SE ENCONTRO INFORMACION DEL CLIENTE": "No se encontro información del cliente"
    };
    if (map[str]) return map[str];
    // Allow fuzzy match if strictly needed, or just return normalized case if close?
    // User asked "debe listar las opciones disponibles", implying strictness.
    // Let's check if the user wanted strict validation or just normalization.
    // "Variables que aceptan solo valores ya definidos... debe listar las opciones...".
    // For import, we should probably try to match or fallback to uppercase if valid?
    return map[str] || str; // Return mapped or original (allows validation check later)
};

const normalizeTipoVenta = (val) => {
    if (!val) return undefined;
    const str = String(val).trim().toLowerCase();
    const map = {
        "portabilidad": "portabilidad",
        "linea nueva": "linea nueva",
        "línea nueva": "linea nueva", // Common typo
        "ppt": "ppt"
    };
    return map[str] || str;
};

const normalizeNovedad = (val) => {
    if (!val) return undefined;
    const str = String(val).trim().toUpperCase();
    const map = {
        "RECHAZADO": "RECHAZADO",
        "CE": "CE",
        "EN ESPERA": "EN ESPERA",
        "ENVIO PENDIENTE": "ENVIO PENDIENTE",
        "ENVÍO PENDIENTE": "ENVIO PENDIENTE",
        "SIN CONTACTO": "SIN CONTACTO"
    };
    return map[str] || str;
};

export const updateIncome = async (month, updates) => {
    const summary = { updated: 0, skipped: 0, errors: [] };

    if (!month || !updates || updates.length === 0) {
        throw new Error("Month and updates list are required.");
    }

    const salesRef = ref(db, `months/${month}/sales`);

    for (const item of updates) {
        const numero = item.NUMERO;
        if (!numero) {
            summary.errors.push(`Missing NUMERO: ${JSON.stringify(item)}`);
            continue;
        }

        const updateData = {};
        if (item.REGISTRO_SIM !== undefined) updateData.REGISTRO_SIM = item.REGISTRO_SIM;
        if (item.FECHA_INGRESO) updateData.FECHA_INGRESO = normalizeDate(item.FECHA_INGRESO);
        if (item.ICCID) updateData.ICCID = item.ICCID;

        if (Object.keys(updateData).length === 0) {
            summary.skipped++;
            continue;
        }

        try {
            const snapshot = await get(child(salesRef, String(numero)));

            if (snapshot.exists()) {
                await update(child(salesRef, String(numero)), updateData);
                summary.updated++;
            } else {
                summary.errors.push(`Número no encontrado: ${numero} (No se permite crear)`);
            }
        } catch (error) {
            console.error("Error updating income:", error);
            summary.errors.push(`Error updating ${numero}: ${error.message}`);
        }
    }

    return summary;
};

/**
 * Adds a list of sales to the specified month if they don't already exist.
 * ESTA ES LA ÚNICA FUNCIÓN QUE PUEDE CREAR REGISTROS NUEVOS.
 * @param {string} month - e.g., "August_2025"
 * @param {Array} sales - Array of sale objects. Each must have a 'NUMERO' property.
 * @returns {Promise<Object>} - Result summary { added, skipped, errors }
 */
export const addSales = async (month, sales) => {
    const summary = { added: 0, skipped: 0, errors: [] };

    if (!month || !sales || sales.length === 0) {
        throw new Error("Month and sales list are required.");
    }

    const salesRef = ref(db, `months/${month}/sales`);

    const validateNumero = (num) => /^[3]\d{9}$/.test(String(num));
    const validateContacto = (num) => !num || /^[3]\d{9}$/.test(String(num));

    for (const sale of sales) {
        try {
            // 1. Validar NUMERO Obligatorio y Formato
            if (!sale.NUMERO) throw new Error("Missing NUMERO");
            if (!validateNumero(sale.NUMERO)) throw new Error("NUMERO must be 10 digits and start with 3");

            // 2. Prepare Data Object with Defaults and Validations
            const newSale = {
                NUMERO: String(sale.NUMERO),
                REGISTRO_SIM: sale.REGISTRO_SIM === true, // Default to false if not strictly true
                ICCID: sale.ICCID ? String(sale.ICCID) : "", // "ICID" mapped to ICCID
                FECHA_INGRESO: normalizeDate(sale.FECHA_INGRESO) || "",
                FECHA_ACTIVACION: normalizeDate(sale.FECHA_ACTIVACION) || "",
                ESTADO_SIM: normalizeEstadoSim(sale.ESTADO_SIM) || "ACTIVA",
                TIPO_VENTA: normalizeTipoVenta(sale.TIPO_VENTA) || "",
                NOVEDAD_EN_GESTION: normalizeNovedad(sale.NOVEDAD_EN_GESTION) || "",
                CONTACTO_1: sale.CONTACTO_1 || "",
                CONTACTO_2: sale.CONTACTO_2 || "",
                NOMBRE: sale.NOMBRE || "",
                SALDO: sale.SALDO !== undefined && sale.SALDO !== "" ? Number(sale.SALDO) : "",
                ABONO: sale.ABONO !== undefined && sale.ABONO !== "" ? Number(sale.ABONO) : "", // Maps to user's "ABONOS" requirement using existing DB key if compatible, usually singular
                FECHA_CARTERA: normalizeDate(sale.FECHA_CARTERA) || "",
                GUIA: sale.GUIA || "",
                TRANSPORTADORA: sale.TRANSPORTADORA || "",
                NOVEDAD: sale.NOVEDAD || "",
                FECHA_HORA_REPORTE: normalizeDate(sale.FECHA_HORA_REPORTE) || "",
                DESCRIPCION_NOVEDAD: sale.DESCRIPCION_NOVEDAD || "",
                createdAt: new Date().toISOString()
            };

            // 3. Specific Conditional Validations

            // ESTADO_SIM Valid Options
            const validEstadoSim = ["ACTIVA", "INACTIVA", "ENVIADA", "OTRO CANAL", "No se encontro información del cliente", ""];
            if (!validEstadoSim.includes(newSale.ESTADO_SIM)) {
                throw new Error(`Invalid ESTADO_SIM: ${newSale.ESTADO_SIM}`);
            }

            // ENVIADA requires GUIA and TRANSPORTADORA
            if (newSale.ESTADO_SIM === "ENVIADA") {
                if (!newSale.GUIA || !newSale.TRANSPORTADORA) {
                    throw new Error("ESTADO_SIM 'ENVIADA' requires GUIA and TRANSPORTADORA");
                }
            }

            // TIPO_VENTA Valid Options
            const validTipoVenta = ["portabilidad", "linea nueva", "ppt", ""];
            if (!validTipoVenta.includes(newSale.TIPO_VENTA)) {
                throw new Error(`Invalid TIPO_VENTA: ${newSale.TIPO_VENTA}`);
            }

            // NOVEDAD_EN_GESTION Valid Options
            const validNovedadGestion = ["RECHAZADO", "CE", "EN ESPERA", "ENVIO PENDIENTE", ""];
            if (!validNovedadGestion.includes(newSale.NOVEDAD_EN_GESTION)) {
                throw new Error(`Invalid NOVEDAD_EN_GESTION: ${newSale.NOVEDAD_EN_GESTION}`);
            }

            // Contacto Validation
            if (!validateContacto(newSale.CONTACTO_1)) throw new Error("CONTACTO_1 invalid format");
            if (!validateContacto(newSale.CONTACTO_2)) throw new Error("CONTACTO_2 invalid format");


            // 4. Database Check & Insertion
            const snapshot = await get(child(salesRef, String(newSale.NUMERO)));
            if (snapshot.exists()) {
                summary.skipped++;
            } else {
                await set(child(salesRef, String(newSale.NUMERO)), newSale);
                summary.added++;
            }

        } catch (error) {
            console.error("Error adding sale:", error);
            summary.errors.push(`Error adding ${sale.NUMERO || 'unknown'}: ${error.message}`);
        }
    }

    return summary;
};

/**
 * Obtiene todas las ventas de un mes específico
 */
/**
 * Obtiene todas las ventas de un mes específico
 */
export const getSalesByMonth = async (month, sortStrategy = 'FECHA_INGRESO_ASC') => {
    try {
        const snapshot = await get(ref(db, `months/${month}/sales`));
        if (snapshot.exists()) {
            const salesData = snapshot.val();
            return Object.keys(salesData).map(numero => ({
                NUMERO: numero,
                ...salesData[numero]
            })).sort((a, b) => {
                if (sortStrategy === 'CREATED_DESC') {
                    // Original behavior
                    const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                    const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                    return dateB - dateA;
                } else {
                    // New default: Ascending by FECHA_INGRESO
                    const dateA = a.FECHA_INGRESO ? new Date(a.FECHA_INGRESO) : new Date(8640000000000000);
                    const dateB = b.FECHA_INGRESO ? new Date(b.FECHA_INGRESO) : new Date(8640000000000000);
                    return dateA - dateB;
                }
            });
        }
        return [];
    } catch (error) {
        console.error("Error fetching sales:", error);
        throw error;
    }
};

/**
 * Obtiene la lista de todos los meses disponibles
 */
export const getAllMonths = async () => {
    try {
        const snapshot = await get(ref(db, 'months'));
        if (snapshot.exists()) {
            return Object.keys(snapshot.val());
        }
        return [];
    } catch (error) {
        console.error("Error fetching months:", error);
        throw error;
    }
};

/**
 * Escucha cambios en tiempo real de las ventas de un mes específico
 * @param {string} month - Mes a escuchar
 * @param {Function} callback - Función que recibe los datos actualizados
 * @param {string} sortStrategy - 'FECHA_INGRESO_ASC' (default) | 'CREATED_DESC' (original)
 * @returns {Function} - Función para detener el listener (cleanup)
 */
export const listenToSalesByMonth = (month, callback, sortStrategy = 'FECHA_INGRESO_ASC') => {
    const salesRef = ref(db, `months/${month}/sales`);

    const unsubscribe = onValue(salesRef, (snapshot) => {
        if (snapshot.exists()) {
            const salesData = snapshot.val();
            const salesArray = Object.keys(salesData).map(numero => ({
                NUMERO: numero,
                ...salesData[numero]
            })).sort((a, b) => {
                if (sortStrategy === 'CREATED_DESC') {
                    // Original behavior: Descending by createdAt
                    const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                    const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                    return dateB - dateA;
                } else {
                    // New default: Ascending by FECHA_INGRESO
                    // Handle missing dates by placing them at the end (or start?). 
                    // Usually oldest first means items with dates come first in chronological order.
                    // Items without dates should probably be last?
                    const dateA = a.FECHA_INGRESO ? new Date(a.FECHA_INGRESO) : new Date(8640000000000000); // Max Date
                    const dateB = b.FECHA_INGRESO ? new Date(b.FECHA_INGRESO) : new Date(8640000000000000);
                    return dateA - dateB;
                }
            });
            callback(salesArray);
        } else {
            callback([]);
        }
    }, (error) => {
        console.error("Error listening to sales:", error);
        callback([]);
    });

    // Retornar función de limpieza
    return unsubscribe;
};

/**
 * Actualiza información del cliente. NO CREA REGISTROS.
 */
export const updateClientInfo = async (month, updates) => {
    const summary = { updated: 0, skipped: 0, errors: [] };

    if (!month || !updates || updates.length === 0) {
        throw new Error("Month and updates list are required.");
    }

    const salesRef = ref(db, `months/${month}/sales`);

    // Validar solo si el dato existe
    const validateContacto = (num) => !num || /^[3]\d{9}$/.test(String(num));

    for (const item of updates) {
        const numero = item.NUMERO;
        if (!numero) {
            summary.errors.push(`Missing NUMERO: ${JSON.stringify(item)}`);
            continue;
        }

        const updateData = {};

        if (item.CONTACTO_1 !== undefined) {
            if (!validateContacto(item.CONTACTO_1)) {
                summary.errors.push(`Invalid CONTACTO_1 for ${numero}`);
                continue;
            }
            updateData.CONTACTO_1 = item.CONTACTO_1;
        }

        if (item.CONTACTO_2 !== undefined) {
            if (!validateContacto(item.CONTACTO_2)) {
                summary.errors.push(`Invalid CONTACTO_2 for ${numero}`);
                continue;
            }
            updateData.CONTACTO_2 = item.CONTACTO_2;
        }

        if (item.NOMBRE) updateData.NOMBRE = item.NOMBRE;

        if (Object.keys(updateData).length === 0) {
            summary.skipped++;
            continue;
        }

        try {
            const snapshot = await get(child(salesRef, String(numero)));

            if (snapshot.exists()) {
                await update(child(salesRef, String(numero)), updateData);
                summary.updated++;
            } else {
                summary.errors.push(`Número no encontrado: ${numero} (No se permite crear)`);
            }
        } catch (error) {
            console.error("Error updating client info:", error);
            summary.errors.push(`Error updating ${numero}: ${error.message}`);
        }
    }

    return summary;
};

/**
 * Actualiza fecha de activación. NO CREA REGISTROS.
 */
export const updateActivationDate = async (month, updates) => {
    const summary = { updated: 0, skipped: 0, errors: [] };

    if (!month || !updates || updates.length === 0) {
        throw new Error("Month and updates list are required.");
    }

    const salesRef = ref(db, `months/${month}/sales`);

    for (const item of updates) {
        const numero = item.NUMERO;
        if (!numero) {
            summary.errors.push(`Missing NUMERO: ${JSON.stringify(item)}`);
            continue;
        }

        const updateData = {};
        if (item.FECHA_ACTIVACION) updateData.FECHA_ACTIVACION = normalizeDate(item.FECHA_ACTIVACION);

        if (Object.keys(updateData).length === 0) {
            summary.skipped++;
            continue;
        }

        try {
            const snapshot = await get(child(salesRef, String(numero)));

            if (snapshot.exists()) {
                await update(child(salesRef, String(numero)), updateData);
                summary.updated++;
            } else {
                summary.errors.push(`Número no encontrado: ${numero} (No se permite crear)`);
            }
        } catch (error) {
            console.error("Error updating activation date:", error);
            summary.errors.push(`Error updating ${numero}: ${error.message}`);
        }
    }

    return summary;
};

/**
 * Actualiza estado de SIM. NO CREA REGISTROS.
 */
export const updateSimStatus = async (month, updates) => {
    const summary = { updated: 0, skipped: 0, errors: [] };

    if (!month || !updates || updates.length === 0) {
        throw new Error("Month and updates list are required.");
    }

    const salesRef = ref(db, `months/${month}/sales`);

    for (const item of updates) {
        const numero = item.NUMERO;
        if (!numero) {
            summary.errors.push(`Missing NUMERO: ${JSON.stringify(item)}`);
            continue;
        }

        const updateData = {};
        if (item.ESTADO_SIM !== undefined) {
            const normalized = normalizeEstadoSim(item.ESTADO_SIM);
            const validEstadoSim = ["ACTIVA", "INACTIVA", "ENVIADA", "OTRO CANAL", "No se encontro información del cliente", ""];
            // Check normalized or original? Normalized should map to valid.
            if (!validEstadoSim.includes(normalized)) {
                // Try generous check? or strict? User asked for strict options.
                summary.errors.push(`Invalid ESTADO_SIM for ${numero}: ${item.ESTADO_SIM}`);
                continue;
            }
            updateData.ESTADO_SIM = normalized;
        }
        if (item.ICCID) updateData.ICCID = item.ICCID;

        // If 'ENVIADA', we strictly assume user handles GUIA/TRANSPORTADORA elsewhere or in same update if provided,
        // but for safety, if just updating status we warn if they are missing? 
        // For now, simpler update functions might not check cross-fields unless passed. 
        // We will assume UI enforces it or we just check if it IS 'ENVIADA' in the update payload.
        // NOTE: The previous `addSales` implementation enforced it. Here we are doing a patch update.
        // It's safer to allow the update but maybe log it. Ideally the specialized page ensures data quality.

        if (Object.keys(updateData).length === 0) {
            summary.skipped++;
            continue;
        }

        try {
            const snapshot = await get(child(salesRef, String(numero)));

            if (snapshot.exists()) {
                await update(child(salesRef, String(numero)), updateData);
                summary.updated++;
            } else {
                summary.errors.push(`Número no encontrado: ${numero} (No se permite crear)`);
            }
        } catch (error) {
            console.error("Error updating SIM status:", error);
            summary.errors.push(`Error updating ${numero}: ${error.message}`);
        }
    }

    return summary;
};

/**
 * Actualiza tipo de venta. NO CREA REGISTROS.
 */
export const updateSalesType = async (month, updates) => {
    const summary = { updated: 0, skipped: 0, errors: [] };

    if (!month || !updates || updates.length === 0) {
        throw new Error("Month and updates list are required.");
    }

    const salesRef = ref(db, `months/${month}/sales`);

    for (const item of updates) {
        const numero = item.NUMERO;
        if (!numero) {
            summary.errors.push(`Missing NUMERO: ${JSON.stringify(item)}`);
            continue;
        }

        const updateData = {};
        if (item.TIPO_VENTA !== undefined) {
            const normalized = normalizeTipoVenta(item.TIPO_VENTA);
            const validTipoVenta = ["portabilidad", "linea nueva", "ppt", ""];
            if (!validTipoVenta.includes(normalized)) {
                summary.errors.push(`Invalid TIPO_VENTA for ${numero}: ${item.TIPO_VENTA}`);
                continue;
            }
            updateData.TIPO_VENTA = normalized;
        }

        if (Object.keys(updateData).length === 0) {
            summary.skipped++;
            continue;
        }

        try {
            const snapshot = await get(child(salesRef, String(numero)));

            if (snapshot.exists()) {
                await update(child(salesRef, String(numero)), updateData);
                summary.updated++;
            } else {
                summary.errors.push(`Número no encontrado: ${numero} (No se permite crear)`);
            }
        } catch (error) {
            console.error("Error updating sales type:", error);
            summary.errors.push(`Error updating ${numero}: ${error.message}`);
        }
    }

    return summary;
};

/**
 * Actualiza Novedad en Gestión. NO CREA REGISTROS.
 */
export const updateManagementStatus = async (month, updates) => {
    const summary = { updated: 0, skipped: 0, errors: [] };
    if (!month || !updates) throw new Error("Month and updates required.");
    const salesRef = ref(db, `months/${month}/sales`);

    for (const item of updates) {
        const numero = item.NUMERO;
        if (!numero) {
            summary.errors.push(`Missing NUMERO: ${JSON.stringify(item)}`);
            continue;
        }
        const updateData = {};
        if (item.NOVEDAD_EN_GESTION !== undefined) {
            const normalized = normalizeNovedad(item.NOVEDAD_EN_GESTION);
            const validNovedadGestion = ["RECHAZADO", "CE", "EN ESPERA", "ENVIO PENDIENTE", ""];
            if (!validNovedadGestion.includes(normalized)) {
                summary.errors.push(`Invalid NOVEDAD_EN_GESTION for ${numero}: ${item.NOVEDAD_EN_GESTION}`);
                continue;
            }
            updateData.NOVEDAD_EN_GESTION = normalized;
        }

        if (Object.keys(updateData).length === 0) {
            summary.skipped++;
            continue;
        }

        try {
            const snapshot = await get(child(salesRef, String(numero)));
            if (snapshot.exists()) {
                await update(child(salesRef, String(numero)), updateData);
                summary.updated++;
            } else {
                summary.errors.push(`Número no encontrado: ${numero} (No se permite crear)`);
            }
        } catch (error) {
            summary.errors.push(`Error ${numero}: ${error.message}`);
        }
    }
    return summary;
};

/**
 * Actualiza Cartera. NO CREA REGISTROS.
 */
export const updatePortfolio = async (month, updates) => {
    const summary = { updated: 0, skipped: 0, errors: [] };
    if (!month || !updates) throw new Error("Month and updates required.");
    const salesRef = ref(db, `months/${month}/sales`);

    for (const item of updates) {
        const numero = item.NUMERO;
        if (!numero) {
            summary.errors.push(`Missing NUMERO: ${JSON.stringify(item)}`);
            continue;
        }
        const updateData = {};
        if (item.SALDO) updateData.SALDO = item.SALDO;
        if (item.ABONO) updateData.ABONO = item.ABONO;
        if (item.FECHA_CARTERA) updateData.FECHA_CARTERA = normalizeDate(item.FECHA_CARTERA);

        if (Object.keys(updateData).length === 0) {
            summary.skipped++;
            continue;
        }

        try {
            const snapshot = await get(child(salesRef, String(numero)));
            if (snapshot.exists()) {
                await update(child(salesRef, String(numero)), updateData);
                summary.updated++;
            } else {
                summary.errors.push(`Número no encontrado: ${numero} (No se permite crear)`);
            }
        } catch (error) {
            summary.errors.push(`Error ${numero}: ${error.message}`);
        }
    }
    return summary;
};

/**
 * Actualiza Guías. NO CREA REGISTROS.
 */
export const updateGuides = async (month, updates) => {
    const summary = { updated: 0, skipped: 0, errors: [] };
    if (!month || !updates) throw new Error("Month and updates required.");
    const salesRef = ref(db, `months/${month}/sales`);

    for (const item of updates) {
        const numero = item.NUMERO;
        if (!numero) {
            summary.errors.push(`Missing NUMERO: ${JSON.stringify(item)}`);
            continue;
        }
        const updateData = {};
        if (item.GUIA) updateData.GUIA = item.GUIA;
        if (item.ESTADO_GUIA) updateData.ESTADO_GUIA = item.ESTADO_GUIA;
        if (item.TRANSPORTADORA) updateData.TRANSPORTADORA = item.TRANSPORTADORA;
        if (item.NOVEDAD) updateData.NOVEDAD = item.NOVEDAD;
        if (item.FECHA_HORA_REPORTE) updateData.FECHA_HORA_REPORTE = normalizeDate(item.FECHA_HORA_REPORTE);
        if (item.DESCRIPCION_NOVEDAD) updateData.DESCRIPCION_NOVEDAD = item.DESCRIPCION_NOVEDAD;

        if (Object.keys(updateData).length === 0) {
            summary.skipped++;
            continue;
        }

        try {
            const snapshot = await get(child(salesRef, String(numero)));
            if (snapshot.exists()) {
                await update(child(salesRef, String(numero)), updateData);
                summary.updated++;
            } else {
                summary.errors.push(`Número no encontrado: ${numero} (No se permite crear)`);
            }
        } catch (error) {
            summary.errors.push(`Error ${numero}: ${error.message}`);
        }
    }
    return summary;
};

/**
 * Importa o actualiza una lista masiva de ventas desde un Excel.
 * - Crea registros nuevos si no existen.
 * - Actualiza registros existentes con la información proporcionada.
 * @param {string} month - Mes de operación
 * @param {Array} salesData - Datos crudos del Excel
 * @returns {Promise<Object>} - Resumen del proceso
 */
export const importSales = async (month, salesData) => {
    const summary = { added: 0, updated: 0, skipped: 0, errors: [] };

    if (!month || !salesData || salesData.length === 0) {
        throw new Error("Month and data are required.");
    }

    const salesRef = ref(db, `months/${month}/sales`);

    const validateNumero = (num) => /^[3]\d{9}$/.test(String(num));

    for (const rawSale of salesData) {
        try {
            // 1. Validar NUMERO Obligatorio
            if (!rawSale.NUMERO) {
                summary.errors.push(`Fila sin NÚMERO: ${JSON.stringify(rawSale)}`);
                continue;
            }

            const numero = String(rawSale.NUMERO);
            if (!validateNumero(numero)) {
                summary.errors.push(`Formato de NÚMERO inválido: ${numero}`);
                continue;
            }

            // 2. Preparar objeto de datos limpio
            // Mapeamos lo que venga del excel a nuestro esquema.
            // Asumimos que los keys del objeto salesData ya vienen "limpios" (mapeados desde el excel en el frontend)
            // O bien, normalizamos aquí. En este caso, asumiremos que el Frontend envía keys correctos (NUMERO, NOMBRE...)

            const saleToProcess = {
                NUMERO: numero,
                // Boolean conversion helpers
                REGISTRO_SIM: rawSale.REGISTRO_SIM === 'SÍ' || rawSale.REGISTRO_SIM === true || rawSale.REGISTRO_SIM === 'TRUE',
                ICCID: rawSale.ICCID ? String(rawSale.ICCID) : undefined,
                FECHA_INGRESO: normalizeDate(rawSale.FECHA_INGRESO) || undefined,
                FECHA_ACTIVACION: normalizeDate(rawSale.FECHA_ACTIVACION) || undefined,
                ESTADO_SIM: normalizeEstadoSim(rawSale.ESTADO_SIM) || undefined,
                TIPO_VENTA: normalizeTipoVenta(rawSale.TIPO_VENTA) || undefined,
                NOVEDAD_EN_GESTION: normalizeNovedad(rawSale.NOVEDAD_EN_GESTION) || undefined,
                CONTACTO_1: rawSale.CONTACTO_1 ? String(rawSale.CONTACTO_1) : undefined,
                CONTACTO_2: rawSale.CONTACTO_2 ? String(rawSale.CONTACTO_2) : undefined,
                NOMBRE: rawSale.NOMBRE || undefined,
                SALDO: rawSale.SALDO !== undefined ? Number(rawSale.SALDO) : undefined,
                ABONO: rawSale.ABONO !== undefined ? Number(rawSale.ABONO) : undefined,
                FECHA_CARTERA: normalizeDate(rawSale.FECHA_CARTERA) || undefined,
                GUIA: rawSale.GUIA || undefined,
                TRANSPORTADORA: rawSale.TRANSPORTADORA || undefined,
                ESTADO_GUIA: rawSale.ESTADO_GUIA || undefined,
                NOVEDAD: rawSale.NOVEDAD || undefined,
                FECHA_HORA_REPORTE: normalizeDate(rawSale.FECHA_HORA_REPORTE) || undefined,
                DESCRIPCION_NOVEDAD: rawSale.DESCRIPCION_NOVEDAD || undefined
            };


            // 3. Verificar existencia
            const snapshot = await get(child(salesRef, numero));

            if (snapshot.exists()) {
                // UPDATE: Merge exististing data with new non-undefined data
                // Remove undefined keys to avoid deleting existing data if we used 'set', 
                // but for 'update' undefineds are ignored locally but good to be clean.
                // Actually 'update' with undefined might throw or remove? Firebase js sdk ignores undefined usually.
                // Let's filter undefineds just in case.
                const updateData = {};
                Object.keys(saleToProcess).forEach(key => {
                    if (saleToProcess[key] !== undefined && key !== 'NUMERO') {
                        updateData[key] = saleToProcess[key];
                    }
                });

                if (Object.keys(updateData).length > 0) {
                    await update(child(salesRef, numero), updateData);
                    summary.updated++;
                } else {
                    summary.skipped++; // No actionable data to update
                }

            } else {
                // CREATE: Need defaults for mandatory fields if not present?
                // Our schema is quite loose, basically everything is optional except NUMERO.
                // We just save what we have.
                const newSale = {
                    ...saleToProcess,
                    REGISTRO_SIM: saleToProcess.REGISTRO_SIM || false, // Default only strictly required logic
                    createdAt: new Date().toISOString()
                };

                // Clean undefineds for SET as well
                const cleanNewSale = {};
                Object.keys(newSale).forEach(key => {
                    if (newSale[key] !== undefined) {
                        cleanNewSale[key] = newSale[key];
                    }
                });

                await set(child(salesRef, numero), cleanNewSale);
                summary.added++;
            }

        } catch (error) {
            console.error("Error importing sale:", error);
            summary.errors.push(`Error en fila: ${JSON.stringify(rawSale)} - ${error.message}`);
        }
    }

    return summary;
};

/**
 * Elimina una lista de ventas (por NUMERO) de un mes específico.
 * @param {string} month - Mes de operación
 * @param {Array} numeros - Lista de números (IDs) a eliminar
 * @returns {Promise<Object>} - Resumen { deleted, errors }
 */
export const deleteSales = async (month, numeros) => {
    const summary = { deleted: 0, errors: [] };

    if (!month || !numeros || numeros.length === 0) {
        throw new Error("Month and list of numbers are required.");
    }

    const salesRef = ref(db, `months/${month}/sales`);

    for (const numero of numeros) {
        try {
            await remove(child(salesRef, String(numero)));
            summary.deleted++;
        } catch (error) {
            console.error(`Error deleting ${numero}:`, error);
            summary.errors.push(`Error al eliminar ${numero}: ${error.message}`);
        }
    }

    return summary;
};

