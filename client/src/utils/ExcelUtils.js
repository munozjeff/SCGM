import * as XLSX from 'xlsx';

/**
 * Generates and downloads an Excel template with the specified columns.
 * @param {string[]} columns - Array of column headers (e.g., ['NUMERO', 'ESTADO_SIM'])
 * @param {string} filename - Name of the file to download (without extension)
 */
export const downloadTemplate = (columns, filename = 'template') => {
    // Create a worksheet with just the headers
    const ws = XLSX.utils.aoa_to_sheet([columns]);

    // Create a new workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");

    // Write and download
    XLSX.writeFile(wb, `${filename}.xlsx`);
};
