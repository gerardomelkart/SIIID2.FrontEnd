import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { API_BASE_URL } from '../constants/api-endpoints.constants';
import { ModuloUsuarioInfo } from '../models/auth.models';
import { SessionService } from './session.service';

export interface SistemaModulo { clave: string; nombre: string; activo: boolean; }
export interface SistemaOpcion { modulo: string; clave: string; descripcion: string; habilitado: boolean; disponible: boolean; efectivo: boolean; }
export interface SistemaConfiguracion { version: number; modulos: SistemaModulo[]; opciones: SistemaOpcion[]; }
export interface SistemaCambio { modulo: string; clave: string; habilitado: boolean; versionEsperada: number; motivo: string; }
export interface SistemaBitacora { id: number; fechaUtc: string; usuario: string | null; modulo: string; clave: string; valorAnterior: boolean | null; valorNuevo: boolean; motivo: string; version: number; }
export interface SistemaSesion { administraSistema: boolean; modulos: ModuloUsuarioInfo[]; version: number; opciones: { modulo: string; clave: string; habilitado: boolean }[]; }

@Injectable({ providedIn: 'root' })
export class SistemaConfiguracionService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly url = `${API_BASE_URL}/sistema`;
  refrescarSesion() { return this.http.get<SistemaSesion>(`${this.url}/sesion`).pipe(tap(s => this.session.actualizarAccesos(s.modulos, s.administraSistema))); }
  obtener() { return this.http.get<SistemaConfiguracion>(`${this.url}/configuracion`); }
  cambiar(cambio: SistemaCambio) { return this.http.put<{ version: number; modificado: boolean }>(`${this.url}/configuracion`, cambio); }
  bitacora(pagina: number) { return this.http.get<SistemaBitacora[]>(`${this.url}/bitacora`, { params: { pagina } }); }
}
