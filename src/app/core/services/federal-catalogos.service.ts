import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { FederalCatalogoResumen } from '../models/federal-catalogos.models';

@Injectable({
  providedIn: 'root',
})
export class FederalCatalogosService {
  private readonly http = inject(HttpClient);

  obtenerResumen(): Observable<FederalCatalogoResumen> {
    return this.http.get<FederalCatalogoResumen>(
      `${API_ENDPOINTS.federalCatalogos}/resumen`,
    );
  }
}