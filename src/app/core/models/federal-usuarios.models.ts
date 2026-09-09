export interface FederalUsuariosListadoResponse {
  esValido: boolean;
  total: number;
  usuarios: FederalUsuarioDetalle[];
}

export interface FederalUsuarioDetalleResponse {
  esValido: boolean;
  codigo: string;
  mensaje: string;
  usuario: FederalUsuarioDetalle | null;
}

export interface FederalUsuarioDetalle {
  idUsuario: number;
  usuario: string;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  nombreCompleto: string;
  correoElectronico: string;
  rfc: string | null;
  curp: string | null;
  telefonoContacto: string | null;
  idRol: number;
  rol: string;
  habilitaFederal: boolean;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  activo: boolean;
  activoCuenta: boolean;
  tieneFederal: boolean;
  tieneOtrosModulos: boolean;
  fechaAlta: string;
  fechaModificacion: string;
}

export interface FederalUsuarioDatos {
  usuario: string;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  correoElectronico: string;
  rfc: string | null;
  curp: string | null;
  telefonoContacto: string | null;
  rol: string;
  habilitaFederal: boolean;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
}

export interface CrearUsuarioFederalRequest extends FederalUsuarioDatos {
  password: string;
}

export interface EditarUsuarioFederalRequest extends FederalUsuarioDatos {
  nuevaPassword: string | null;
}

export interface ReactivarUsuarioFederalRequest {
  habilitaFederal: boolean;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
}

export interface FederalUsuarioOperacionResponse {
  esValido: boolean;
  codigo: string;
  mensaje: string;
  idUsuario?: number;
  errores?: FederalUsuarioValidacionError[];
}

export interface FederalUsuarioValidacionError {
  campo: string;
  codigo: string;
  mensaje: string;
}