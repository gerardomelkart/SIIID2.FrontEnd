export type TipoReporte = 'ENVIOS' | 'CARGAS' | 'SABANAS' | 'ORIGINALES';

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
  estado: string;
  estadoTexto: string;
  esConfirmado: boolean;
  codigoReferenciaConfirmada: string | null;
  tipoCargaConfirmada: string | null;
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

export interface UltimosArchivosEntidadArchivo {
  tipo: string;
  nombreOriginal: string;
  nombreGuardado: string;
  rutaRelativa: string;
  tamanioBytes: number;
  sha256: string;
}

export interface UltimosArchivosEntidadResumen {
  idEntidadFederativa: number;
  codigoReferencia: string;
  tipoMovimiento: TipoCargaInforme;
  mesCorte: number;
  anioCorte: number;
  fechaGuardado: string;
  archivos: UltimosArchivosEntidadArchivo[];
}

export interface UltimosArchivosEntidadResponse {
  esValido: boolean;
  total: number;
  registros: UltimosArchivosEntidadResumen[];
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