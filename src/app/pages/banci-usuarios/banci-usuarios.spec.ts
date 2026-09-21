import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BanciUsuarios } from './banci-usuarios';
import { BanciUsuariosService } from '../../core/services/banci-usuarios.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { SessionService } from '../../core/services/session.service';
import { BanciUsuarioDetalle } from '../../core/models/banci-usuarios.models';

const cuenta = (cambios: Partial<BanciUsuarioDetalle> = {}): BanciUsuarioDetalle => ({ idUsuario: 20, idEntidadFederativa: 14, entidadFederativa: 'Jalisco', usuario: 'prueba', nombre: 'Enlace', primerApellido: 'Prueba', segundoApellido: null, nombreCompleto: 'Enlace Prueba', correoElectronico: 'prueba@example.test', rfc: null, curp: null, telefonoContacto: null, idRol: 2, rol: 'ENLACE_ESTATAL', habilitaBanci: true, habilitaCarga: true, habilitaModificacion: false, activo: true, activoCuenta: true, tieneBanci: true, tieneOtrosModulos: false, fechaAlta: '', fechaModificacion: '', ...cambios });

describe('Administración propia BANCI', () => {
  let servicio: { obtenerUsuarios: ReturnType<typeof vi.fn>; obtenerDetalle: ReturnType<typeof vi.fn>; crearUsuario: ReturnType<typeof vi.fn>; editarUsuario: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    servicio = { obtenerUsuarios: vi.fn(() => of({ usuarios: [] })), obtenerDetalle: vi.fn(() => of({ esValido: true, usuario: cuenta() })), crearUsuario: vi.fn(() => of({ esValido: true })), editarUsuario: vi.fn(() => of({ esValido: true })) };
    TestBed.configureTestingModule({ imports: [BanciUsuarios], providers: [
      { provide: BanciUsuariosService, useValue: servicio },
      { provide: CatalogosService, useValue: { obtenerEntidadesFederativas: () => of([{ idEntidadFederativa: 14, clave: '14', nombre: 'Jalisco' }]) } },
      { provide: SessionService, useValue: { usuario: () => ({ idUsuario: 1, rol: 'SUPER_USUARIO' }) } },
    ] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });
  it('Ver todos incluye cuentas existentes sin habilitación BANCI', () => {
    const c = TestBed.createComponent(BanciUsuarios).componentInstance;
    c.usuarios.set([cuenta(), cuenta({ idUsuario: 21, habilitaBanci: false, tieneBanci: false })]);
    expect(c.usuariosFiltrados()).toHaveLength(1);
    c.cambiarFiltroTodos(true);
    expect(c.usuariosFiltrados()).toHaveLength(2);
  });
  it('Mostrar inactivos conserva las cuentas desactivadas en BANCI', () => {
    const c = TestBed.createComponent(BanciUsuarios).componentInstance;
    c.usuarios.set([cuenta({ activo: false, habilitaBanci: false })]);
    expect(c.usuariosFiltrados()).toHaveLength(0);
    c.mostrarInactivos.set(true);
    expect(c.usuariosFiltrados()).toHaveLength(1);
  });
  it('exige entidad estatal al enlace y admite Consulta nacional sin entidad', () => {
    const c = TestBed.createComponent(BanciUsuarios).componentInstance;
    c.formulario.update(f => ({ ...f, nombre: 'Prueba', primerApellido: 'Uno', correoElectronico: 'uno@example.test', usuario: 'uno', password: 'Temporal123', rol: 'ENLACE_ESTATAL', idEntidadFederativa: null }));
    expect(c.formularioValido()).toBe(false);
    c.actualizarCampo('idEntidadFederativa', 14);
    expect(c.formularioValido()).toBe(true);
    c.actualizarCampo('rol', 'CONSULTA'); c.actualizarCampo('idEntidadFederativa', null);
    expect(c.formularioValido()).toBe(true);
    expect(c.formulario().habilitaCarga).toBe(false);
    expect(c.formulario().habilitaModificacion).toBe(false);
  });
  it('un nuevo superusuario conserva todos los permisos', () => {
    const c = TestBed.createComponent(BanciUsuarios).componentInstance;
    c.actualizarCampo('rol', 'CONSULTA'); c.actualizarCampo('rol', 'SUPER_USUARIO');
    expect(c.formulario().habilitaBanci && c.formulario().habilitaCarga && c.formulario().habilitaModificacion).toBe(true);
    expect(c.formulario().idEntidadFederativa).toBeNull();
  });
  it('no desactiva a otro superusuario aunque existan varios', () => {
    const c = TestBed.createComponent(BanciUsuarios).componentInstance;
    c.usuarios.set([cuenta({ rol: 'SUPER_USUARIO' }), cuenta({ idUsuario: 21, rol: 'SUPER_USUARIO' })]);
    expect(c.puedeCambiarEstado(c.usuarios()[0])).toBe(false);
  });
  it('editar una cuenta compartida bloquea rol y entidad pero permite habilitar BANCI', async () => {
    const fixture = TestBed.createComponent(BanciUsuarios); const c = fixture.componentInstance;
    const usuario = cuenta({ tieneOtrosModulos: true, tieneBanci: false, habilitaBanci: false });
    servicio.obtenerDetalle.mockReturnValue(of({ esValido: true, usuario }));
    fixture.detectChanges(); c.usuarios.set([usuario]); c.abrirEditarUsuario(usuario); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(c.bloquearRolFormulario()).toBe(true);
    expect(c.bloquearAccesoFormulario()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Los datos de la cuenta y su contraseña son compartidos');
    const selector = fixture.nativeElement.querySelectorAll('select')[1];
    expect(selector.disabled).toBe(true);
  });
  it('no reactiva globalmente una cuenta inactiva de otro módulo', () => {
    const c = TestBed.createComponent(BanciUsuarios).componentInstance;
    expect(c.puedeCambiarEstado(cuenta({ activo: false, activoCuenta: false, tieneOtrosModulos: true }))).toBe(false);
  });
});
