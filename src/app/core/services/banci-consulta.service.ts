import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../constants/api-endpoints.constants';
import { BanciConsultaDetalle, BanciConsultaFiltro, BanciConsultaOpciones, BanciConsultaResultado } from '../models/banci-consulta.models';

@Injectable({ providedIn: 'root' })
export class BanciConsultaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/banci/consulta`;

  obtenerOpciones() { return this.http.get<BanciConsultaOpciones>(`${this.url}/opciones`); }

  consultar(filtro: BanciConsultaFiltro) {
    let params = new HttpParams().set('anio', filtro.anio).set('pagina', filtro.pagina)
      .set('tamanoPagina', filtro.tamanoPagina);
    if (filtro.mes != null) params = params.set('mes', filtro.mes);
    if (filtro.idEntidadFederativa != null) params = params.set('idEntidadFederativa', filtro.idEntidadFederativa);
    if (filtro.busqueda.trim()) params = params.set('busqueda', filtro.busqueda.trim());
    return this.http.get<BanciConsultaResultado>(this.url, { params });
  }

  obtenerDetalle(idCarpeta: number) {
    return this.http.get<BanciConsultaDetalle>(`${this.url}/carpetas/${idCarpeta}`);
  }
}
