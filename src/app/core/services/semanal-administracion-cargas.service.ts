import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import {
  RechazarCargaSemanalAdministracionRequest,
  ResolverCargaSemanalAdministracionResponse,
  SemanalCargaPendienteAdministracionDetalleResponse,
  SemanalCargasPendientesAdministracionResponse,
} from '../models/semanal-administracion-cargas.models';

@Injectable({
  providedIn: 'root',
})
export class SemanalAdministracionCargasService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.semanalAdministracionCargas;

  obtenerPendientes() {
    return this.http.get<SemanalCargasPendientesAdministracionResponse>(this.apiUrl);
  }

  obtenerDetalle(codigoReferencia: string) {
    return this.http.get<SemanalCargaPendienteAdministracionDetalleResponse>(
      `${this.apiUrl}/${codigoReferencia}`,
    );
  }

  descargarArchivos(codigoReferencia: string) {
    return this.http.get(`${this.apiUrl}/${codigoReferencia}/archivos`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  descargarAcuse(codigoReferencia: string) {
    return this.http.get(`${API_ENDPOINTS.semanalCargas}/${codigoReferencia}/acuse`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  aprobar(codigoReferencia: string) {
    return this.http.post<ResolverCargaSemanalAdministracionResponse>(
      `${this.apiUrl}/${codigoReferencia}/aprobar`,
      {},
    );
  }

  rechazar(codigoReferencia: string, motivo: string) {
    const request: RechazarCargaSemanalAdministracionRequest = { motivo };

    return this.http.post<ResolverCargaSemanalAdministracionResponse>(
      `${this.apiUrl}/${codigoReferencia}/rechazar`,
      request,
    );
  }
}