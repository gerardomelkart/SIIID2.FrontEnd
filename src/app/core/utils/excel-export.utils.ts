export type ExcelCellValue = string | number | boolean | Date | null | undefined;
export type ExcelRow = Record<string, ExcelCellValue>;

export async function exportarFilasExcel(
  filas: ExcelRow[],
  nombreArchivo: string,
  nombreHoja = 'Datos'
): Promise<boolean> {
  if (!filas.length) {
    return false;
  }

  const XLSX = await import('xlsx');

  const filasNormalizadas = filas.map(fila => normalizarFilaExcel(fila));
  const worksheet = XLSX.utils.json_to_sheet(filasNormalizadas);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    sanitizarNombreHoja(nombreHoja)
  );

  XLSX.writeFile(workbook, nombreArchivo);

  return true;
}

function normalizarFilaExcel(fila: ExcelRow): Record<string, string | number | boolean | Date> {
  return Object.entries(fila).reduce((acumulado, [columna, valor]) => {
    acumulado[columna] = valor ?? '';
    return acumulado;
  }, {} as Record<string, string | number | boolean | Date>);
}

function sanitizarNombreHoja(nombreHoja: string): string {
  const nombreLimpio = nombreHoja
    .replace(/[\\/*?:[\]]/g, '')
    .trim();

  return (nombreLimpio || 'Datos').slice(0, 31);
}