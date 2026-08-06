import { CargaValidacionError } from '../models/carga.models';
import { exportarFilasExcel } from './excel-export.utils';

type TipoDetalleValidacion = 'Error' | 'Advertencia';

export async function exportarValidacionExcel(
  errores: CargaValidacionError[],
  advertencias: CargaValidacionError[],
  nombreArchivo: string,
): Promise<boolean> {
  const filas = [
    ...errores.map((detalle) => crearFilaValidacion('Error', detalle)),
    ...advertencias.map((detalle) => crearFilaValidacion('Advertencia', detalle)),
  ];

  return exportarFilasExcel(
    filas,
    normalizarNombreArchivo(nombreArchivo),
    'Validacion',
  );
}

function crearFilaValidacion(
  tipo: TipoDetalleValidacion,
  detalle: CargaValidacionError,
) {
  return {
    Tipo: tipo,
    Archivo: detalle.archivo || '',
    Fila: detalle.fila ?? '',
    Columna: detalle.columna || '',
    Campo: detalle.campo || '',
    Valor: detalle.valor ?? '',
    Código: detalle.codigo || '',
    Descripción: detalle.descripcionResumen || '',
    Mensaje: detalle.mensaje || '',
  };
}

function normalizarNombreArchivo(nombreArchivo: string): string {
  const nombre = nombreArchivo
    .trim()
    .replace(/\.xlsx$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, '_');

  return `${nombre || 'validacion'}.xlsx`;
}