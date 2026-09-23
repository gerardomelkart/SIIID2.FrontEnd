import { BanciResumenRegistro } from '../models/banci-resumen.models';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { BanciCargaValidacionResponse } from '../models/banci-carga.models';
import { BanciFormularioOpciones, BanciFormularioRequest } from '../models/banci-formulario.models';

@Injectable({ providedIn: 'root' })
export class BanciCargaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.banciCargas;

  obtenerResumen(referencia: string): Observable<BanciResumenRegistro[]> {
    return this.http.get<BanciResumenRegistro[]>(`${this.apiUrl}/${encodeURIComponent(referencia)}/resumen`);
  }

  obtenerPendientes(): Observable<BanciCargaValidacionResponse[]> {
    return this.http.get<BanciCargaValidacionResponse[]>(`${this.apiUrl}/pendientes`);
  }

  obtenerCarga(codigoReferencia: string): Observable<BanciCargaValidacionResponse> {
    return this.http.get<BanciCargaValidacionResponse>(`${this.apiUrl}/${encodeURIComponent(codigoReferencia)}`);
  }

  confirmar(codigoReferencia: string, aceptar: boolean, huellaVistaPrevia?: string, aceptarAdvertencias = false): Observable<BanciCargaValidacionResponse> {
    return this.http.post<BanciCargaValidacionResponse>(`${this.apiUrl}/confirmar`, {
      codigoReferencia,
      aceptar,
      aceptarAdvertencias,
      ...(aceptar && huellaVistaPrevia ? { huellaVistaPrevia } : {})
    });
  }

  obtenerFormularioOpciones(): Observable<BanciFormularioOpciones> {
    return this.http.get<BanciFormularioOpciones>(`${this.apiUrl}/formulario/opciones`);
  }

  validarFormulario(datos: BanciFormularioRequest): Observable<BanciCargaValidacionResponse> {
    return this.http.post<BanciCargaValidacionResponse>(`${this.apiUrl}/formulario/validar`, datos);
  }

  descargarPlantilla(tipo: 'libro' | 'carpetas' | 'delitos' | 'victimas' = 'libro') {
    return this.http.get(`${this.apiUrl}/plantilla`, { params: { tipo }, responseType: 'blob', observe: 'response' });
  }

  validarLibro(archivo: File, idEntidadFederativa: number | null = null): Observable<BanciCargaValidacionResponse> {
    const formData = new FormData();
    formData.append('ArchivoLibro', archivo);
    if (idEntidadFederativa != null) formData.append('IdEntidadFederativa', idEntidadFederativa.toString());
    return this.http.post<BanciCargaValidacionResponse>(`${this.apiUrl}/validar`, formData);
  }

  validarArchivos(carpetas: File, delitos: File, victimas: File, idEntidadFederativa: number | null = null): Observable<BanciCargaValidacionResponse> {
    const formData = new FormData();
    formData.append('ArchivoCarpetas', carpetas);
    formData.append('ArchivoDelitos', delitos);
    formData.append('ArchivoVictimas', victimas);
    if (idEntidadFederativa != null) formData.append('IdEntidadFederativa', idEntidadFederativa.toString());
    return this.http.post<BanciCargaValidacionResponse>(`${this.apiUrl}/validar`, formData);
  }
}