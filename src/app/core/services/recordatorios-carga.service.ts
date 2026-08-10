import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../constants/api-endpoints.constants';

export type ModuloRecordatorioCarga = 'mensual' | 'semanal';

export interface RecordatorioCargaResponse {
  hayPendiente: boolean;
  titulo: string;
  mensaje: string;
  periodo: string;
  delitos: string[];
}

@Injectable({
  providedIn: 'root',
})
export class RecordatoriosCargaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_BASE_URL}/recordatorios/carga`;

  obtener(modulo: ModuloRecordatorioCarga) {
    return this.http.get<RecordatorioCargaResponse>(`${this.apiUrl}/${modulo}`);
  }
}