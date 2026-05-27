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

export interface UsuarioLoginInfo {
  idUsuario: number;
  usuario: string;
  nombreCompleto: string;
  rol: string;
  idEntidadFederativa: number | null;
  entidadFederativa: string | null;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
}