export interface SemanalArchivoOriginalItem {
  tipo: string;
  nombreOriginal: string;
  rutaRelativa: string;
  tamanioBytes: number;
  sha256: string;
}

export interface SemanalArchivosOriginalesResumen {
  idEntidadFederativa: number;
  codigoReferencia: string;
  tipoMovimiento: string;
  tipoContenido: string;
  anioSemana: number;
  numeroSemana: number;
  fechaInicioSemana: string;
  fechaFinSemana: string;
  fechaInicioTramo: string;
  fechaFinTramo: string;
  mesCorte: number;
  anioCorte: number;
  fechaGuardado: string;
  archivos: SemanalArchivoOriginalItem[];
}

export interface SemanalArchivosOriginalesResponse {
  esValido: boolean;
  total: number;
  registros: SemanalArchivosOriginalesResumen[];
}