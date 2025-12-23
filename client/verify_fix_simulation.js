
// Verification Script for Fixed Import Logic
// Mimics the exact logic pasted into IncomeUpdate.jsx

const dataScenarios = [
    // 1. Standard correct
    { "NUMERO": "3001111111", "REGISTRO_SIM": "LLEGO" },
    // 2. Spaces instead of underscores
    { "NUMERO": "3002222222", "REGISTRO SIM": "NO LLEGO" },
    // 3. Mixed case + spaces
    { "Numero": "3003333333", "Registro Sim": "LLEGO" },
    // 4. Weird casing + underscores
    { "NUMERO": "3004444444", "ReGiStRo_SiM": "NO LLEGO" },
    // 5. Extra spaces
    { "  NUMERO  ": "3005555555", "  REGISTRO  SIM  ": "LLEGO" },
    // 6. Missing optional fields
    { "NUMERO": "3006666666" }
];

function processRows(data) {
    return data.map(row => {
        // Normalize keys for this row
        const keys = Object.keys(row);
        const normalizedRow = {};

        keys.forEach(key => {
            // Create a normalized key: UPPERCASE, underscores replacing spaces, trimmed
            // Example: "Registro Sim " -> "REGISTRO_SIM"
            let normKey = String(key).trim().toUpperCase();
            // Replace multiple spaces/underscores with single underscore
            normKey = normKey.replace(/[\s_]+/g, '_');

            normalizedRow[normKey] = row[key];
        });

        // Extract values using normalized keys or fallbacks
        const numero = normalizedRow['NUMERO'];
        const registro = normalizedRow['REGISTRO_SIM'];
        const fecha = normalizedRow['FECHA_INGRESO'];
        const iccid = normalizedRow['ICCID'];

        const obj = { NUMERO: String(numero || '').trim() };

        if (registro !== undefined && registro !== null && String(registro).trim() !== '') {
            obj.REGISTRO_SIM = String(registro).trim();
        }
        if (fecha !== undefined && fecha !== null && String(fecha).trim() !== '') {
            obj.FECHA_INGRESO = String(fecha).trim();
        }
        if (iccid !== undefined && iccid !== null && String(iccid).trim() !== '') {
            obj.ICCID = String(iccid).trim();
        }

        return obj;
    }).filter(r => r.NUMERO);
}

const results = processRows(dataScenarios);
console.log(JSON.stringify(results, null, 2));

// Assertions
const passed = results.length === 6 &&
    results[0].REGISTRO_SIM === 'LLEGO' &&
    results[1].REGISTRO_SIM === 'NO LLEGO' &&
    results[2].REGISTRO_SIM === 'LLEGO' &&
    results[3].REGISTRO_SIM === 'NO LLEGO' &&
    results[4].REGISTRO_SIM === 'LLEGO' &&
    Object.keys(results[5]).length === 1; // Only NUMERO

if (passed) {
    console.log("\n✅ VERIFICATION PASSED: All scenarios handled correctly.");
} else {
    console.error("\n❌ VERIFICATION FAILED.");
}
