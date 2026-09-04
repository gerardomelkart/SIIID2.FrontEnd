import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import {
  CargaPendienteAdministracionDetalleResponse,
  CargasPendientesAdministracionResponse,
  RechazarCargaAdministracionRequest,
  ResolverCargaAdministracionResponse,
} from '../models/administracion-cargas.models';

@Injectable({
  providedIn: 'root',
})
export class FederalAdministracionCargasService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.federalAdministracionCargas;

  obtenerPendientes() {
    return this.http.get<CargasPendientesAdministracionResponse>(this.apiUrl);
  }

  obtenerDetalle(codigoReferencia: string) {
    return this.http.get<CargaPendienteAdministracionDetalleResponse>(
      `${this.apiUrl}/${codigoReferencia}`,
    );
  }

  aprobar(codigoReferencia: string) {
    return this.http.post<ResolverCargaAdministracionResponse>(
      `${this.apiUrl}/${codigoReferencia}/aprobar`,
      {},
    );
  }

  rechazar(codigoReferencia: string, motivo: string) {
    const request: RechazarCargaAdministracionRequest = { motivo };

    return this.http.post<ResolverCargaAdministracionResponse>(
      `${this.apiUrl}/${codigoReferencia}/rechazar`,
      request,
    );
  }
}