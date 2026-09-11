import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { routes } from './app.routes';
import { UsuarioLoginInfo } from './core/models/auth.models';
import { tieneAlcanceNacionalConsulta } from './core/utils/alcance-consulta.utils';
import { SessionService } from './core/services/session.service';
import { SemanalEnviosService } from './core/services/semanal-envios.service';
import { CrudRegistros } from './pages/crud-registros/crud-registros';
import { SemanalUsuarios } from './pages/semanal-usuarios/semanal-usuarios';
import { SemanalPlanos } from './pages/semanal-planos/semanal-planos';

const usuario = (rol: string, idEntidadFederativa: number | null) => ({
  rol, idEntidadFederativa, entidadFederativa: idEntidadFederativa ? 'México' : null,
} as UsuarioLoginInfo);

describe('Consulta nacional y estatal', () => {
  const sesion = signal<UsuarioLoginInfo | null>(null);
  beforeEach(() => {
    TestBed.resetTestingModule();
    sesion.set(usuario('CONSULTA', null));
    TestBed.configureTestingModule({ providers: [provideHttpClient(),
      { provide: SessionService, useValue: { usuario: sesion } },
    ] });
  });

  it('sólo Consulta sin entidad y superusuario tienen alcance nacional', () => {
    expect(tieneAlcanceNacionalConsulta(usuario('CONSULTA', null))).toBe(true);
    expect(tieneAlcanceNacionalConsulta(usuario('CONSULTA', 15))).toBe(false);
    expect(tieneAlcanceNacionalConsulta(usuario('ENLACE_ESTATAL', null))).toBe(false);
    expect(tieneAlcanceNacionalConsulta(usuario('ENLACE_ESTATAL', 15))).toBe(false);
    expect(tieneAlcanceNacionalConsulta(usuario('SUPER_USUARIO', null))).toBe(true);
    expect(tieneAlcanceNacionalConsulta(null)).toBe(false);
  });

  for (const [nombre, clase] of [['mensual', CrudRegistros], ['semanal', SemanalUsuarios]] as const) {
    it(`alta ${nombre}: exige elección explícita y convierte Nacional a NULL`, () => {
      const component = TestBed.runInInjectionContext(() => new clase());
      component.formulario.update((f: any) => ({ ...f, nombre: 'Consulta', primerApellido: 'Prueba',
        correoElectronico: 'consulta@example.test', usuario: 'consulta', password: 'Prueba1234',
        rol: 'CONSULTA', habilitaMensual: true, habilitaSemanal: true, idEntidadFederativa: '',
      }));
      expect(component.formularioValido()).toBe(false);
      (component as any).actualizarCampo('idEntidadFederativa', 'NACIONAL');
      expect(component.formularioValido()).toBe(true);
      expect((component as any).obtenerEntidadParaRequest(component.formulario())).toBeNull();
      (component as any).actualizarCampo('idEntidadFederativa', '15');
      expect((component as any).obtenerEntidadParaRequest(component.formulario())).toBe(15);
    });

    it(`edición ${nombre}: no conserva Nacional al cambiar a enlace ni permisos al cambiar a Consulta`, () => {
      const component = TestBed.runInInjectionContext(() => new clase());
      component.formulario.update((f: any) => ({ ...f, rol: 'CONSULTA', idEntidadFederativa: 'NACIONAL' }));
      (component as any).actualizarCampo('rol', 'ENLACE_ESTATAL');
      expect(component.formulario().idEntidadFederativa).toBe('');
      component.formulario.update((f: any) => ({ ...f, habilitaMensual: true, habilitaSemanal: true,
        habilitaCarga: true, habilitaModificacion: true, habilitaCargaSemanal: true, administraDelitosSemanal: true }));
      (component as any).actualizarCampo('rol', 'CONSULTA');
      expect(component.formulario().habilitaCargaSemanal).toBe(false);
      expect(component.formulario().administraDelitosSemanal).toBe(false);
      if (component instanceof CrudRegistros) {
        expect(component.formulario().habilitaCarga).toBe(false);
        expect(component.formulario().habilitaModificacion).toBe(false);
      }
    });
  }

  it('Consulta nacional puede seleccionar entidad pero sólo solicita CONFIRMADO', () => {
    const obtener = vi.fn(() => of({ entidades: [], delitos: [] }));
    TestBed.overrideProvider(SemanalEnviosService, { useValue: { obtenerOpcionesReportePreliminar: obtener } });
    const component = TestBed.runInInjectionContext(() => new SemanalPlanos());
    component.modoReporte.set('MIXTO');
    component.idEntidadSeleccionada.set(15);
    component.cargarOpciones();
    expect(obtener).toHaveBeenLastCalledWith(component.anioCorte(), component.mesCorte(), 'CONFIRMADO', 15);
    sesion.set(usuario('CONSULTA', 15));
    component.idEntidadSeleccionada.set(2);
    component.cargarOpciones();
    expect(obtener).toHaveBeenLastCalledWith(component.anioCorte(), component.mesCorte(), 'CONFIRMADO', null);
    expect(component.descripcionAlcance()).toContain('tu entidad');
  });

  it('Consulta mantiene acceso a informes y carece de rutas de carga y administración en los tres módulos', () => {
    for (const path of ['', 'semanal', 'federal']) {
      const modulo = routes.find(r => r.path === path && r.children)!;
      const envios = modulo.children!.find(r => r.path === 'informes/envios')!;
      expect(envios.data?.['roles']).toContain('CONSULTA');
      for (const route of modulo.children!.filter(r => r.path?.startsWith('administracion/') || ['carga', 'carga-inicial'].includes(r.path ?? ''))) {
        expect(route.data?.['roles']).not.toContain('CONSULTA');
      }
    }
  });
});
