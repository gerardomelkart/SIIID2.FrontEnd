import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import {
  CargaValidacionResponse,
  ConfirmarCargaRequest,
  ConfirmarCargaResponse
} from '../models/carga.models';

@Injectable({
  providedIn: 'root'
})
export class CargaService {
  private readonly apiUrl = '/api/cargas';

  constructor(private http: HttpClient) {}

  validarArchivos(carpetas: File, delitos: File, victimas: File) {
    const formData = new FormData();

    formData.append('carpetas', carpetas);
    formData.append('delitos', delitos);
    formData.append('victimas', victimas);

    return this.http.post<CargaValidacionResponse>(`${this.apiUrl}/validar`, formData);
  }

  confirmarCarga(request: ConfirmarCargaRequest) {
    return this.http.post<ConfirmarCargaResponse>(`${this.apiUrl}/confirmar`, request);
  }

  descargarAcusePrevio(codigoReferencia: string) {
    return this.http.get(`${this.apiUrl}/${codigoReferencia}/acuse`, {
      responseType: 'blob'
    });
  }

  descargarAcuseConfirmado(codigoReferencia: string) {
    return this.http.get(`${this.apiUrl}/${codigoReferencia}/acuse-confirmado`, {
      responseType: 'blob'
    });
  }
}