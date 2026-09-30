import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import Swal from 'sweetalert2';
import { BanciCruceService } from './banci-cruce.service';
import { SessionService } from './session.service';
import { API_BASE_URL } from '../constants/api-endpoints.constants';

describe('Actualización opcional desde Consolidado', () => {
  let service: BanciCruceService;
  let http: HttpTestingController;
  let router: Router;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: SessionService, useValue: { modulos: () => [] } }] });
    service = TestBed.inject(BanciCruceService); http = TestBed.inject(HttpTestingController); router = TestBed.inject(Router);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  it('sin registros autorizados no ofrece cambios', async () => {
    const dialogo = vi.spyOn(Swal, 'fire');
    const tarea = service.ofrecer('CARGA-1');
    http.expectOne(`${API_BASE_URL}/banci/cruce/mensual/CARGA-1`).flush({ victimas: [] });
    await tarea; expect(dialogo).not.toHaveBeenCalled();
  });
  it('omitir no navega ni realiza escrituras', async () => {
    vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: false, isDenied: false, isDismissed: true });
    const navegar = vi.spyOn(router, 'navigate');
    const tarea = service.ofrecer('CARGA-1');
    http.expectOne(`${API_BASE_URL}/banci/cruce/mensual/CARGA-1`).flush({ victimas: [{ id_vicf: 'V1' }] });
    await tarea; expect(navegar).not.toHaveBeenCalled();
  });
  for (const modalidad of ['manual', 'masiva']) it(`abre ${modalidad} conservando referencia`, async () => {
    vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: modalidad === 'manual', isDenied: modalidad === 'masiva', isDismissed: false });
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const tarea = service.ofrecer('CARGA-1');
    http.expectOne(`${API_BASE_URL}/banci/cruce/mensual/CARGA-1`).flush({ victimas: [{ id_vicf: 'V1' }] });
    await tarea; expect(navegar).toHaveBeenCalledWith(['/banci/actualizacion', modalidad], { queryParams: { cruce: 'CARGA-1' } });
  });
  it('sin acceso BANCI indica acudir a usuario autorizado y no navega', async () => {
    const dialogo = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false });
    const navegar = vi.spyOn(router, 'navigateByUrl');
    await service.mostrarBloqueo([{ codigo: 'BANCI_NO_REPORTADA', mensaje: 'Falta CI/1' }]);
    expect(dialogo).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('usuario autorizado'), showCancelButton: false }));
    expect(navegar).not.toHaveBeenCalled();
  });
});
