import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import {
  EntidadFederativaCatalogoItem,
  RolCatalogoItem
} from '../models/catalogos.models';

@Injectable({
  providedIn: 'root'
})
export class CatalogosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/catalogos';

  obtenerEntidadesFederativas() {
    return this.http.get<EntidadFederativaCatalogoItem[]>(
      `${this.apiUrl}/entidades-federativas`
    );
  }

  obtenerRoles() {
    return this.http.get<RolCatalogoItem[]>(
      `${this.apiUrl}/roles`
    );
  }
}