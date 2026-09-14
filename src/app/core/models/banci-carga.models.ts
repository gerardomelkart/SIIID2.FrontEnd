export interface BanciCargaValidacionError {
  archivo: string;
  hoja: string | null;
  numeroFila: number | null;
  campo: string | null;
  valor: string | null;
  codigo: string;
  mensaje: string;
}

export interface BanciCargaValidacionResponse {
  esValido: boolean;
  codigoReferencia: string;
  modalidadIngreso: string;
  totalCarpetas: number;
  totalDelitos: number;
  totalVictimas: number;
  mensaje: string;
  errores: BanciCargaValidacionError[];
  advertencias: BanciCargaValidacionError[];
}