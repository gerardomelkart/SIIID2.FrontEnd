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
    const params = this.parametrosFiltro(filtro).set('pagina', filtro.pagina).set('tamanoPagina', filtro.tamanoPagina);
    return this.http.get<BanciConsultaResultado>(this.url, { params });
  }

  descargarExcel(filtro: BanciConsultaFiltro) {
    return this.http.get(`${this.url}/excel`, {
      params: this.parametrosFiltro(filtro), responseType: 'blob', observe: 'response',
    });
  }

  private parametrosFiltro(filtro: BanciConsultaFiltro): HttpParams {
    let params = new HttpParams().set('anio', filtro.anio);
    if (filtro.mes != null) params = params.set('mes', filtro.mes);
    if (filtro.idEntidadFederativa != null) params = params.set('idEntidadFederativa', filtro.idEntidadFederativa);
    if (filtro.busqueda.trim()) params = params.set('busqueda', filtro.busqueda.trim());
    return params;
  }

  obtenerDetalle(idCarpeta: number) {
    return this.http.get<BanciConsultaDetalle>(`${this.url}/carpetas/${idCarpeta}`);
  }
}
