import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { BanciCargaValidacionResponse } from '../models/banci-carga.models';

@Injectable({ providedIn: 'root' })
export class BanciCargaService {
  private readonly http = inject(HttpClient);

  validarLibro(archivo: File): Observable<BanciCargaValidacionResponse> {
    const formData = new FormData();
    formData.append('ArchivoLibro', archivo);
    return this.http.post<BanciCargaValidacionResponse>(`${API_ENDPOINTS.banciCargas}/validar`, formData);
  }

  validarArchivos(carpetas: File, delitos: File, victimas: File): Observable<BanciCargaValidacionResponse> {
    const formData = new FormData();
    formData.append('ArchivoCarpetas', carpetas);
    formData.append('ArchivoDelitos', delitos);
    formData.append('ArchivoVictimas', victimas);
    return this.http.post<BanciCargaValidacionResponse>(`${API_ENDPOINTS.banciCargas}/validar`, formData);
  }
}