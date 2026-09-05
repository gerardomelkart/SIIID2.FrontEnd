import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { InformeEnvioItem, PeriodoCorteInforme } from '../models/informes.models';

interface FederalAcusesTicketResponse {
  esValido: boolean;
  ticket: string;
}

@Injectable({
  providedIn: 'root',
})
export class FederalInformesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.federalInformes;

  obtenerPeriodosEnvios() {
    return this.http.get<PeriodoCorteInforme[]>(`${this.apiUrl}/envios/periodos`);
  }

  obtenerEnvios(mesCorte: number, anioCorte: number) {
    const params = new HttpParams().set('mesCorte', mesCorte).set('anioCorte', anioCorte);
    return this.http.get<InformeEnvioItem[]>(`${this.apiUrl}/envios`, { params });
  }

  crearTicketDescargaAcuses(mesCorte: number, anioCorte: number) {
    const params = new HttpParams().set('mesCorte', mesCorte).set('anioCorte', anioCorte);

    return this.http.post<FederalAcusesTicketResponse>(
      `${this.apiUrl}/envios/acuses/ticket`,
      null,
      { params },
    );
  }

  obtenerUrlDescargaAcuses(ticket: string): string {
    return `${this.apiUrl}/envios/acuses/descargar?ticket=${encodeURIComponent(ticket)}`;
  }

  descargarDesdeEndpoint(endpoint: string) {
    return this.http.get(this.normalizarEndpoint(endpoint), {
      responseType: 'blob',
      observe: 'response',
    });
  }

  private normalizarEndpoint(endpoint: string): string {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;

    if (endpoint.startsWith('/api/')) {
      const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
      return `${base}${endpoint.substring(4)}`;
    }

    return endpoint;
  }
}
