import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { AcuseService, TipoAcuseTicket } from './acuse.service';
import {
  CargaPendienteAdministracionDetalleResponse,
  CargasPendientesAdministracionResponse,
  RechazarCargaAdministracionRequest,
  ResolverCargaAdministracionResponse,
} from '../models/administracion-cargas.models';

@Injectable({
  providedIn: 'root',
})
export class AdministracionCargasService {
  private readonly http = inject(HttpClient);
  private readonly acuseService = inject(AcuseService);
  private readonly apiUrl = API_ENDPOINTS.administracionCargas;

  obtenerPendientes() {
    return this.http.get<CargasPendientesAdministracionResponse>(this.apiUrl);
  }

  obtenerDetalle(codigoReferencia: string) {
    return this.http.get<CargaPendienteAdministracionDetalleResponse>(`${this.apiUrl}/${codigoReferencia}`);
  }

  descargarArchivos(codigoReferencia: string) {
    return this.http.get(`${this.apiUrl}/${codigoReferencia}/archivos`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  descargarAcuse(codigoReferencia: string, tipoCarga: string) {
    const tipo: TipoAcuseTicket = tipoCarga === 'ACTUALIZACION' ? 'PREVIO_ACTUALIZACION' : 'PREVIO_CARGA';
    return this.acuseService.crearRespuestaBlobDirecta(codigoReferencia, tipo);
  }

  aprobar(codigoReferencia: string) {
    return this.http.post<ResolverCargaAdministracionResponse>(`${this.apiUrl}/${codigoReferencia}/aprobar`, {});
  }

  rechazar(codigoReferencia: string, motivo: string) {
    const request: RechazarCargaAdministracionRequest = { motivo };
    return this.http.post<ResolverCargaAdministracionResponse>(`${this.apiUrl}/${codigoReferencia}/rechazar`, request);
  }
}
