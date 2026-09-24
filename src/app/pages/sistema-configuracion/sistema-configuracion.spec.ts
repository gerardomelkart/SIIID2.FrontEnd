import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SistemaConfiguracionPage } from './sistema-configuracion';
import { SistemaConfiguracionService } from '../../core/services/sistema-configuracion.service';

describe('Configuración del sistema', () => {
  const datos = { version: 7, modulos: [{ clave: 'BANCI', nombre: 'BANCI', activo: true }, { clave: 'SEMANAL', nombre: 'Semanal', activo: true }], opciones: [{ modulo: 'BANCI', clave: 'RENAPO', descripcion: 'RENAPO', habilitado: true, disponible: true, efectivo: true }, { modulo: 'BANCI', clave: 'CRUCE_BANCI', descripcion: 'Cruce', habilitado: false, disponible: false, efectivo: false }] };
  let servicio: { obtener: ReturnType<typeof vi.fn>; cambiar: ReturnType<typeof vi.fn>; bitacora: ReturnType<typeof vi.fn>; refrescarSesion: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    servicio = { obtener: vi.fn(() => of(datos)), cambiar: vi.fn(() => of({ version: 8, modificado: true })), bitacora: vi.fn(() => of([])), refrescarSesion: vi.fn(() => of({ administraSistema: true, modulos: [] })) };
    TestBed.configureTestingModule({ imports: [SistemaConfiguracionPage], providers: [provideRouter([]), { provide: SistemaConfiguracionService, useValue: servicio }] });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('muestra interruptores y deja municipio semanal fuera de configuración', () => {
    const f = TestBed.createComponent(SistemaConfiguracionPage); f.detectChanges();
    const switches = f.nativeElement.querySelectorAll('[role="switch"]');
    expect(switches.length).toBe(2); expect(switches[1].disabled).toBe(true);
    expect(f.nativeElement.textContent).toContain('contra municipio permanece activa');
  });
  it('preparar y cancelar no guarda', () => {
    const c = TestBed.createComponent(SistemaConfiguracionPage).componentInstance;
    c.preparar('BANCI', 'MODULO_ACTIVO', false, 'BANCI'); c.cancelar();
    expect(c.cambio()).toBeNull(); expect(servicio.cambiar).not.toHaveBeenCalled();
  });
  it('requiere motivo y envía la versión leída sin modificar el objeto local', () => {
    const c = TestBed.createComponent(SistemaConfiguracionPage).componentInstance;
    c.preparar('BANCI', 'RENAPO', false, 'RENAPO'); c.guardar(); expect(servicio.cambiar).not.toHaveBeenCalled();
    c.motivo = '  Prueba  '; c.guardar();
    expect(servicio.cambiar).toHaveBeenCalledWith({ modulo: 'BANCI', clave: 'RENAPO', habilitado: false, versionEsperada: 7, motivo: 'Prueba' });
    expect(datos.opciones[0].habilitado).toBe(true); expect(servicio.refrescarSesion).toHaveBeenCalled();
  });
  it('no envía cambios duplicados mientras guarda', () => {
    servicio.cambiar.mockReturnValue(new Subject());
    const c = TestBed.createComponent(SistemaConfiguracionPage).componentInstance;
    c.preparar('BANCI', 'MODULO_ACTIVO', false, 'BANCI'); c.motivo = 'Prueba'; c.guardar(); c.guardar();
    expect(servicio.cambiar).toHaveBeenCalledTimes(1);
  });
  it('no permite activar un cruce pendiente', () => {
    const c = TestBed.createComponent(SistemaConfiguracionPage).componentInstance;
    c.preparar('BANCI', 'CRUCE_BANCI', true, 'Cruce'); expect(c.cambio()).toBeNull();
  });
  it('un conflicto invalida la pantalla y exige recargar antes de otro cambio', () => {
    servicio.cambiar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { mensaje: 'La configuración cambió' } })));
    const c = TestBed.createComponent(SistemaConfiguracionPage).componentInstance;
    c.preparar('BANCI', 'MODULO_ACTIVO', false, 'BANCI'); c.motivo = 'Prueba'; c.guardar();
    expect(c.datos()).toBeNull(); expect(c.error()).toContain('configuración cambió'); expect(c.exito()).toBe('');
  });
});
