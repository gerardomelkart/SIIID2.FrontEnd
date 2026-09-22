import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import {
  BanciActualizacionBusquedaResponse,
  BanciActualizacionConfirmacionRequest,
  BanciActualizacionConfirmacionResponse,
  BanciActualizacionEstado,
  BanciActualizacionFormularioRequest,
  BanciActualizacionOpciones,
  BanciActualizacionResultado
} from '../models/banci-actualizacion.models';

@Injectable({ providedIn: 'root' })
export class BanciActualizacionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.banciActualizaciones;

  obtenerOpciones() {
    return this.http.get<BanciActualizacionOpciones>(`${this.apiUrl}/opciones`);
  }

  buscarVictimas(texto: string, idEntidadFederativa: number | null = null, pagina = 1, tamanoPagina = 50) {
    let params = new HttpParams().set('texto', texto.trim()).set('pagina', pagina).set('tamanoPagina', tamanoPagina);
    if (idEntidadFederativa != null) params = params.set('idEntidadFederativa', idEntidadFederativa);
    return this.http.get<BanciActualizacionBusquedaResponse>(`${this.apiUrl}/buscar`, { params });
  }

  descargarPlantilla() {
    return this.http.get(`${this.apiUrl}/plantilla`, { responseType: 'blob', observe: 'response' });
  }

  validarFormulario(request: BanciActualizacionFormularioRequest) {
    return this.http.post<BanciActualizacionResultado>(`${this.apiUrl}/formulario/validar`, request);
  }

  validarArchivo(archivo: File, idEntidadFederativa: number | null = null) {
    const formData = new FormData();
    formData.append('Archivo', archivo);
    if (idEntidadFederativa != null) formData.append('IdEntidadFederativa', idEntidadFederativa.toString());
    return this.http.post<BanciActualizacionResultado>(`${this.apiUrl}/archivo/validar`, formData);
  }

  obtenerPendientes() {
    return this.http.get<BanciActualizacionEstado[]>(`${this.apiUrl}/pendientes`);
  }

  obtenerEstado(codigoReferencia: string) {
    return this.http.get<BanciActualizacionEstado[]>(`${this.apiUrl}/${encodeURIComponent(codigoReferencia)}`);
  }

  obtenerVistaPrevia(codigoReferencia: string) {
    return this.http.get<BanciActualizacionResultado>(`${this.apiUrl}/${encodeURIComponent(codigoReferencia)}/vista-previa`);
  }

  confirmar(codigoReferencia: string, request: BanciActualizacionConfirmacionRequest) {
    return this.http.post<BanciActualizacionConfirmacionResponse>(`${this.apiUrl}/${encodeURIComponent(codigoReferencia)}/confirmar`, request);
  }
}