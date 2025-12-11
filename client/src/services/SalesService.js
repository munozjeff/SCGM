import { db } from "../firebase";
import { ref, set, get, child, update } from "firebase/database";

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
        if (item.REGISTRO_SIM) updateData.REGISTRO_SIM = item.REGISTRO_SIM;
        if (item.FECHA_INGRESO) updateData.FECHA_INGRESO = item.FECHA_INGRESO;

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

    for (const sale of sales) {
        const numero = sale.NUMERO;
        if (!numero) {
            summary.errors.push(`Sale missing NUMERO: ${JSON.stringify(sale)}`);
            continue;
        }

        try {
            const snapshot = await get(child(salesRef, String(numero)));
            if (snapshot.exists()) {
                summary.skipped++;
            } else {
                await set(child(salesRef, String(numero)), sale);
                summary.added++;
            }
        } catch (error) {
            console.error("Error adding sale:", error);
            summary.errors.push(`Error adding ${numero}: ${error.message}`);
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
 * Actualiza información del cliente. NO CREA REGISTROS.
 */
export const updateClientInfo = async (month, updates) => {
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
        if (item.CONTACTO_1) updateData.CONTACTO_1 = item.CONTACTO_1;
        if (item.CONTACTO_2) updateData.CONTACTO_2 = item.CONTACTO_2;
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
        if (item.ESTADO_SIM) updateData.ESTADO_SIM = item.ESTADO_SIM;
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
        if (item.TIPO_VENTA) updateData.TIPO_VENTA = item.TIPO_VENTA;

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
        if (item.NOVEDAD_EN_GESTION) updateData.NOVEDAD_EN_GESTION = item.NOVEDAD_EN_GESTION;

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
