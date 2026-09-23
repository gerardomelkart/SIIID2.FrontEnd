export function fechaBanci(fecha = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
}

export function nombreExcelBanci(tipo: string, entidad: string, noBanci?: string | null, fecha?: string | null): string {
  const limpiar = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100);
  const dia = fecha && /^\d{4}-\d{2}-\d{2}/.test(fecha) ? fecha.slice(0, 10) : fechaBanci();
  return noBanci ? `${limpiar(noBanci)}_${limpiar(tipo)}.xlsx` : `BANCI_${limpiar(tipo)}_${limpiar(entidad) || 'ENTIDAD'}_${dia}.xlsx`;
}
