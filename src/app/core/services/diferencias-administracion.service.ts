import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../constants/api-endpoints.constants';

@Injectable({ providedIn: 'root' })
export class DiferenciasAdministracionService
{
    private readonly http = inject(HttpClient);

    descargar(modulo: 'mensual' | 'federal' | 'semanal' | 'banci', referencia: string)
    {
        return this.http.get(`${API_BASE_URL}/administracion/diferencias/${modulo}/${encodeURIComponent(referencia)}/excel`, { responseType: 'blob' });
    }
}
