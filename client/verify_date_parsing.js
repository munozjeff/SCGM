
// Mock of the current normalizeDate function in SalesService.js
const normalizeDate = (value) => {
    if (!value) return undefined;

    // 1. If it's already a JS Date
    if (value instanceof Date) {
        return value.toISOString().split('T')[0];
    }

    // 2. If it's an Excel Serial Number (e.g. 45000)
    if (typeof value === 'number' && value > 20000) {
        const date = new Date((value - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
    }

    // 3. If it's a string
    const str = String(value).trim();
    if (!str) return undefined;

    // Try to detect DD/MM/YYYY or D/M/YYYY
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
    }

    // Try YYYY-MM-DD
    const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymdMatch) {
        return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
    }

    const date = new Date(str);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }

    return str;
};

// Test Cases
const cases = [
    { input: 45283, desc: "Excel Serial Number (Number)" }, // 2023-12-23 approx
    { input: "45283", desc: "Excel Serial Number (String)" }, // The likely BUG case
    { input: "23/12/2025", desc: "DD/MM/YYYY String" },
    { input: "2025-12-23", desc: "YYYY-MM-DD String" },
    { input: "23-12-2025", desc: "DD-MM-YYYY String" },
    { input: new Date("2025-12-23"), desc: "JS Date Object" }
];

console.log("Running Date Normalization Tests:\n");
cases.forEach(c => {
    const result = normalizeDate(c.input);
    console.log(`[${c.desc}] Input: ${typeof c.input} '${c.input}' -> Output: '${result}'`);
});
