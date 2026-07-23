import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import {
  ConfirmarCargaRequest,
  ConfirmarCargaResponse,
  SemanalCargaPeriodoRequest,
  SemanalCargaValidacionResponse,
} from '../models/semanal-carga.models';
import { ArchivosCargaSeleccionados } from '../types/archivo-carga.types';
import { ActualizacionDiferenciasResponse } from '../models/actualizacion.models';

@Injectable({
  providedIn: 'root',
})
export class SemanalCargaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.semanalCargas;

  validarArchivos(archivos: ArchivosCargaSeleccionados, periodo: SemanalCargaPeriodoRequest) {
    const formData = new FormData();

    formData.append('carpetas', archivos.carpetas!);
    formData.append('delitos', archivos.delitos!);
    formData.append('victimas', archivos.victimas!);
    formData.append('tipoCarga', periodo.tipoCarga);
    formData.append('tipoContenido', periodo.tipoContenido);
    formData.append('anioSemana', periodo.anioSemana.toString());
    formData.append('numeroSemana', periodo.numeroSemana.toString());
    formData.append('fechaInicioSemana', periodo.fechaInicioSemana);
    formData.append('mesCorte', periodo.mesCorte.toString());
    formData.append('anioCorte', periodo.anioCorte.toString());

    return this.http.post<SemanalCargaValidacionResponse>(`${this.apiUrl}/validar`, formData);
  }

  obtenerDiferencias(codigoReferencia: string, limitePorSeccion = 100) {
    return this.http.get<ActualizacionDiferenciasResponse>(
      `${this.apiUrl}/${codigoReferencia}/diferencias`,
      {
        params: { limitePorSeccion },
      },
    );
  }

  confirmarCarga(request: ConfirmarCargaRequest) {
    return this.http.post<ConfirmarCargaResponse>(`${this.apiUrl}/confirmar`, request);
  }

  descargarAcusePrevio(codigoReferencia: string) {
    return this.http.get(`${this.apiUrl}/${codigoReferencia}/acuse`, {
      responseType: 'blob',
    });
  }

  descargarAcuseConfirmado(codigoReferencia: string) {
    return this.http.get(`${this.apiUrl}/${codigoReferencia}/acuse-confirmado`, {
      responseType: 'blob',
    });
  }
}
