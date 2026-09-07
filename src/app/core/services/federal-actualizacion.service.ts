import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';

import {
  ActualizacionAnioDisponibleItem,
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
export class FederalActualizacionService {
  private readonly apiUrl = API_ENDPOINTS.federalActualizaciones;

  constructor(private http: HttpClient) {}

  consultarPeriodo(mesCorte: number, anioCorte: number) {
    const params = new HttpParams().set('mesCorte', mesCorte).set('anioCorte', anioCorte);

    return this.http.get<ActualizacionPeriodoResponse>(`${this.apiUrl}/periodo`, { params });
  }

  obtenerPeriodosDisponibles() {
    return this.http.get<ActualizacionAnioDisponibleItem[]>(`${this.apiUrl}/periodos-disponibles`);
  }

  validarActualizacion(
    mesCorte: number,
    anioCorte: number,
    carpetas: File,
    delitos: File,
    victimas: File,
  ) {
    const formData = new FormData();

    formData.append('mesCorte', mesCorte.toString());
    formData.append('anioCorte', anioCorte.toString());

    formData.append('carpetas', carpetas);
    formData.append('delitos', delitos);
    formData.append('victimas', victimas);

    return this.http.post<CargaValidacionResponse>(`${this.apiUrl}/validar`, formData);
  }

  obtenerDiferencias(codigoReferencia: string, limitePorSeccion = 50, incluirResumen = true) {
    const params = new HttpParams()
      .set('limitePorSeccion', limitePorSeccion)
      .set('incluirResumen', incluirResumen);

    return this.http.get<ActualizacionDiferenciasResponse>(
      `${this.apiUrl}/diferencias/${codigoReferencia}`,
      { params },
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
