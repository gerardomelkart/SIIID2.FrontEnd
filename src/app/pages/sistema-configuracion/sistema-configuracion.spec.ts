import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SistemaConfiguracionPage } from './sistema-configuracion';
import { SistemaConfiguracionService } from '../../core/services/sistema-configuracion.service';

describe('Configuración del sistema', () => {
  const datos = { version: 7, modulos: [{ clave: 'BANCI', nombre: 'BANCI', activo: true }, { clave: 'SEMANAL', nombre: 'Semanal', activo: true }], opciones: [{ modulo: 'BANCI', clave: 'RENAPO', descripcion: 'RENAPO', habilitado: true, disponible: true, efectivo: true }, { modulo: 'BANCI', clave: 'CRUCE_BANCI', descripcion: 'Cruce', habilitado: false, disponible: false, efectivo: false }] };
  const usuarios = [{ idUsuario: 1, usuario: 'ADMIN1', nombreCompleto: 'Administrador uno', habilitado: true, esActual: true }, { idUsuario: 2, usuario: 'ADMIN2', nombreCompleto: 'Administrador dos', habilitado: false, esActual: false }];
  let servicio: { administradores: ReturnType<typeof vi.fn>; cambiarAdministrador: ReturnType<typeof vi.fn>; obtener: ReturnType<typeof vi.fn>; cambiar: ReturnType<typeof vi.fn>; bitacora: ReturnType<typeof vi.fn>; refrescarSesion: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    servicio = { administradores: vi.fn(() => of({ version: 7, usuarios })), cambiarAdministrador: vi.fn(() => of({ version: 8, modificado: true })), obtener: vi.fn(() => of(datos)), cambiar: vi.fn(() => of({ version: 8, modificado: true })), bitacora: vi.fn(() => of([])), refrescarSesion: vi.fn(() => of({ administraSistema: true, modulos: [] })) };
    TestBed.configureTestingModule({ imports: [SistemaConfiguracionPage], providers: [provideRouter([]), { provide: SistemaConfiguracionService, useValue: servicio }] });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('muestra interruptores y deja municipio semanal fuera de configuración', () => {
    const f = TestBed.createComponent(SistemaConfiguracionPage); f.detectChanges();
    const switches = f.nativeElement.querySelectorAll('.modulo-config [role="switch"]');
    expect(switches.length).toBe(2); expect(switches[1].disabled).toBe(true);
    expect(f.nativeElement.textContent).toContain('contra municipio permanece activa');
  });
  it('no permite retirar el acceso propio', () => {
    const c = TestBed.createComponent(SistemaConfiguracionPage).componentInstance;
    c.prepararAdministrador(usuarios[0]); expect(c.cambio()).toBeNull();
  });
  it('concede acceso a otro superusuario mediante el endpoint específico', () => {
    const c = TestBed.createComponent(SistemaConfiguracionPage).componentInstance;
    c.prepararAdministrador(usuarios[1]); c.guardar();
    expect(servicio.cambiarAdministrador).toHaveBeenCalledWith(2, { habilitado: true, versionEsperada: 7, motivo: 'Sin motivo reportado' });
    expect(servicio.cambiar).not.toHaveBeenCalled(); expect(servicio.administradores).toHaveBeenCalledTimes(2);
  });
  it('filtra por nombre y usuario', () => {
    const c = TestBed.createComponent(SistemaConfiguracionPage).componentInstance;
    c.buscarUsuario = ' dos '; expect(c.usuariosFiltrados().map(u => u.idUsuario)).toEqual([2]);
    c.buscarUsuario = 'admin1'; expect(c.usuariosFiltrados().map(u => u.idUsuario)).toEqual([1]);
  });
  it('rechazo de permiso invalida la tabla', () => {
    servicio.cambiarAdministrador.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    const c = TestBed.createComponent(SistemaConfiguracionPage).componentInstance;
    c.prepararAdministrador(usuarios[1]); c.guardar(); expect(c.administradores()).toBeNull(); expect(c.exito()).toBe('');
  });
  it('preparar y cancelar no guarda', () => {
    const c = TestBed.createComponent(SistemaConfiguracionPage).componentInstance;
    c.preparar('BANCI', 'MODULO_ACTIVO', false, 'BANCI'); c.cancelar();
    expect(c.cambio()).toBeNull(); expect(servicio.cambiar).not.toHaveBeenCalled();
  });
  it('normaliza motivo y envía la versión leída sin modificar el objeto local', () => {
    const c = TestBed.createComponent(SistemaConfiguracionPage).componentInstance;
    c.preparar('BANCI', 'RENAPO', false, 'RENAPO');
    c.motivo = '  Prueba  '; c.guardar();
    expect(servicio.cambiar).toHaveBeenCalledWith({ modulo: 'BANCI', clave: 'RENAPO', habilitado: false, versionEsperada: 7, motivo: 'Prueba' });
    expect(datos.opciones[0].habilitado).toBe(true); expect(servicio.refrescarSesion).toHaveBeenCalled();
  });
  it('acepta motivo vacío o espacios y registra el valor predeterminado', () => {
    const f = TestBed.createComponent(SistemaConfiguracionPage), c = f.componentInstance;
    for (const motivo of ['', '   ']) {
      c.preparar('BANCI', 'RENAPO', false, 'RENAPO'); c.motivo = motivo; f.detectChanges();
      expect(f.nativeElement.querySelector('.dialogo .btn-primary').disabled).toBe(false); c.guardar();
      expect(servicio.cambiar).toHaveBeenLastCalledWith({ modulo: 'BANCI', clave: 'RENAPO', habilitado: false, versionEsperada: 7, motivo: 'Sin motivo reportado' });
    }
  });
  it('rechaza motivos cortos no vacíos y conserva el diálogo', () => {
    const c = TestBed.createComponent(SistemaConfiguracionPage).componentInstance;
    c.preparar('BANCI', 'RENAPO', false, 'RENAPO'); c.motivo = 'x'; c.guardar();
    expect(servicio.cambiar).not.toHaveBeenCalled(); expect(c.cambio()).not.toBeNull();
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
