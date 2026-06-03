import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';

import {
  ActualizacionDiferenciasResponse,
  ActualizacionPeriodoResponse,
} from '../models/actualizacion.models';

import {
  CargaValidacionResponse,
  ConfirmarCargaRequest,
  ConfirmarCargaResponse,
} from '../models/carga.models';

@Injectable({
  providedIn: 'root',
})
export class ActualizacionService {
  private readonly apiUrl = API_ENDPOINTS.actualizaciones;

  constructor(private http: HttpClient) {}

  consultarPeriodo(mesCorte: number, anioCorte: number, idEntidadFederativa?: number | null) {
    let params = new HttpParams().set('mesCorte', mesCorte).set('anioCorte', anioCorte);

    if (idEntidadFederativa) {
      params = params.set('idEntidadFederativa', idEntidadFederativa);
    }

    return this.http.get<ActualizacionPeriodoResponse>(`${this.apiUrl}/periodo`, { params });
  }

  validarActualizacion(
    mesCorte: number,
    anioCorte: number,
    carpetas: File,
    delitos: File,
    victimas: File,
    idEntidadFederativa?: number | null,
  ) {
    const formData = new FormData();

    formData.append('mesCorte', mesCorte.toString());
    formData.append('anioCorte', anioCorte.toString());

    if (idEntidadFederativa) {
      formData.append('idEntidadFederativa', idEntidadFederativa.toString());
    }

    formData.append('carpetas', carpetas);
    formData.append('delitos', delitos);
    formData.append('victimas', victimas);

    return this.http.post<CargaValidacionResponse>(`${this.apiUrl}/validar`, formData);
  }

  obtenerDiferencias(codigoReferencia: string) {
    return this.http.get<ActualizacionDiferenciasResponse>(
      `${this.apiUrl}/diferencias/${codigoReferencia}`,
    );
  }

  confirmarActualizacion(request: ConfirmarCargaRequest) {
    return this.http.post<ConfirmarCargaResponse>(`${this.apiUrl}/confirmar`, request);
  }

  descargarAcusePrevio(codigoReferencia: string) {
    return this.http.get(`${this.apiUrl}/${codigoReferencia}/acuse`, {
      responseType: 'blob',
    });
  }

  descargarAcuseConfirmado(codigoReferencia: string) {
    return this.http.get(`${this.apiUrl}/${codigoReferencia}/acuse-confirmado`, {
      responseType: 'blob',
    });
  }
}