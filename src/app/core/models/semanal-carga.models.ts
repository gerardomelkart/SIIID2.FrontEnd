import {
  CargaValidacionResponse,
  ConfirmarCargaRequest,
  ConfirmarCargaResponse,
} from './carga.models';

export type TipoContenidoSemanal = 'SOLO_SEMANA' | 'ACUMULADO_MES';

export interface SemanalCargaPeriodoRequest {
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
  periodo: SemanalPeriodoCarga | null;
  totalCarpetasIncluidas: number;
  totalDelitosIncluidos: number;
  totalVictimasIncluidas: number;
  totalCarpetasExcluidas: number;
  totalDelitosExcluidos: number;
  totalVictimasExcluidas: number;
}

export type { ConfirmarCargaRequest, ConfirmarCargaResponse };