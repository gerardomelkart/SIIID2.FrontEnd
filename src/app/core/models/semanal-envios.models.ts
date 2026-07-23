import { TipoCargaSemanal } from './semanal-carga.models';

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
  anioSemana?: number | null;
  numeroSemana?: number | null;
  tipoCarga?: string | null;
  estado?: string | null;
}
