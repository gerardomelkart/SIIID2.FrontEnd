import { UltimosArchivosEntidadArchivo } from './informes.models';

export interface FederalArchivosOriginalesResumen {
  idUsuarioCarga: number;
  codigoReferencia: string;
  tipoMovimiento: string;
  mesCorte: number;
  anioCorte: number;
  fechaGuardado: string;
  archivos: UltimosArchivosEntidadArchivo[];
}

export interface FederalArchivosOriginalesResponse {
  esValido: boolean;
  total: number;
  registros: FederalArchivosOriginalesResumen[];
}
