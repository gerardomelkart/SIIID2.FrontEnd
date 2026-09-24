import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, provideRouter } from '@angular/router';
import { firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { moduloGuard } from './modulo.guard';
import { SessionService } from '../services/session.service';
import { SistemaConfiguracionService } from '../services/sistema-configuracion.service';

describe('Disponibilidad vigente de módulos', () => {
  afterEach(() => TestBed.resetTestingModule());
  it.each([true, false])(
    'módulo disponible en API=%s, incluso al entrar a una ruta hija',
    async (disponible) => {
      const seleccionarModulo = vi.fn();
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: SessionService, useValue: { seleccionarModulo } },
          {
            provide: SistemaConfiguracionService,
            useValue: {
              refrescarSesion: () => of({ modulos: disponible ? [{ clave: 'BANCI' }] : [] }),
            },
          },
        ],
      });
      const ruta = {
        pathFromRoot: [{ data: { modulo: 'BANCI' } }, { data: {} }],
      } as unknown as ActivatedRouteSnapshot;
      const valor = TestBed.runInInjectionContext(() =>
        moduloGuard(ruta, {} as RouterStateSnapshot),
      );
      const resultado = isObservable(valor) ? await firstValueFrom(valor) : await valor;
      if (disponible) {
        expect(resultado).toBe(true);
        expect(seleccionarModulo).toHaveBeenCalledWith('BANCI');
      } else {
        expect(resultado).not.toBe(true);
        expect(seleccionarModulo).not.toHaveBeenCalled();
      }
    },
  );
  it('no confía en permisos locales si la API no responde', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: { seleccionarModulo: vi.fn() } },
        {
          provide: SistemaConfiguracionService,
          useValue: { refrescarSesion: () => throwError(() => new Error('red')) },
        },
      ],
    });
    const ruta = {
      pathFromRoot: [{ data: { modulo: 'FEDERAL' } }],
    } as unknown as ActivatedRouteSnapshot;
    const valor = TestBed.runInInjectionContext(() => moduloGuard(ruta, {} as RouterStateSnapshot));
    expect(isObservable(valor) ? await firstValueFrom(valor) : await valor).not.toBe(true);
  });
});
