import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { crearBlobUrlDirecta } from '../utils/direct-object-url.utils';

export type TipoAcuseTicket =
  | 'PREVIO_CARGA'
  | 'CONFIRMADO_CARGA'
  | 'PREVIO_ACTUALIZACION'
  | 'CONFIRMADO_ACTUALIZACION';

export interface AcuseTicketResponse {
  esValido: boolean;
  ticket: string;
  nombreArchivo: string;
}

@Injectable({
  providedIn: 'root',
})
export class AcuseService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.acuses;

  crearTicket(codigoReferencia: string, tipo: TipoAcuseTicket) {
    const params = new HttpParams().set('tipo', tipo);
    return this.http.post<AcuseTicketResponse>(`${this.apiUrl}/${encodeURIComponent(codigoReferencia)}/ticket`, null, { params });
  }

  obtenerUrlDescarga(ticket: string): string {
    return `${API_BASE_URL}/acuses/descargar?ticket=${encodeURIComponent(ticket)}`;
  }

  crearBlobDirecto(codigoReferencia: string, tipo: TipoAcuseTicket) {
    return this.crearTicket(codigoReferencia, tipo).pipe(map((response) => crearBlobUrlDirecta(this.obtenerUrlDescarga(response.ticket))));
  }

  crearRespuestaBlobDirecta(codigoReferencia: string, tipo: TipoAcuseTicket) {
    return this.crearTicket(codigoReferencia, tipo).pipe(map((response) => new HttpResponse<Blob>({ body: crearBlobUrlDirecta(this.obtenerUrlDescarga(response.ticket)), status: 200 })));
  }

  crearRespuestaBlobDesdeEndpoint(endpoint: string) {
    const datos = this.obtenerDatosEndpoint(endpoint);
    return datos ? this.crearRespuestaBlobDirecta(datos.codigoReferencia, datos.tipo) : null;
  }

  private obtenerDatosEndpoint(endpoint: string): { codigoReferencia: string; tipo: TipoAcuseTicket } | null {
    const match = endpoint.match(/\/(cargas|actualizaciones)\/([^/?#]+)\/(acuse-confirmado|acuse)(?:[/?#]|$)/i);

    if (!match) {
      return null;
    }

    const modulo = match[1].toLowerCase();
    const codigoReferencia = decodeURIComponent(match[2]);
    const confirmado = match[3].toLowerCase() === 'acuse-confirmado';

    if (modulo === 'actualizaciones') {
      return { codigoReferencia, tipo: confirmado ? 'CONFIRMADO_ACTUALIZACION' : 'PREVIO_ACTUALIZACION' };
    }

    return { codigoReferencia, tipo: confirmado ? 'CONFIRMADO_CARGA' : 'PREVIO_CARGA' };
  }
}
