import {
  CargaValidacionResponse,
  ConfirmarCargaRequest,
  ConfirmarCargaResponse,
} from './carga.models';

export type TipoContenidoSemanal = 'SOLO_SEMANA';
export type TipoCargaSemanal = 'CARGA_INICIAL' | 'ACTUALIZACION';

export interface SemanalCargaPeriodoRequest {
  tipoCarga: TipoCargaSemanal;
  tipoContenido: TipoContenidoSemanal;
  anioSemana: number;
  numeroSemana: number;
  fechaInicioSemana: string;
  mesCorte: number;
  anioCorte: number;
}

export interface SemanalPeriodoCarga {
  tipoContenido: TipoContenidoSemanal;
  anioSemana: number;
  numeroSemana: number;
  fechaInicioSemana: string;
  fechaFinSemana: string;
  fechaInicioTramo: string;
  fechaFinTramo: string;
  mesCorte: number;
  anioCorte: number;
}

export interface SemanalCargaValidacionResponse extends CargaValidacionResponse {
  tipoCarga: TipoCargaSemanal;
  periodo: SemanalPeriodoCarga | null;
  totalCarpetasIncluidas: number;
  totalDelitosIncluidos: number;
  totalVictimasIncluidas: number;
  totalCarpetasExcluidas: number;
  totalDelitosExcluidos: number;
  totalVictimasExcluidas: number;
}

export interface SemanalSemanaActualizacionResponse {
  esValido: boolean;
  disponible: boolean;
  codigo: string;
  mensaje: string;
  codigoReferenciaPendiente: string | null;
  estadoPendiente: string | null;
}

export type { ConfirmarCargaRequest, ConfirmarCargaResponse };
