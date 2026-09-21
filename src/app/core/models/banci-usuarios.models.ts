export interface BanciUsuariosListadoResponse {
  esValido: boolean;
  total: number;
  usuarios: BanciUsuarioDetalle[];
}

export interface BanciUsuarioDetalleResponse {
  esValido: boolean;
  codigo: string;
  mensaje: string;
  usuario: BanciUsuarioDetalle | null;
}

export interface BanciUsuarioDetalle {
  idUsuario: number;
  idEntidadFederativa: number | null;
  entidadFederativa: string | null;
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
  habilitaBanci: boolean;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  activo: boolean;
  activoCuenta: boolean;
  tieneBanci: boolean;
  tieneOtrosModulos: boolean;
  fechaAlta: string;
  fechaModificacion: string;
}

export interface BanciUsuarioDatos {
  idEntidadFederativa: number | null;
  usuario: string;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  correoElectronico: string;
  rfc: string | null;
  curp: string | null;
  telefonoContacto: string | null;
  rol: string;
  habilitaBanci: boolean;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
}

export interface CrearUsuarioBanciRequest extends BanciUsuarioDatos {
  password: string;
}

export interface EditarUsuarioBanciRequest extends BanciUsuarioDatos {
  nuevaPassword: string | null;
}

export interface ReactivarUsuarioBanciRequest {
  habilitaBanci: boolean;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
}

export interface BanciUsuarioOperacionResponse {
  esValido: boolean;
  codigo: string;
  mensaje: string;
  idUsuario?: number;
  errores?: BanciUsuarioValidacionError[];
}

export interface BanciUsuarioValidacionError {
  campo: string;
  codigo: string;
  mensaje: string;
}

export interface PermisosGlobalesBanciRequest {
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
}

export interface ActualizarPermisosBanciRequest extends PermisosGlobalesBanciRequest {
  habilitaBanci: boolean;
}
