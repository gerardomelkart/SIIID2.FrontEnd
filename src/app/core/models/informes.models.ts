export type TipoReporte = 'ENVIOS' | 'CARGAS' | 'SABANAS';

export type TipoCargaInforme = 'CARGA_INICIAL' | 'ACTUALIZACION' | string;

export interface InformeEnvioItem {
  idCarga: number;
  codigoReferencia: string;
  tipoCarga: TipoCargaInforme;
  idEntidadFederativa: number;
  entidadFederativa: string;
  claveEntidad: string;
  fechaEnvio: string;
  fechaEnvioTexto: string;
  mesCorte: number;
  anioCorte: number;
  corte: string;
  usuarioEnvio: string;
  endpointAcuse: string;
  endpointExcel: string;
}

export interface InformeReporteCargaItem {
  idEntidadFederativa: number;
  entidadFederativa: string;
  claveEntidad: string;
  mesCorte: number;
  anioCorte: number;
  corte: string;
  intentos: number;
  ultimoIntento: string | null;
  tipoCargaUltimoIntento: TipoCargaInforme | null;
  estatusUltimoIntento: string | null;
  fechaUltimaCarga: string | null;
  fechaUltimaCargaTexto: string;
}

export interface InformeReporteCargasResponse {
  esValido: boolean;
  mesCorte: number | null;
  anioCorte: number | null;
  total: number;
  registros: InformeReporteCargaItem[];
}

export interface InformeEnviosFiltro {
  idEntidadFederativa?: number | null;
  mesCorte?: number | null;
  anioCorte?: number | null;
}

export interface InformeReporteCargasFiltro {
  idEntidadFederativa?: number | null;
  mesCorte?: number | null;
  anioCorte?: number | null;
}

export interface CorteOperativo {
  mesCorte: number;
  anioCorte: number;
  corte: string;
}

export interface PeriodoCorteInforme {
  mesCorte: number;
  anioCorte: number;
  corte: string;
}