import { ConfirmarCargaResponse } from './carga.models';

export interface SemanalCargaBloqueAdministracionItem {
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

export interface SemanalCargaPendienteAdministracionItem {
  idSemanalCarga: number;
  codigoReferencia: string;
  tipoCarga: string;
  tipoContenido: string;
  idEntidadFederativa: number | null;
  entidadFederativa: string;
  anioSemana: number;
  numeroSemana: number;
  fechaInicioSemana: string;
  fechaFinSemana: string;
  fechaInicioTramo: string;
  fechaFinTramo: string;
  mesCorte: number;
  anioCorte: number;
  fechaValidacion: string;
  idUsuarioCarga: number;
  usuarioCarga: string;
  nombreUsuarioCarga: string;
  totalCarpetasIncluidas: number;
  totalDelitosIncluidos: number;
  totalVictimasIncluidas: number;
  totalCarpetasExcluidas: number;
  totalDelitosExcluidos: number;
  totalVictimasExcluidas: number;
  totalAdvertencias: number;
  bloques: SemanalCargaBloqueAdministracionItem[];
}

export interface SemanalCargaAdvertenciaAdministracionItem {
  idSemanalCargaAdvertencia: number;
  codigo: string;
  archivo: string;
  numeroFila: number | null;
  columna: string | null;
  campo: string | null;
  valor: string | null;
  descripcionResumen: string;
  mensaje: string;
  aceptadaUsuario: boolean;
  fechaAceptacion: string | null;
}

export interface SemanalCargaPendienteAdministracionDetalle
  extends SemanalCargaPendienteAdministracionItem {
  advertencias: SemanalCargaAdvertenciaAdministracionItem[];
}

export interface SemanalCargasPendientesAdministracionResponse {
  esValido: boolean;
  total: number;
  registros: SemanalCargaPendienteAdministracionItem[];
}

export interface SemanalCargaPendienteAdministracionDetalleResponse {
  esValido: boolean;
  detalle: SemanalCargaPendienteAdministracionDetalle;
}

export interface RechazarCargaSemanalAdministracionRequest {
  motivo: string;
}

export type ResolverCargaSemanalAdministracionResponse = ConfirmarCargaResponse;
