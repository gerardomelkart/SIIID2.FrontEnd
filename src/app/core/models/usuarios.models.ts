export interface UsuariosListadoResponse {
  esValido: boolean;
  total: number;
  usuarios: UsuarioListadoItem[];
}

export interface UsuarioListadoItem {
  idUsuario: number;
  usuario: string;
  nombreCompleto: string;
  correoElectronico: string;
  rol: string;
  idEntidadFederativa: number | null;
  entidadFederativa: string | null;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  activo: boolean;
}

export interface UsuarioDetalleResponse {
  esValido: boolean;
  codigo: string;
  mensaje: string;
  usuario: UsuarioDetalle | null;
}

export interface UsuarioDetalle {
  idUsuario: number;
  usuario: string;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  correoElectronico: string;
  rfc: string;
  curp: string;
  telefonoContacto: string | null;
  idEntidadFederativa: number | null;
  entidadFederativa: string | null;
  idRol: number;
  rol: string;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  fechaAlta: string;
  fechaModificacion: string;
  activo: boolean;
}

export interface CrearUsuarioRequest {
  usuario: string;
  password: string;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  correoElectronico: string;
  rfc: string;
  curp: string;
  telefonoContacto: string | null;
  idEntidadFederativa: number | null;
  rol: string;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
}

export interface EditarUsuarioRequest {
  usuario: string;
  nuevaPassword: string | null;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  correoElectronico: string;
  rfc: string;
  curp: string;
  telefonoContacto: string | null;
  idEntidadFederativa: number | null;
  rol: string;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
}

export interface ReactivarUsuarioRequest {
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
}

export interface UsuarioOperacionResponse {
  esValido: boolean;
  codigo: string;
  mensaje: string;
  idUsuario?: number;
  errores?: UsuarioValidacionError[];
}

export interface UsuarioValidacionError {
  campo: string;
  codigo: string;
  mensaje: string;
}