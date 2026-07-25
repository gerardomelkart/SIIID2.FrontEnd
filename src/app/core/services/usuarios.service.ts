import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';

import {
  ActualizarPermisosSemanalesRequest,
  CrearUsuarioRequest,
  CrearUsuarioSemanalRequest,
  EditarUsuarioRequest,
  EditarUsuarioSemanalRequest,
  PermisosGlobalesUsuariosRequest,
  ReactivarUsuarioRequest,
  ReactivarUsuarioSemanalRequest,
  UsuarioDetalleResponse,
  UsuarioOperacionResponse,
  UsuariosListadoResponse,
} from '../models/usuarios.models';

@Injectable({
  providedIn: 'root',
})
export class UsuariosService {
  private readonly apiUrl = API_ENDPOINTS.usuarios;

  constructor(private http: HttpClient) {}

  obtenerUsuarios(incluirInactivos: boolean) {
    const params = new HttpParams().set('incluirInactivos', incluirInactivos);
    return this.http.get<UsuariosListadoResponse>(this.apiUrl, { params });
  }

  obtenerDetalle(idUsuario: number) {
    return this.http.get<UsuarioDetalleResponse>(`${this.apiUrl}/${idUsuario}`);
  }

  crearUsuario(request: CrearUsuarioRequest) {
    return this.http.post<UsuarioOperacionResponse>(this.apiUrl, request);
  }

  crearUsuarioSemanal(request: CrearUsuarioSemanalRequest) {
    return this.http.post<UsuarioOperacionResponse>(`${this.apiUrl}/semanal`, request);
  }

  editarUsuario(idUsuario: number, request: EditarUsuarioRequest) {
    return this.http.put<UsuarioOperacionResponse>(`${this.apiUrl}/${idUsuario}`, request);
  }

  editarUsuarioSemanal(idUsuario: number, request: EditarUsuarioSemanalRequest) {
    return this.http.put<UsuarioOperacionResponse>(`${this.apiUrl}/${idUsuario}/semanal`, request);
  }

  actualizarPermisosSemanales(idUsuario: number, request: ActualizarPermisosSemanalesRequest) {
    return this.http.put<UsuarioOperacionResponse>(`${this.apiUrl}/${idUsuario}/permisos-semanales`, request);
  }

  desactivarUsuario(idUsuario: number) {
    return this.http.delete<UsuarioOperacionResponse>(`${this.apiUrl}/${idUsuario}`);
  }

  reactivarUsuario(idUsuario: number, request: ReactivarUsuarioRequest) {
    return this.http.put<UsuarioOperacionResponse>(`${this.apiUrl}/${idUsuario}/reactivar`, request);
  }

  reactivarUsuarioSemanal(idUsuario: number, request: ReactivarUsuarioSemanalRequest) {
    return this.http.put<UsuarioOperacionResponse>(`${this.apiUrl}/${idUsuario}/reactivar-semanal`, request);
  }

  actualizarPermisosGlobales(request: PermisosGlobalesUsuariosRequest) {
    return this.http.put<UsuarioOperacionResponse>(`${this.apiUrl}/permisos-globales`, request);
  }
}