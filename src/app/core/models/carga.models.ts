export interface CargaValidacionResponse {
  esValido: boolean;
  codigoReferencia: string;
  totalErrores: number;
  mensaje: string;
  resumenValidacion: CargaValidacionResumenItem[];
  errores: CargaValidacionError[];
}

export interface CargaValidacionResumenItem {
  archivo: string;
  codigo: string;
  descripcion: string;
  totalRegistros: number;
  esError: boolean;
}

export interface CargaValidacionError {
  archivo: string;
  fila: number | null;
  columna: string;
  campo: string;
  valor: string | null;
  codigo: string;
  descripcionResumen: string;
  mensaje: string;
}

export interface ConfirmarCargaRequest {
  codigoReferencia: string;
  aceptar: boolean;
}

export interface ConfirmarCargaResponse {
  esValido: boolean;
  codigoReferencia: string;
  estado: string;
  mensaje: string;
}