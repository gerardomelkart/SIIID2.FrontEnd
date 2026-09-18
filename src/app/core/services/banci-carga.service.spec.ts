import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BanciCargaService } from './banci-carga.service';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';

describe('Contrato HTTP de confirmación BANCI', () => {
  let service: BanciCargaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(BanciCargaService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); });

  it.each([true, false])('envía la decisión explícita %s sin usuario manipulable ni archivos', (aceptar) => {
    service.confirmar('REF_7', aceptar).subscribe();
    const req = http.expectOne(`${API_ENDPOINTS.banciCargas}/confirmar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ codigoReferencia: 'REF_7', aceptar });
    req.flush({});
  });

  it('obtiene pendientes del usuario autenticado, sin recibir un id de usuario del cliente', () => {
    service.obtenerPendientes().subscribe();
    const req = http.expectOne(`${API_ENDPOINTS.banciCargas}/pendientes`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('incluye la huella al aceptar y la omite al rechazar', () => {
    service.confirmar('REF_7', true, 'A'.repeat(64)).subscribe();
    const aceptar = http.expectOne(`${API_ENDPOINTS.banciCargas}/confirmar`);
    expect(aceptar.request.body).toEqual({ codigoReferencia: 'REF_7', aceptar: true, huellaVistaPrevia: 'A'.repeat(64) }); aceptar.flush({});
    service.confirmar('REF_7', false, 'A'.repeat(64)).subscribe();
    const rechazar = http.expectOne(`${API_ENDPOINTS.banciCargas}/confirmar`);
    expect(rechazar.request.body).toEqual({ codigoReferencia: 'REF_7', aceptar: false }); rechazar.flush({});
  });

  it('recuperar sólo consulta el estado; no confirma ni valida', () => {
    service.obtenerCarga('REF_7').subscribe();
    const req = http.expectOne(`${API_ENDPOINTS.banciCargas}/REF_7`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });
});
