import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BanciConsultaService } from './banci-consulta.service';
import { API_BASE_URL } from '../constants/api-endpoints.constants';

describe('Contrato HTTP consulta BANCI', () => {
  let service: BanciConsultaService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(BanciConsultaService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); });

  it('todo el año omite el mes y la entidad nacional, sin enviar roles ni usuario', () => {
    service.consultar({ anio: 2026, mes: null, idEntidadFederativa: null, busqueda: '', pagina: 1, tamanoPagina: 25 }).subscribe();
    const req = http.expectOne(r => r.url === `${API_BASE_URL}/banci/consulta`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual(['anio', 'pagina', 'tamanoPagina']);
    req.flush({});
  });

  it('envía mes, año, entidad y búsqueda como parámetros', () => {
    service.consultar({ anio: 2025, mes: 12, idEntidadFederativa: 14, busqueda: ' CI-7 ', pagina: 2, tamanoPagina: 25 }).subscribe();
    const req = http.expectOne(r => r.url === `${API_BASE_URL}/banci/consulta`);
    expect(req.request.params.get('mes')).toBe('12');
    expect(req.request.params.get('anio')).toBe('2025');
    expect(req.request.params.get('idEntidadFederativa')).toBe('14');
    expect(req.request.params.get('busqueda')).toBe('CI-7');
    req.flush({});
  });

  it('el detalle no recibe entidad ni rol del cliente para autorizar', () => {
    service.obtenerDetalle(7).subscribe();
    const req = http.expectOne(`${API_BASE_URL}/banci/consulta/carpetas/7`);
    expect(req.request.params.keys()).toHaveLength(0); req.flush({});
  });
});
