export interface ActualizacionPeriodoResponse {
  esValido: boolean;
  puedeActualizar: boolean;
  tieneCargaConfirmada: boolean;
  existeActualizacionPendiente: boolean;
  codigoActualizacionPendiente: string | null;
  idEntidadFederativa: number | null;
  mesCorte: number;
  anioCorte: number;
  mensaje: string;
}

export interface ActualizacionDiferenciasResponse {
  esValido: boolean;
  codigoReferencia: string;
  mensaje: string;
  carpetas: ActualizacionDiferenciaRegistro[];
  delitos: ActualizacionDiferenciaRegistro[];
  victimas: ActualizacionDiferenciaRegistro[];
}

export interface ActualizacionDiferenciaRegistro {
  tipoMovimiento: string;
  campoIdentificador: string;
  identificadorFiscalia: string;
  camposModificados: ActualizacionCampoDiferencia[];
}

export interface ActualizacionCampoDiferencia {
  campo: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
}