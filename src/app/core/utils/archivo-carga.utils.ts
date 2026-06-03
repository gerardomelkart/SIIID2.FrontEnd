import { CargaValidacionResumenItem } from '../models/carga.models';
import { ArchivoCargaTipo, ArchivosCargaSeleccionados } from '../types/archivo-carga.types';

export function obtenerArchivoDesdeEvento(event: Event): File | null {
  const input = event.target as HTMLInputElement;
  return input.files?.[0] ?? null;
}

export function actualizarArchivoSeleccionado(
  archivos: ArchivosCargaSeleccionados,
  tipo: ArchivoCargaTipo,
  archivo: File | null,
): ArchivosCargaSeleccionados {
  return {
    ...archivos,
    [tipo]: archivo,
  };
}

export function tieneTresArchivosSeleccionados(archivos: ArchivosCargaSeleccionados): boolean {
  return !!archivos.carpetas && !!archivos.delitos && !!archivos.victimas;
}

export function obtenerResumenPorArchivo(
  resumen: CargaValidacionResumenItem[],
  archivo: ArchivoCargaTipo,
): CargaValidacionResumenItem[] {
  return resumen.filter((item) => item.archivo?.toLowerCase() === archivo.toLowerCase());
}

export function crearArchivosCargaVacios(): ArchivosCargaSeleccionados {
  return {
    carpetas: null,
    delitos: null,
    victimas: null,
  };
}
