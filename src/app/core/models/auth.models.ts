export type ClaveModulo = 'MENSUAL' | 'SEMANAL';

export interface LoginRequest {
  usuario: string;
  password: string;
}

export interface LoginResponse {
  esValido: boolean;
  mensaje: string;
  token: string;
  expiraEnMinutos: number;
  usuario: UsuarioLoginInfo | null;
}

export interface ModuloUsuarioInfo {
  idModulo: number;
  clave: ClaveModulo;
  nombre: string;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  administraDelitos: boolean;
}

export interface UsuarioLoginInfo {
  idUsuario: number;
  usuario: string;
  nombre: string;
  nombreCompleto: string;
  rol: string;
  idEntidadFederativa: number | null;
  entidadFederativa: string | null;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  modulos: ModuloUsuarioInfo[];
  requiereCambioPassword: boolean;
}

export interface CambiarPasswordRequest {
  nuevaPassword: string;
  confirmarPassword: string;
}

export interface CambiarPasswordResponse {
  esValido: boolean;
  codigo: string;
  mensaje: string;
}