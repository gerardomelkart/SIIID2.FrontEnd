import {
  CargaValidacionResponse,
  ConfirmarCargaRequest,
  ConfirmarCargaResponse,
} from './carga.models';

export type TipoContenidoSemanal = 'SOLO_SEMANA' | 'ACUMULADO_MES';
export type TipoCargaSemanal = 'CARGA_INICIAL' | 'ACTUALIZACION';

export interface SemanalCargaPeriodoRequest {
  tipoCarga: TipoCargaSemanal;
  tipoContenido: TipoContenidoSemanal;
  anioSemana: number;
  numeroSemana: number;
  fechaInicioSemana: string;
  mesCorte: number;
  anioCorte: number;
  idEntidadFederativa?: number | null;
}

export interface SemanalCargaCeroRequest {
  idDelito: number;
  idEntidadFederativa?: number | null;
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

export interface SemanalVentanaCarga {
  fechaMinimaPermitida: string;
  fechaMaximaPermitida: string;
  permiteMesAnterior: boolean;
}

export interface SemanalCargaBloque {
  anioSemana: number;
  numeroSemana: number;
  fechaInicioSemana: string;
  fechaFinSemana: string;
  anioCorte: number;
  mesCorte: number;
  fechaInicioTramo: string;
  fechaFinTramo: string;
  totalCarpetas: number;
  totalDelitos: number;
  totalVictimas: number;
  reemplazaInformacion: boolean;
}

export interface SemanalCargaValidacionResponse extends CargaValidacionResponse {
  tipoCarga: TipoCargaSemanal;
  periodo: SemanalPeriodoCarga | null;
  ventana: SemanalVentanaCarga | null;
  bloques: SemanalCargaBloque[];
  totalCarpetasIncluidas: number;
  totalDelitosIncluidos: number;
  totalVictimasIncluidas: number;
  totalCarpetasExcluidas: number;
  totalDelitosExcluidos: number;
  totalVictimasExcluidas: number;
}

export interface SemanalSemanaDisponibilidadResponse {
  esValido: boolean;
  disponible: boolean;
  tieneCargaConfirmada: boolean;
  existeOperacionPendiente: boolean;
  codigo: string;
  mensaje: string;
  codigoReferenciaPendiente: string | null;
  estadoPendiente: string | null;
  tipoCargaPendiente: TipoCargaSemanal | null;
  pendientePropia: boolean;
  puedeResolverPendiente: boolean;
  debeUsarActualizacion: boolean;
}

export type { ConfirmarCargaRequest, ConfirmarCargaResponse };
