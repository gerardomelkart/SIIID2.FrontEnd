import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api-endpoints.constants';

import {
  InformeEnvioItem,
  InformeEnviosFiltro,
  InformeReporteCargasFiltro,
  InformeReporteCargasResponse,
  UltimosArchivosEntidadResponse,
} from '../models/informes.models';

export type TipoSabanaDescarga = 'COMPLETA' | 'ESTATALES' | 'MUNICIPALES';

export interface SabanaTicketResponse {
  esValido: boolean;
  ticket: string;
}

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

  crearTicketDescargaSabanas(anioCorte: number, tipo: TipoSabanaDescarga = 'COMPLETA') {
    const params = new HttpParams().set('anioCorte', anioCorte).set('tipo', tipo);

    return this.http.post<SabanaTicketResponse>(`${this.apiUrl}/sabanas/ticket`, null, {
      params,
    });
  }

  obtenerUrlDescargaSabanas(ticket: string): string {
    return `${API_BASE_URL}/informes/sabanas/descargar?ticket=${encodeURIComponent(ticket)}`;
  }

  obtenerArchivosOriginales() {
    return this.http.get<UltimosArchivosEntidadResponse>(`${this.apiUrl}/archivos-originales`);
  }

  descargarArchivosOriginales(idEntidadFederativa: number) {
    return this.http.get(`${this.apiUrl}/archivos-originales/${idEntidadFederativa}`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  descargarDesdeEndpoint(endpoint: string) {
    const url = this.normalizarEndpointDescarga(endpoint);

    return this.http.get(url, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  private normalizarEndpointDescarga(endpoint: string): string {
    if (!endpoint) {
      return endpoint;
    }

    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }

    if (endpoint.startsWith('/api/')) {
      const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
      const ruta = endpoint.substring(4);

      return `${base}${ruta}`;
    }

    return endpoint;
  }
}
