import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { sistemaGuard } from './sistema.guard';
import { SistemaConfiguracionService } from '../services/sistema-configuracion.service';

describe('Acceso exclusivo a configuración', () => {
  afterEach(() => TestBed.resetTestingModule());
  it.each([true, false])('permiso adicional=%s, sin depender de módulos operativos', async permiso => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: SistemaConfiguracionService, useValue: { refrescarSesion: () => of({ administraSistema: permiso, modulos: [] }) } }] });
    const valor = TestBed.runInInjectionContext(() => sistemaGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    const resultado = isObservable(valor) ? await firstValueFrom(valor) : await valor;
    if (permiso) expect(resultado).toBe(true); else expect(TestBed.inject(Router).serializeUrl(resultado as any)).toBe('/seleccionar-modulo');
  });
  it('no permite acceso si no se pudo verificar con la API', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: SistemaConfiguracionService, useValue: { refrescarSesion: () => throwError(() => new Error('red')) } }] });
    const valor = TestBed.runInInjectionContext(() => sistemaGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    expect(isObservable(valor) ? await firstValueFrom(valor) : await valor).not.toBe(true);
  });
});
