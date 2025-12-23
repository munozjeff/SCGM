
// Verification Script for Date Parsing Fix (Matches implemented logic)
// Copy-paste of the implementation in SalesService.js
const normalizeDate = (value) => {
    if (!value) return undefined;

    // 1. If it's already a JS Date
    if (value instanceof Date) {
        return value.toISOString().split('T')[0];
    }

    // 2. If it's an Excel Serial Number (e.g. 45000) - passed as number
    if (typeof value === 'number' && value > 20000) {
        const date = new Date((value - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
    }

    // 3. If it's a string
    const str = String(value).trim();
    if (!str) return undefined;

    // NEW: Check if it's a numeric string that looks like an Excel serial (e.g. "45283")
    if (/^\d{5}$/.test(str) && Number(str) > 20000) {
        const date = new Date((Number(str) - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
    }

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
    { input: 45283, expected: "2023-12-23", desc: "Number 45283" },
    { input: "45283", expected: "2023-12-23", desc: "String '45283'" }, // The Fix!
    { input: "23/12/2025", expected: "2025-12-23", desc: "DD/MM/YYYY" },
    { input: "2025-12-23", expected: "2025-12-23", desc: "YYYY-MM-DD" }
];

let failed = false;
console.log("Running Verification...");
cases.forEach(c => {
    const result = normalizeDate(c.input);
    const success = result === c.expected;
    if (!success) failed = true;
    console.log(`[${success ? 'PASS' : 'FAIL'}] ${c.desc}: Got '${result}', Expected '${c.expected}'`);
});

if (!failed) console.log("\n✅ ALL TESTS PASSED");
else console.log("\n❌ TESTS FAILED");
