import { TipoCargaSemanal } from './semanal-carga.models';

export interface SemanalEnvioBloqueItem {
  idSemanalCarga: number;
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

export interface SemanalEnvioPeriodoItem {
  idSemanalCarga: number;
  anioCorte: number;
  mesCorte: number;
}

export interface SemanalEnvioItem {
  idSemanalCarga: number;
  codigoReferencia: string;
  tipoCarga: TipoCargaSemanal;
  idEntidadFederativa: number;
  entidadFederativa: string;
  claveEntidad: string;
  anioSemana: number;
  numeroSemana: number;
  fechaInicioSemana: string;
  fechaFinSemana: string;
  fechaInicioTramo: string;
  fechaFinTramo: string;
  mesCorte: number;
  anioCorte: number;
  periodo: string;
  periodos: SemanalEnvioPeriodoItem[];
  idUsuarioCarga: number;
  usuarioCarga: string;
  nombreUsuarioCarga: string;
  totalCarpetasIncluidas: number;
  totalDelitosIncluidos: number;
  totalVictimasIncluidas: number;
  totalAdvertencias: number;
  estado: string;
  estadoTexto: string;
  fechaCarga: string;
  fechaValidacion: string | null;
  fechaConfirmacion: string | null;
  fechaMovimiento: string;
  motivoRechazo: string | null;
  usuarioResolucion: string | null;
  esConfirmado: boolean;
  esPendiente: boolean;
  puedeResolverPendiente: boolean;
  endpointAcuse: string;
  endpointArchivos: string;
  fechaEnvioTexto: string;
  semana: string;
  bloques: SemanalEnvioBloqueItem[];
  esRechazadoAdministrador: boolean;
  tieneStagingDisponible: boolean;
  fechaRechazoTexto: string;
}

export interface SemanalEnviosResponse {
  esValido: boolean;
  total: number;
  registros: SemanalEnvioItem[];
}

export interface SemanalEnviosFiltro {
  idEntidadFederativa?: number | null;
  idUsuarioCarga?: number | null;
  anioCorte?: number | null;
  mesCorte?: number | null;
  tipoCarga?: string | null;
  estado?: string | null;
}

export interface SemanalReportePreliminarEntidadItem {
  idEntidadFederativa: number;
  entidadFederativa: string;
}

export interface SemanalReportePreliminarDelitoItem {
  idDelito: number;
  claveDelito: string;
  delito: string;
}

export interface SemanalReportePreliminarOpcionesResponse {
  esValido: boolean;
  entidades: SemanalReportePreliminarEntidadItem[];
  delitos: SemanalReportePreliminarDelitoItem[];
}