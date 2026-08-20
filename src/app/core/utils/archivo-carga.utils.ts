import { CargaValidacionResumenItem } from '../models/carga.models';
import { ArchivoCargaTipo, ArchivosCargaSeleccionados } from '../types/archivo-carga.types';

export interface ArchivoCargaNoLegible {
  tipo: ArchivoCargaTipo;
  archivo: File;
}

export function obtenerArchivoDesdeEvento(event: Event): File | null {
  const input = event.target as HTMLInputElement;
  return input.files?.[0] ?? null;
}

export async function esArchivoCargaLegible(archivo: File): Promise<boolean> {
  try {
    await archivo.slice(0, 1).arrayBuffer();
    return true;
  } catch {
    return false;
  }
}

export async function obtenerArchivoCargaNoLegible(archivos: ArchivosCargaSeleccionados): Promise<ArchivoCargaNoLegible | null> {
  const tipos: ArchivoCargaTipo[] = ['carpetas', 'delitos', 'victimas'];

  for (const tipo of tipos) {
    const archivo = archivos[tipo];

    if (archivo && !(await esArchivoCargaLegible(archivo))) return { tipo, archivo };
  }

  return null;
}

export function obtenerMensajeArchivoCargaNoLegible(archivo: File): string {
  return `No se pudo leer el archivo "${archivo.name}". Ciérrelo en Excel y selecciónelo nuevamente.`;
}

export function esErrorEnvioArchivos(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && (error as { status?: unknown }).status === 0;
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