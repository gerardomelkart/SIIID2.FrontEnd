import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import Swal from 'sweetalert2';
import { BanciConfiguracion } from './banci-configuracion';
import { BanciUsuariosService } from '../../core/services/banci-usuarios.service';
import { SessionService } from '../../core/services/session.service';
import { BanciUsuarioDetalle } from '../../core/models/banci-usuarios.models';

const base: BanciUsuarioDetalle = { idUsuario: 1, idEntidadFederativa: 9, entidadFederativa: 'Ciudad de México', usuario: 'enlace1', nombre: 'Enlace', primerApellido: 'Uno', segundoApellido: null, nombreCompleto: 'Enlace Uno', correoElectronico: 'enlace@example.test', rfc: null, curp: null, telefonoContacto: null, idRol: 2, rol: 'ENLACE_ESTATAL', habilitaBanci: true, habilitaCarga: true, habilitaModificacion: false, activo: true, activoCuenta: true, tieneBanci: true, tieneOtrosModulos: true, fechaAlta: '', fechaModificacion: '' };
const datos = [base, { ...base, idUsuario: 2, usuario: 'enlace2', habilitaCarga: false }, { ...base, idUsuario: 3, usuario: 'consulta', rol: 'CONSULTA', habilitaCarga: false }, { ...base, idUsuario: 4, usuario: 'administrador', rol: 'SUPER_USUARIO' }, { ...base, idUsuario: 5, usuario: 'inactivo', activo: false }];

describe('Configuración de permisos BANCI como consolidado', () =>
{
    let api: { obtenerUsuarios: ReturnType<typeof vi.fn>; actualizarPermisos: ReturnType<typeof vi.fn>; actualizarPermisosGlobales: ReturnType<typeof vi.fn> };
    beforeEach(() =>
    {
        api = { obtenerUsuarios: vi.fn(() => of({ usuarios: datos })), actualizarPermisos: vi.fn(() => of({ esValido: true, mensaje: 'Guardado' })), actualizarPermisosGlobales: vi.fn(() => of({ esValido: true, mensaje: 'Guardado' })) };
        TestBed.configureTestingModule({ providers: [{ provide: BanciUsuariosService, useValue: api }, { provide: SessionService, useValue: { usuario: () => ({ idUsuario: 99 }) } }] });
        vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false });
    });
    afterEach(() => vi.restoreAllMocks());
    function crear() { const f = TestBed.createComponent(BanciConfiguracion); f.detectChanges(); return f; }
    it('muestra configuración global, resumen y permisos por entidad sin reglas del sistema', () =>
    {
        const f = crear();
        const texto = f.nativeElement.textContent;
        expect(texto).toContain('Configuración global');
        expect(texto).toContain('Configuración por entidad');
        expect(texto).not.toContain('Cortes y validaciones');
        expect(texto).not.toContain('Motivo del cambio');
        expect(texto).not.toContain('consolidado');
        expect(f.componentInstance.usuarios().some(u => u.rol === 'SUPER_USUARIO')).toBe(false);
    });
    it('calcula permisos mixtos desde los usuarios reales y excluye inactivos y administradores', () =>
    {
        const c = crear().componentInstance;
        const entidad = c.entidadesConfiguracion()[0];
        expect(entidad.totalUsuarios).toBe(3);
        expect(entidad.totalUsuariosOperativos).toBe(2);
        expect(entidad.estadoCarga).toBe('MIXTO');
        expect(entidad.usuariosCarga).toBe(1);
        expect(c.habilitaCargaGlobal()).toBe(false);
        expect(c.habilitaModificacionGlobal()).toBe(false);
    });
    it('el rol CONSULTA conserva acceso pero no permite carga o actualización', () =>
    {
        const c = crear().componentInstance;
        c.abrirPermisosEntidad(c.entidadesConfiguracion()[0]);
        c.cambiarPermisoUsuarioEntidad(3, 'habilitaCarga', true);
        expect(c.usuariosEntidad().find(u => u.idUsuario === 3)?.habilitaCarga).toBe(false);
        c.cambiarPermisoUsuarioEntidad(1, 'habilitaBanci', false);
        const usuario = c.usuariosEntidad().find(u => u.idUsuario === 1)!;
        expect(usuario.habilitaBanci).toBe(false);
        expect(usuario.habilitaCarga).toBe(false);
        expect(usuario.habilitaModificacion).toBe(false);
    });
    it('guarda solo los tres permisos BANCI modificados sin editar perfil ni otros módulos', async () =>
    {
        const c = crear().componentInstance;
        c.abrirPermisosEntidad(c.entidadesConfiguracion()[0]);
        c.cambiarPermisoUsuarioEntidad(1, 'habilitaModificacion', true);
        c.guardarPermisosEntidad(); await Promise.resolve();
        expect(api.actualizarPermisos).toHaveBeenCalledExactlyOnceWith(1, { habilitaBanci: true, habilitaCarga: true, habilitaModificacion: true });
        expect(c.modalEntidadAbierto()).toBe(false);
    });
    it('aplica los controles globales mediante el servicio exclusivo de BANCI', async () =>
    {
        const c = crear().componentInstance;
        c.cambiarCargaGlobal(false); c.cambiarModificacionGlobal(true);
        c.guardarConfiguracionGlobal(); await Promise.resolve();
        expect(api.actualizarPermisosGlobales).toHaveBeenCalledExactlyOnceWith({ habilitaCarga: false, habilitaModificacion: true });
    });
    it('permite buscar entidades y cancelar cambios locales sin guardarlos', () =>
    {
        const c = crear().componentInstance;
        c.buscarEntidades('Ciudad de México');
        expect(c.entidadesFiltradas().length).toBe(1);
        c.abrirPermisosEntidad(c.entidadesFiltradas()[0]);
        c.cambiarPermisoUsuarioEntidad(1, 'habilitaBanci', false);
        expect(c.hayCambiosEntidad()).toBe(true);
        c.cerrarPermisosEntidad();
        expect(c.usuarios().find(u => u.idUsuario === 1)?.habilitaBanci).toBe(true);
        expect(api.actualizarPermisos).not.toHaveBeenCalled();
    });
});
