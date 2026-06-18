import { ConfirmarCargaResponse } from './carga.models';

export interface CargaPendienteAdministracionItem {
  idCarga: number;
  codigoReferencia: string;
  tipoCarga: string;
  idEntidadFederativa: number | null;
  entidadFederativa: string;
  mesCorte: number;
  anioCorte: number;
  fechaValidacion: string;
  idUsuarioCarga: number;
  usuarioCarga: string;
  nombreUsuarioCarga: string;
  totalCarpetas: number;
  totalDelitos: number;
  totalVictimas: number;
  totalAdvertencias: number;
}

export interface CargaAdvertenciaAdministracionItem {
  idCargaAdvertencia: number;
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

export interface CargaPendienteAdministracionDetalle extends CargaPendienteAdministracionItem {
  advertencias: CargaAdvertenciaAdministracionItem[];
}

export interface CargasPendientesAdministracionResponse {
  esValido: boolean;
  total: number;
  registros: CargaPendienteAdministracionItem[];
}

export interface CargaPendienteAdministracionDetalleResponse {
  esValido: boolean;
  detalle: CargaPendienteAdministracionDetalle;
}

export interface RechazarCargaAdministracionRequest {
  motivo: string;
}

export type ResolverCargaAdministracionResponse = ConfirmarCargaResponse;
