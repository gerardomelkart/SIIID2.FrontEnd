import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api-endpoints.constants';
import {
  SemanalEnviosFiltro,
  SemanalEnviosResponse,
  SemanalReportePreliminarOpcionesResponse,
} from '../models/semanal-envios.models';
import {
  SemanalReporteCargasFiltro,
  SemanalReporteCargasResponse,
} from '../models/semanal-reporte-cargas.models';

interface SemanalTicketResponse {
  esValido: boolean;
  ticket: string;
}

@Injectable({
  providedIn: 'root',
})
export class SemanalEnviosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.semanalEnvios;

  crearTicketDescargaAcuses(
    anioCorte: number,
    mesCorte: number,
    idEntidadFederativa?: number | null,
    idUsuarioCarga?: number | null,
  ) {
    let params = new HttpParams().set('anioCorte', anioCorte).set('mesCorte', mesCorte);

    if (idEntidadFederativa) params = params.set('idEntidadFederativa', idEntidadFederativa);
    if (idUsuarioCarga) params = params.set('idUsuarioCarga', idUsuarioCarga);

    return this.http.post<SemanalTicketResponse>(`${this.apiUrl}/acuses/ticket`, null, { params });
  }

  obtenerUrlDescargaAcuses(ticket: string): string {
    return `${API_BASE_URL}/semanal/envios/acuses/descargar?ticket=${encodeURIComponent(ticket)}`;
  }

  obtenerOpcionesReportePreliminar(
    anioCorte: number,
    mesCorte: number,
    idEntidadFederativa?: number | null,
  ) {
    let params = new HttpParams().set('anioCorte', anioCorte).set('mesCorte', mesCorte);

    if (idEntidadFederativa) params = params.set('idEntidadFederativa', idEntidadFederativa);

    return this.http.get<SemanalReportePreliminarOpcionesResponse>(
      `${this.apiUrl}/reporte-preliminar/opciones`,
      { params },
    );
  }

  crearTicketReportePreliminar(
    anioCorte: number,
    mesCorte: number,
    idDelito: number,
    idEntidadFederativa?: number | null,
  ) {
    let params = new HttpParams()
      .set('anioCorte', anioCorte)
      .set('mesCorte', mesCorte)
      .set('idDelito', idDelito);

    if (idEntidadFederativa) params = params.set('idEntidadFederativa', idEntidadFederativa);

    return this.http.post<SemanalTicketResponse>(`${this.apiUrl}/reporte-preliminar/ticket`, null, {
      params,
    });
  }

  obtenerUrlReportePreliminar(ticket: string): string {
    return `${API_BASE_URL}/semanal/envios/reporte-preliminar/descargar?ticket=${encodeURIComponent(ticket)}`;
  }

  obtenerEnvios(filtro: SemanalEnviosFiltro = {}) {
    let params = new HttpParams();

    if (filtro.idEntidadFederativa)
      params = params.set('idEntidadFederativa', filtro.idEntidadFederativa);
    if (filtro.idUsuarioCarga) params = params.set('idUsuarioCarga', filtro.idUsuarioCarga);
    if (filtro.anioCorte) params = params.set('anioCorte', filtro.anioCorte);
    if (filtro.mesCorte) params = params.set('mesCorte', filtro.mesCorte);
    if (filtro.tipoCarga) params = params.set('tipoCarga', filtro.tipoCarga);
    if (filtro.estado) params = params.set('estado', filtro.estado);

    return this.http.get<SemanalEnviosResponse>(this.apiUrl, { params });
  }

  obtenerReporteCargas(filtro: SemanalReporteCargasFiltro = {}) {
    let params = new HttpParams();

    if (filtro.idEntidadFederativa)
      params = params.set('idEntidadFederativa', filtro.idEntidadFederativa);
    if (filtro.idUsuarioCarga) params = params.set('idUsuarioCarga', filtro.idUsuarioCarga);
    if (filtro.anioCorte) params = params.set('anioCorte', filtro.anioCorte);
    if (filtro.mesCorte) params = params.set('mesCorte', filtro.mesCorte);

    return this.http.get<SemanalReporteCargasResponse>(`${this.apiUrl}/reporte-cargas`, { params });
  }

  descargarArchivos(codigoReferencia: string) {
    return this.http.get(`${this.apiUrl}/${encodeURIComponent(codigoReferencia)}/archivos`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  descargarDesdeEndpoint(endpoint: string) {
    return this.http.get(this.normalizarEndpoint(endpoint), {
      responseType: 'blob',
      observe: 'response',
    });
  }

  private normalizarEndpoint(endpoint: string): string {
    if (!endpoint) return endpoint;
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;

    if (endpoint.startsWith('/api/')) {
      const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
      return `${base}${endpoint.substring(4)}`;
    }

    return endpoint;
  }
}
