import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import {
  CrearUsuarioFederalRequest,
  EditarUsuarioFederalRequest,
  FederalUsuarioDetalleResponse,
  FederalUsuarioOperacionResponse,
  FederalUsuariosListadoResponse,
  ReactivarUsuarioFederalRequest,
} from '../models/federal-usuarios.models';

@Injectable({
  providedIn: 'root',
})
export class FederalUsuariosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.federalUsuarios;

  obtenerUsuarios(incluirInactivos: boolean) {
    const params = new HttpParams().set('incluirInactivos', incluirInactivos);

    return this.http.get<FederalUsuariosListadoResponse>(this.apiUrl, { params });
  }

  obtenerDetalle(idUsuario: number) {
    return this.http.get<FederalUsuarioDetalleResponse>(`${this.apiUrl}/${idUsuario}`);
  }

  crearUsuario(request: CrearUsuarioFederalRequest) {
    return this.http.post<FederalUsuarioOperacionResponse>(this.apiUrl, request);
  }

  editarUsuario(idUsuario: number, request: EditarUsuarioFederalRequest) {
    return this.http.put<FederalUsuarioOperacionResponse>(
      `${this.apiUrl}/${idUsuario}`,
      request,
    );
  }

  desactivarUsuario(idUsuario: number) {
    return this.http.delete<FederalUsuarioOperacionResponse>(`${this.apiUrl}/${idUsuario}`);
  }

  reactivarUsuario(idUsuario: number, request: ReactivarUsuarioFederalRequest) {
    return this.http.put<FederalUsuarioOperacionResponse>(
      `${this.apiUrl}/${idUsuario}/reactivar`,
      request,
    );
  }
}