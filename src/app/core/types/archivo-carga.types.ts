export type ArchivoCargaTipo = 'carpetas' | 'delitos' | 'victimas';

export interface ArchivosCargaSeleccionados {
  carpetas: File | null;
  delitos: File | null;
  victimas: File | null;
}
