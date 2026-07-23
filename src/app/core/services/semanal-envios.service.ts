import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { SemanalEnviosFiltro, SemanalEnviosResponse } from '../models/semanal-envios.models';

interface SemanalAcusesTicketResponse {
  esValido: boolean;
  ticket: string;
}

@Injectable({
  providedIn: 'root',
})
export class SemanalEnviosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.semanalEnvios;

  crearTicketDescargaAcuses(anioSemana: number, numeroSemana: number) {
    const params = new HttpParams().set('anioSemana', anioSemana).set('numeroSemana', numeroSemana);

    return this.http.post<SemanalAcusesTicketResponse>(`${this.apiUrl}/acuses/ticket`, null, {
      params,
    });
  }

  obtenerUrlDescargaAcuses(ticket: string): string {
    return `${API_BASE_URL}/semanal/envios/acuses/descargar?ticket=${encodeURIComponent(ticket)}`;
  }

  obtenerEnvios(filtro: SemanalEnviosFiltro = {}) {
    let params = new HttpParams();

    if (filtro.idEntidadFederativa)
      params = params.set('idEntidadFederativa', filtro.idEntidadFederativa);
    if (filtro.anioSemana) params = params.set('anioSemana', filtro.anioSemana);
    if (filtro.numeroSemana) params = params.set('numeroSemana', filtro.numeroSemana);
    if (filtro.tipoCarga) params = params.set('tipoCarga', filtro.tipoCarga);
    if (filtro.estado) params = params.set('estado', filtro.estado);

    return this.http.get<SemanalEnviosResponse>(this.apiUrl, { params });
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
