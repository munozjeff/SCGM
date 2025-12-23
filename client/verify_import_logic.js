
import * as XLSX from 'xlsx';

// Mock data as if read from Excel
// Scenario 1: Correct headers
const data1 = [
    { "NUMERO": "3001234567", "REGISTRO_SIM": "LLEGO" }
];
// Scenario 2: Human headers (spaces)
const data2 = [
    { "NUMERO": "3001234567", "REGISTRO SIM": "LLEGO" }
];
// Scenario 3: Mixed case / bad headers
const data3 = [
    { "Numero": "3001234567", "REgistrO Sim": "LLEGO" }
];

// Current Logic Simulation
function processCurrent(data) {
    return data.map(row => {
        const numero = row['NUMERO'] || row['Numero'] || row['numero'];
        const registro = row['REGISTRO SIM'] || row['Registro Sim'] || row['REGISTRO_SIM'];

        const obj = {};
        if (numero) obj.NUMERO = String(numero).trim();
        if (registro !== undefined && registro !== null && String(registro).trim() !== '') obj.REGISTRO_SIM = String(registro).trim();
        return obj;
    }).filter(r => r.NUMERO);
}

// Proposed Logic Simulation
function processProposed(data) {
    return data.map(row => {
        // Normalize keys: uppercase, replace spaces with _, etc. or just search generic
        const keys = Object.keys(row);
        const getKey = (target) => keys.find(k => k.trim().toUpperCase().replace(/_/g, ' ') === target);

        // Target: "NUMERO"
        const keyNumero = keys.find(k => k.trim().toUpperCase() === 'NUMERO'); // Simple match
        // Target: "REGISTRO SIM" or "REGISTRO_SIM"
        const keyRegistro = keys.find(k => {
            const clean = k.trim().toUpperCase().replace(/_/g, ' ');
            return clean === 'REGISTRO SIM';
        });

        const numero = keyNumero ? row[keyNumero] : undefined;
        let registro = keyRegistro ? row[keyRegistro] : undefined;

        const obj = {};
        if (numero) obj.NUMERO = String(numero).trim();
        if (registro !== undefined && registro !== null && String(registro).trim() !== '') obj.REGISTRO_SIM = String(registro).trim();

        return obj;
    }).filter(r => r.NUMERO);
}

console.log("--- Current Logic ---");
console.log("Data 1 (Perfect):", processCurrent(data1));
console.log("Data 2 (Standard):", processCurrent(data2));
console.log("Data 3 (Messy):", processCurrent(data3));

console.log("\n--- Proposed Logic ---");
console.log("Data 1 (Perfect):", processProposed(data1));
console.log("Data 2 (Standard):", processProposed(data2));
console.log("Data 3 (Messy):", processProposed(data3));
