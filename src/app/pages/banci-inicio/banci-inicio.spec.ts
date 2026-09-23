import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { BanciInicio } from './banci-inicio';
import { SessionService } from '../../core/services/session.service';

describe('Inicio BANCI y permisos', () => {
  afterEach(() => TestBed.resetTestingModule());
  it.each([
    ['CONSULTA', false, false, false, false],
    ['ENLACE_ESTATAL', true, false, true, false],
    ['ENLACE_ESTATAL', false, true, false, true],
    ['SUPER_USUARIO', false, false, true, true]
  ])('%s respeta carga=%s y actualización=%s', (rol, carga, actualizacion, verCarga, verActualizacion) => {
    TestBed.configureTestingModule({ imports: [BanciInicio], providers: [provideRouter([]), { provide: SessionService, useValue: { usuario: () => ({ rol }), habilitaCarga: () => carga, habilitaModificacion: () => actualizacion } }] });
    const f = TestBed.createComponent(BanciInicio); f.detectChanges();
    expect(!!f.nativeElement.querySelector('a[href="/banci/carga-masiva"]')).toBe(verCarga);
    expect(!!f.nativeElement.querySelector('a[href="/banci/actualizacion/manual"]')).toBe(verActualizacion);
    expect(!!f.nativeElement.querySelector('a[href="/banci/actualizacion/masiva"]')).toBe(verActualizacion);
    expect(f.nativeElement.textContent).not.toContain('Histórico BANCI');
    expect(f.nativeElement.textContent).not.toContain('En desarrollo');
  });
});
