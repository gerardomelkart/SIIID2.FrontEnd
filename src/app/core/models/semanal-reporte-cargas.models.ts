import { TipoCargaSemanal } from './semanal-carga.models';

export interface SemanalReporteCargaItem {
  idEntidadFederativa: number;
  entidadFederativa: string;
  claveEntidad: string;
  idUsuarioCarga: number;
  usuarioCarga: string;
  nombreUsuarioCarga: string;
  anioCorte: number;
  mesCorte: number;
  periodo: string;
  intentos: number;
  ultimoIntento: string | null;
  tipoCargaUltimoIntento: TipoCargaSemanal | null;
  estatusUltimoIntento: string | null;
  fechaCargaActualizacion: string | null;
  fechaCargaActualizacionTexto: string;
  fechaAprobacion: string | null;
  fechaAprobacionTexto: string;
  fechaCargaExitosa: string | null;
}

export interface SemanalReporteCargasResponse {
  esValido: boolean;
  idEntidadFederativa: number | null;
  idUsuarioCarga: number | null;
  anioCorte: number | null;
  mesCorte: number | null;
  total: number;
  registros: SemanalReporteCargaItem[];
}

export interface SemanalReporteCargasFiltro {
  idEntidadFederativa?: number | null;
  idUsuarioCarga?: number | null;
  anioCorte?: number | null;
  mesCorte?: number | null;
}