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
  idBanciCarga: number;
  estado: string;
  fechaCarga: string | null;
  aceptadaUsuario: boolean | null;
  idUsuarioConfirmacion: number | null;
  fechaConfirmacion: string | null;
  yaResuelta: boolean;
  totalAltas: number;
  totalActualizaciones: number;
  totalSinCambio: number;
  totalAdvertencias: number;
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
