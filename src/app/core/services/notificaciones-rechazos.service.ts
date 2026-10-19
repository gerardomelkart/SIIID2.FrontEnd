import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api-endpoints.constants';

export interface NotificacionRechazoResponse
{
    hayNotificacion: boolean;
    cantidad: number;
}

@Injectable({
    providedIn: 'root',
})
export class NotificacionesRechazosService
{
    private readonly http = inject(HttpClient);
    private readonly apiUrl = API_ENDPOINTS.notificacionesRechazos;

    consumirBanci()
    {
        return this.http.post<NotificacionRechazoResponse>(`${API_BASE_URL}/banci/mensual/notificaciones/rechazos/consumir`, null);
    }

    consumirMensual()
    {
        return this.http.post<NotificacionRechazoResponse>(`${this.apiUrl}/mensual/consumir`, null);
    }

    consumirFederal()
    {
        return this.http.post<NotificacionRechazoResponse>(`${this.apiUrl}/federal/consumir`, null);
    }

    consumirSemanal()
    {
        return this.http.post<NotificacionRechazoResponse>(`${this.apiUrl}/semanal/consumir`, null);
    }
}
