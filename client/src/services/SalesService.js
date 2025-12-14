import { db } from "../firebase";
import { ref, set, get, child, update, onValue } from "firebase/database";

/**
 * Actualiza ingresos (REGISTRO_SIM, FECHA_INGRESO) para una lista de números.
 * @param {string} month - Mes de operación
 * @param {Array} updates - Lista de objetos { NUMERO, REGISTRO_SIM, FECHA_INGRESO }
 * @returns {Promise<Object>} - Resumen { updated, skipped, errors }
 */
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
        if (item.FECHA_INGRESO) updateData.FECHA_INGRESO = item.FECHA_INGRESO;
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
                FECHA_INGRESO: sale.FECHA_INGRESO || "",
                FECHA_ACTIVACION: sale.FECHA_ACTIVACION || "",
                ESTADO_SIM: sale.ESTADO_SIM || "",
                TIPO_VENTA: sale.TIPO_VENTA || "",
                NOVEDAD_EN_GESTION: sale.NOVEDAD_EN_GESTION || "",
                CONTACTO_1: sale.CONTACTO_1 || "",
                CONTACTO_2: sale.CONTACTO_2 || "",
                NOMBRE: sale.NOMBRE || "",
                SALDO: sale.SALDO !== undefined && sale.SALDO !== "" ? Number(sale.SALDO) : "",
                ABONO: sale.ABONO !== undefined && sale.ABONO !== "" ? Number(sale.ABONO) : "", // Maps to user's "ABONOS" requirement using existing DB key if compatible, usually singular
                FECHA_CARTERA: sale.FECHA_CARTERA || "",
                GUIA: sale.GUIA || "",
                TRANSPORTADORA: sale.TRANSPORTADORA || "",
                NOVEDAD: sale.NOVEDAD || "",
                FECHA_HORA_REPORTE: sale.FECHA_HORA_REPORTE || "",
                DESCRIPCION_NOVEDAD: sale.DESCRIPCION_NOVEDAD || ""
            };

            // 3. Specific Conditional Validations

            // ESTADO_SIM Valid Options
            const validEstadoSim = ["ACTIVA", "INACTIVA", "ENVIADA", "No se encontro información del cliente", ""];
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
            const validNovedadGestion = ["RECHAZADO", "CE", "EN ESPERA", ""];
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
export const getSalesByMonth = async (month) => {
    try {
        const snapshot = await get(ref(db, `months/${month}/sales`));
        if (snapshot.exists()) {
            const salesData = snapshot.val();
            return Object.keys(salesData).map(numero => ({
                NUMERO: numero,
                ...salesData[numero]
            }));
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
 * @returns {Function} - Función para detener el listener (cleanup)
 */
export const listenToSalesByMonth = (month, callback) => {
    const salesRef = ref(db, `months/${month}/sales`);

    const unsubscribe = onValue(salesRef, (snapshot) => {
        if (snapshot.exists()) {
            const salesData = snapshot.val();
            const salesArray = Object.keys(salesData).map(numero => ({
                NUMERO: numero,
                ...salesData[numero]
            }));
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
        if (item.FECHA_ACTIVACION) updateData.FECHA_ACTIVACION = item.FECHA_ACTIVACION;

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
            const validEstadoSim = ["ACTIVA", "INACTIVA", "ENVIADA", "No se encontro información del cliente", ""];
            if (!validEstadoSim.includes(item.ESTADO_SIM)) {
                summary.errors.push(`Invalid ESTADO_SIM for ${numero}: ${item.ESTADO_SIM}`);
                continue;
            }
            updateData.ESTADO_SIM = item.ESTADO_SIM;
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
            const validTipoVenta = ["portabilidad", "linea nueva", "ppt", ""];
            if (!validTipoVenta.includes(item.TIPO_VENTA)) {
                summary.errors.push(`Invalid TIPO_VENTA for ${numero}: ${item.TIPO_VENTA}`);
                continue;
            }
            updateData.TIPO_VENTA = item.TIPO_VENTA;
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
            const validNovedadGestion = ["RECHAZADO", "CE", "EN ESPERA", ""];
            if (!validNovedadGestion.includes(item.NOVEDAD_EN_GESTION)) {
                summary.errors.push(`Invalid NOVEDAD_EN_GESTION for ${numero}: ${item.NOVEDAD_EN_GESTION}`);
                continue;
            }
            updateData.NOVEDAD_EN_GESTION = item.NOVEDAD_EN_GESTION;
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
        if (item.FECHA_CARTERA) updateData.FECHA_CARTERA = item.FECHA_CARTERA;

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
        if (item.FECHA_HORA_REPORTE) updateData.FECHA_HORA_REPORTE = item.FECHA_HORA_REPORTE;
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
