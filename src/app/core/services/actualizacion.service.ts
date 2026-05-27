import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { ActualizacionPeriodoResponse } from '../models/actualizacion.models';

@Injectable({
  providedIn: 'root'
})
export class ActualizacionService {
  private readonly apiUrl = '/api/actualizaciones';

  constructor(private http: HttpClient) {}

  consultarPeriodo(mesCorte: number, anioCorte: number, idEntidadFederativa?: number | null) {
    let params = new HttpParams()
      .set('mesCorte', mesCorte)
      .set('anioCorte', anioCorte);

    if (idEntidadFederativa) {
      params = params.set('idEntidadFederativa', idEntidadFederativa);
    }

    return this.http.get<ActualizacionPeriodoResponse>(`${this.apiUrl}/periodo`, { params });
  }
}