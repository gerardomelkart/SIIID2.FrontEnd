import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';

export interface NotificacionRechazoResponse {
  hayNotificacion: boolean;
  cantidad: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificacionesRechazosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.notificacionesRechazos;

  consumirMensual() {
    return this.http.post<NotificacionRechazoResponse>(`${this.apiUrl}/mensual/consumir`, null);
  }

  consumirSemanal() {
    return this.http.post<NotificacionRechazoResponse>(`${this.apiUrl}/semanal/consumir`, null);
  }
}