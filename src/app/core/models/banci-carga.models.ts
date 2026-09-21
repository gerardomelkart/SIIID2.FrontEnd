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
  vistaPrevia?: BanciVistaPrevia | null;
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

export interface BanciVistaPrevia { puedeAceptar?: boolean; motivoBloqueo?: string | null; huella: string; totalCambios: number; resumen: { tipo: string; altas: number; actualizaciones: number; sinCambio: number }[]; cambios: { tipo: string; idCi: string; idDelito: string | null; idVictima: string | null; campo: string; anterior: string | null; nuevo: string | null }[]; }
