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
  habilitaMensual: boolean;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  habilitaSemanal: boolean;
  habilitaCargaSemanal: boolean;
  administraDelitosSemanal: boolean;
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
  habilitaMensual: boolean;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  habilitaSemanal: boolean;
  habilitaCargaSemanal: boolean;
  administraDelitosSemanal: boolean;
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
  habilitaMensual: boolean;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  habilitaSemanal: boolean;
  habilitaCargaSemanal: boolean;
  administraDelitosSemanal: boolean;
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
  habilitaMensual: boolean;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  habilitaSemanal: boolean;
  habilitaCargaSemanal: boolean;
  administraDelitosSemanal: boolean;
}

export interface CrearUsuarioSemanalRequest {
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
  habilitaSemanal: boolean;
  habilitaCargaSemanal: boolean;
  administraDelitosSemanal: boolean;
}

export interface EditarUsuarioSemanalRequest {
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
  habilitaSemanal: boolean;
  habilitaCargaSemanal: boolean;
  administraDelitosSemanal: boolean;
}

export interface ReactivarUsuarioRequest {
  habilitaMensual: boolean;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
}

export interface ReactivarUsuarioSemanalRequest {
  habilitaSemanal: boolean;
  habilitaCargaSemanal: boolean;
  administraDelitosSemanal: boolean;
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

export interface PermisosGlobalesUsuariosRequest {
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
}

export interface ActualizarPermisosSemanalesRequest {
  habilitaSemanal: boolean;
  habilitaCargaSemanal: boolean;
  administraDelitosSemanal: boolean;
}
