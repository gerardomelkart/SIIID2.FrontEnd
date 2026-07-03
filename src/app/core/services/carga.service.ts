import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { AcuseService } from './acuse.service';

import {
  CargaValidacionResponse,
  ConfirmarCargaRequest,
  ConfirmarCargaResponse,
} from '../models/carga.models';

@Injectable({
  providedIn: 'root',
})
export class CargaService {
  private readonly apiUrl = API_ENDPOINTS.cargas;

  constructor(private http: HttpClient, private acuseService: AcuseService) {}

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
    return this.acuseService.crearBlobDirecto(codigoReferencia, 'PREVIO_CARGA');
  }

  descargarAcuseConfirmado(codigoReferencia: string) {
    return this.acuseService.crearBlobDirecto(codigoReferencia, 'CONFIRMADO_CARGA');
  }
}
