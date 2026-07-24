import { TipoCargaSemanal } from './semanal-carga.models';

export interface SemanalReporteCargaItem {
  idEntidadFederativa: number;
  entidadFederativa: string;
  claveEntidad: string;
  anioSemana: number;
  numeroSemana: number;
  semana: string;
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
  anioSemana: number | null;
  numeroSemana: number | null;
  total: number;
  registros: SemanalReporteCargaItem[];
}

export interface SemanalReporteCargasFiltro {
  idEntidadFederativa?: number | null;
  anioSemana?: number | null;
  numeroSemana?: number | null;
}