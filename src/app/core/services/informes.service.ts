import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';

import {
  InformeEnvioItem,
  InformeEnviosFiltro,
  InformeReporteCargasFiltro,
  InformeReporteCargasResponse,
} from '../models/informes.models';

@Injectable({
  providedIn: 'root',
})
export class InformesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.informes;

  obtenerEnvios(filtro: InformeEnviosFiltro = {}) {
    let params = new HttpParams();

    if (filtro.idEntidadFederativa) {
      params = params.set('idEntidadFederativa', filtro.idEntidadFederativa);
    }

    if (filtro.mesCorte) {
      params = params.set('mesCorte', filtro.mesCorte);
    }

    if (filtro.anioCorte) {
      params = params.set('anioCorte', filtro.anioCorte);
    }

    return this.http.get<InformeEnvioItem[]>(`${this.apiUrl}/envios`, { params });
  }

  obtenerReporteCargas(filtro: InformeReporteCargasFiltro = {}) {
    let params = new HttpParams();

    if (filtro.idEntidadFederativa) {
      params = params.set('idEntidadFederativa', filtro.idEntidadFederativa);
    }

    if (filtro.mesCorte) {
      params = params.set('mesCorte', filtro.mesCorte);
    }

    if (filtro.anioCorte) {
      params = params.set('anioCorte', filtro.anioCorte);
    }

    return this.http.get<InformeReporteCargasResponse>(`${this.apiUrl}/reporte-cargas`, { params });
  }

  descargarSabanas(anioCorte: number) {
    const params = new HttpParams().set('anioCorte', anioCorte);

    return this.http.get(`${this.apiUrl}/sabanas`, {
      params,
      responseType: 'blob',
      observe: 'response',
    });
  }

  descargarDesdeEndpoint(endpoint: string) {
    return this.http.get(endpoint, {
      responseType: 'blob',
      observe: 'response',
    });
  }
}
