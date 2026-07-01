import { Injectable, computed, signal } from '@angular/core';
import { LoginResponse, UsuarioLoginInfo } from '../models/auth.models';

const TOKEN_KEY = 'siiid_token';
const USER_KEY = 'siiid_usuario';
const EXPIRES_AT_KEY = 'siiid_token_expira_en';

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private usuarioSignal = signal<UsuarioLoginInfo | null>(this.cargarUsuarioDesdeStorage());
  private tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  usuario = computed(() => this.usuarioSignal());
  token = computed(() => this.tokenSignal());

  estaAutenticado = computed(() => {
    const token = this.tokenSignal();

    if (!token) {
      return false;
    }

    const expiraEn = localStorage.getItem(EXPIRES_AT_KEY);

    if (!expiraEn) {
      return true;
    }

    return Date.now() < Number(expiraEn);
  });

  habilitaCarga = computed(() => {
    return this.usuarioSignal()?.habilitaCarga === true;
  });

  habilitaModificacion = computed(() => {
    return this.usuarioSignal()?.habilitaModificacion === true;
  });

  requiereCambioPassword = computed(() => {
    return this.usuarioSignal()?.requiereCambioPassword === true;
  });

  guardarSesion(response: LoginResponse): void {
    if (!response.token || !response.usuario) {
      this.limpiarSesion();
      return;
    }

    const expiraEnMs = Date.now() + response.expiraEnMinutos * 60 * 1000;

    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.usuario));
    localStorage.setItem(EXPIRES_AT_KEY, expiraEnMs.toString());

    this.tokenSignal.set(response.token);
    this.usuarioSignal.set(response.usuario);
  }

  limpiarSesion(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRES_AT_KEY);

    this.tokenSignal.set(null);
    this.usuarioSignal.set(null);
  }

  marcarCambioPasswordRequerido(): void {
    const usuario = this.usuarioSignal();

    if (!usuario) {
      return;
    }

    const usuarioActualizado: UsuarioLoginInfo = {
      ...usuario,
      requiereCambioPassword: true,
    };

    localStorage.setItem(USER_KEY, JSON.stringify(usuarioActualizado));

    this.usuarioSignal.set(usuarioActualizado);
  }

  private cargarUsuarioDesdeStorage(): UsuarioLoginInfo | null {
    const raw = localStorage.getItem(USER_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as UsuarioLoginInfo;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }
}
