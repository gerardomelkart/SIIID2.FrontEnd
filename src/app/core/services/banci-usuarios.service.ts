import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import {
  ActualizarPermisosBanciRequest,
  PermisosGlobalesBanciRequest,
  CrearUsuarioBanciRequest,
  EditarUsuarioBanciRequest,
  BanciUsuarioDetalleResponse,
  BanciUsuarioOperacionResponse,
  BanciUsuariosListadoResponse,
  ReactivarUsuarioBanciRequest,
} from '../models/banci-usuarios.models';

@Injectable({
  providedIn: 'root',
})
export class BanciUsuariosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.banciUsuarios;

  obtenerUsuarios(incluirInactivos: boolean) {
    const params = new HttpParams().set('incluirInactivos', incluirInactivos);

    return this.http.get<BanciUsuariosListadoResponse>(this.apiUrl, { params });
  }

  obtenerDetalle(idUsuario: number) {
    return this.http.get<BanciUsuarioDetalleResponse>(`${this.apiUrl}/${idUsuario}`);
  }

  crearUsuario(request: CrearUsuarioBanciRequest) {
    return this.http.post<BanciUsuarioOperacionResponse>(this.apiUrl, request);
  }

  editarUsuario(idUsuario: number, request: EditarUsuarioBanciRequest) {
    return this.http.put<BanciUsuarioOperacionResponse>(
      `${this.apiUrl}/${idUsuario}`,
      request,
    );
  }

  desactivarUsuario(idUsuario: number) {
    return this.http.delete<BanciUsuarioOperacionResponse>(`${this.apiUrl}/${idUsuario}`);
  }

  reactivarUsuario(idUsuario: number, request: ReactivarUsuarioBanciRequest) {
    return this.http.put<BanciUsuarioOperacionResponse>(
      `${this.apiUrl}/${idUsuario}/reactivar`,
      request,
    );
  }
  actualizarPermisos(idUsuario: number, request: ActualizarPermisosBanciRequest) {
    return this.http.put<BanciUsuarioOperacionResponse>(`${this.apiUrl}/${idUsuario}/permisos`, request);
  }

  actualizarPermisosGlobales(request: PermisosGlobalesBanciRequest) {
    return this.http.put<BanciUsuarioOperacionResponse>(`${this.apiUrl}/permisos-globales`, request);
  }
}
