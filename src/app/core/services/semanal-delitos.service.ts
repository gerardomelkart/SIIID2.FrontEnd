import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { ActualizarConfiguracionDelitosSemanalesRequest, ConfiguracionDelitosSemanalesResponse, DelitosSemanalesHabilitadosResponse } from '../models/semanal-delitos.models';

@Injectable({
  providedIn: 'root',
})
export class SemanalDelitosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.semanalDelitos;

  obtenerConfiguracion() {
    return this.http.get<ConfiguracionDelitosSemanalesResponse>(this.apiUrl);
  }

  obtenerDelitosHabilitados() {
    return this.http.get<DelitosSemanalesHabilitadosResponse>(`${this.apiUrl}/habilitados`);
  }

  guardarConfiguracion(request: ActualizarConfiguracionDelitosSemanalesRequest) {
    return this.http.put<ConfiguracionDelitosSemanalesResponse>(this.apiUrl, request);
  }
}