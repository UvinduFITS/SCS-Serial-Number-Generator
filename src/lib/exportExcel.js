import * as XLSX from 'xlsx'

export function exportToExcel(rows, filename) {
  const worksheetData = rows.map((row) => ({
    'Date & Time': new Date(row.created_at).toLocaleString(),
    'User': row.user_email,
    'Shipment Type': row.shipment_type,
    'Number Type': row.number_type_label,
    'Reference Number': row.reference_number,
  }))

  const worksheet = XLSX.utils.json_to_sheet(worksheetData)
  worksheet['!cols'] = [
    { wch: 22 },
    { wch: 32 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Log')
  XLSX.writeFile(workbook, filename)
}
