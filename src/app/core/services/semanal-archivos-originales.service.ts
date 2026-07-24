import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { SemanalArchivosOriginalesResponse } from '../models/semanal-archivos-originales.models';

@Injectable({
  providedIn: 'root',
})
export class SemanalArchivosOriginalesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.semanalArchivosOriginales;

  obtenerArchivosOriginales() {
    return this.http.get<SemanalArchivosOriginalesResponse>(this.apiUrl);
  }

  descargarArchivosOriginales(idEntidadFederativa: number) {
    return this.http.get(
      `${this.apiUrl}/${idEntidadFederativa}`,
      {
        responseType: 'blob',
        observe: 'response',
      },
    );
  }
}