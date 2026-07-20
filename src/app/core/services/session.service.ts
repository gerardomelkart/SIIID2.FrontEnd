import { Injectable, computed, signal } from '@angular/core';
import { LoginResponse, ModuloUsuarioInfo, UsuarioLoginInfo } from '../models/auth.models';

const TOKEN_KEY = 'siiid_token';
const USER_KEY = 'siiid_usuario';
const EXPIRES_AT_KEY = 'siiid_token_expira_en';
const MODULO_ACTIVO_KEY = 'siiid_modulo_activo';

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private usuarioSignal = signal<UsuarioLoginInfo | null>(this.cargarUsuarioDesdeStorage());
  private tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private moduloActivoSignal = signal<ModuloUsuarioInfo | null>(
    this.cargarModuloActivoDesdeStorage(this.usuarioSignal()),
  );

  usuario = computed(() => this.usuarioSignal());
  token = computed(() => this.tokenSignal());
  modulos = computed(() => this.usuarioSignal()?.modulos ?? []);
  moduloActivo = computed(() => this.moduloActivoSignal());
  tieneMultiplesModulos = computed(() => this.modulos().length > 1);

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
    const modulo = this.moduloActivoSignal();
    return modulo ? modulo.habilitaCarga : this.usuarioSignal()?.habilitaCarga === true;
  });

  habilitaModificacion = computed(() => {
    const modulo = this.moduloActivoSignal();
    return modulo ? modulo.habilitaModificacion : this.usuarioSignal()?.habilitaModificacion === true;
  });

  administraDelitos = computed(() => {
    return this.moduloActivoSignal()?.administraDelitos === true;
  });

  requiereCambioPassword = computed(() => {
    return this.usuarioSignal()?.requiereCambioPassword === true;
  });

  guardarSesion(response: LoginResponse): void {
    if (!response.token || !response.usuario) {
      this.limpiarSesion();
      return;
    }

    const usuario = this.normalizarUsuario(response.usuario);
    const expiraEnMs = Date.now() + response.expiraEnMinutos * 60 * 1000;

    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(usuario));
    localStorage.setItem(EXPIRES_AT_KEY, expiraEnMs.toString());
    localStorage.removeItem(MODULO_ACTIVO_KEY);

    this.tokenSignal.set(response.token);
    this.usuarioSignal.set(usuario);
    this.moduloActivoSignal.set(null);

    if (usuario.modulos.length === 1) {
      this.seleccionarModulo(usuario.modulos[0].clave);
    }
  }

  seleccionarModulo(clave: string): boolean {
    const claveNormalizada = clave.trim().toUpperCase();
    const modulo = this.modulos().find((item) => item.clave.toUpperCase() === claveNormalizada);

    if (!modulo) {
      return false;
    }

    localStorage.setItem(MODULO_ACTIVO_KEY, modulo.clave);
    this.moduloActivoSignal.set(modulo);

    return true;
  }

  limpiarModuloActivo(): void {
    localStorage.removeItem(MODULO_ACTIVO_KEY);
    this.moduloActivoSignal.set(null);
  }

  obtenerRutaModulo(clave: string): string {
    return clave.toUpperCase() === 'SEMANAL' ? '/semanal' : '/';
  }

  limpiarSesion(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRES_AT_KEY);
    localStorage.removeItem(MODULO_ACTIVO_KEY);

    this.tokenSignal.set(null);
    this.usuarioSignal.set(null);
    this.moduloActivoSignal.set(null);
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
      const usuario = JSON.parse(raw) as UsuarioLoginInfo | null;
      return usuario ? this.normalizarUsuario(usuario) : null;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }

  private cargarModuloActivoDesdeStorage(usuario: UsuarioLoginInfo | null): ModuloUsuarioInfo | null {
    const modulos = usuario?.modulos ?? [];

    if (modulos.length === 0) {
      localStorage.removeItem(MODULO_ACTIVO_KEY);
      return null;
    }

    const claveGuardada = localStorage.getItem(MODULO_ACTIVO_KEY);
    const moduloGuardado = modulos.find(
      (item) => item.clave.toUpperCase() === claveGuardada?.toUpperCase(),
    );

    if (moduloGuardado) {
      return moduloGuardado;
    }

    if (modulos.length === 1) {
      localStorage.setItem(MODULO_ACTIVO_KEY, modulos[0].clave);
      return modulos[0];
    }

    localStorage.removeItem(MODULO_ACTIVO_KEY);
    return null;
  }

  private normalizarUsuario(usuario: UsuarioLoginInfo): UsuarioLoginInfo {
    if (Array.isArray(usuario.modulos)) {
      return usuario;
    }

    return {
      ...usuario,
      modulos: [
        {
          idModulo: 0,
          clave: 'MENSUAL',
          nombre: 'SIIID2 Mensual',
          habilitaCarga: usuario.habilitaCarga,
          habilitaModificacion: usuario.habilitaModificacion,
          administraDelitos: false,
        },
      ],
    };
  }
}