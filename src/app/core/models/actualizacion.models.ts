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