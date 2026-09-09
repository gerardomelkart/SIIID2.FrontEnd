import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ROLES } from '../../core/constants/roles.constants';
import {
  CrearUsuarioFederalRequest,
  EditarUsuarioFederalRequest,
  FederalUsuarioDetalle,
  FederalUsuarioOperacionResponse,
} from '../../core/models/federal-usuarios.models';
import { FederalUsuariosService } from '../../core/services/federal-usuarios.service';
import { SessionService } from '../../core/services/session.service';
import {
  confirmarAccion,
  mostrarAdvertencia,
  mostrarError,
  mostrarExitoInstitucional,
  mostrarInfo,
} from '../../core/utils/alert.utils';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';
import {
  EstadoOrden,
  ValorOrden,
  alternarOrden,
  obtenerIconoOrden,
  ordenarPorEstado,
} from '../../core/utils/sort.utils';

type ModoFormulario = 'NUEVO' | 'EDITAR';

interface UsuarioFederalForm {
  idUsuario: number | null;
  nombre: string;
  primerApellido: string;
  segundoApellido: string;
  rfc: string;
  curp: string;
  correoElectronico: string;
  telefonoContacto: string;
  usuario: string;
  password: string;
  rol: string;
  habilitaFederal: boolean;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  tieneOtrosModulos: boolean;
}

type CampoOrdenUsuariosFederal =
  | 'nombreCompleto'
  | 'usuario'
  | 'correoElectronico'
  | 'rol'
  | 'habilitaFederal'
  | 'habilitaCarga'
  | 'habilitaModificacion'
  | 'activo';

@Component({
  selector: 'app-federal-usuarios',
  imports: [FormsModule],
  templateUrl: './federal-usuarios.html',
  styleUrl: './federal-usuarios.css',
})
export class FederalUsuarios implements OnInit {
  private readonly usuariosService = inject(FederalUsuariosService);
  private readonly sessionService = inject(SessionService);

  readonly rolesDisponibles = [
    ROLES.SUPER_USUARIO,
    ROLES.ENLACE_ESTATAL,
    ROLES.CONSULTA,
  ];

  ordenUsuarios = signal<EstadoOrden<CampoOrdenUsuariosFederal> | null>(null);

  usuarios = signal<FederalUsuarioDetalle[]>([]);
  formulario = signal<UsuarioFederalForm>(this.crearFormularioVacio());

  busqueda = signal('');
  mostrarInactivos = signal(false);

  paginaUsuarios = signal(1);
  readonly tamanioPaginaUsuarios = 10;

  cargando = signal(false);
  guardando = signal(false);
  exportandoExcel = signal(false);

  modalAbierto = signal(false);
  modoFormulario = signal<ModoFormulario>('NUEVO');

  usuarioActual = this.sessionService.usuario;

  usuariosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();

    const filtrados = this.usuarios().filter((usuario) => {
      if (!texto) return true;

      return (
        usuario.nombreCompleto?.toLowerCase().includes(texto) ||
        usuario.usuario?.toLowerCase().includes(texto) ||
        usuario.correoElectronico?.toLowerCase().includes(texto) ||
        usuario.rol?.toLowerCase().includes(texto)
      );
    });

    return this.ordenarListaUsuarios(filtrados);
  });

  usuariosPaginados = computed(() => {
    const inicio = (this.paginaUsuarios() - 1) * this.tamanioPaginaUsuarios;

    return this.usuariosFiltrados().slice(
      inicio,
      inicio + this.tamanioPaginaUsuarios,
    );
  });

  totalPaginasUsuarios = computed(() =>
    Math.max(
      1,
      Math.ceil(this.usuariosFiltrados().length / this.tamanioPaginaUsuarios),
    ),
  );

  totalUsuarios = computed(() => this.usuarios().length);

  totalActivos = computed(
    () => this.usuarios().filter((usuario) => usuario.activo).length,
  );

  totalInactivos = computed(
    () => this.usuarios().filter((usuario) => !usuario.activo).length,
  );

  totalConFederal = computed(
    () =>
      this.usuarios().filter(
        (usuario) => usuario.activo && usuario.habilitaFederal,
      ).length,
  );

  totalSuperUsuariosActivos = computed(
    () =>
      this.usuarios().filter(
        (usuario) =>
          usuario.activo &&
          usuario.habilitaFederal &&
          usuario.rol === ROLES.SUPER_USUARIO,
      ).length,
  );

  formularioValido = computed(() => {
    const form = this.formulario();

    if (
      form.nombre.trim() === '' ||
      form.primerApellido.trim() === '' ||
      form.correoElectronico.trim() === '' ||
      form.usuario.trim() === '' ||
      form.rol.trim() === ''
    ) {
      return false;
    }

    if (!form.habilitaFederal && this.modoFormulario() === 'NUEVO') {
      return false;
    }

    if (this.modoFormulario() === 'NUEVO' && form.password.length < 8) {
      return false;
    }

    if (
      this.modoFormulario() === 'EDITAR' &&
      form.password.length > 0 &&
      form.password.length < 8
    ) {
      return false;
    }

    return true;
  });

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  ordenarUsuariosPor(campo: CampoOrdenUsuariosFederal): void {
    this.ordenUsuarios.set(alternarOrden(this.ordenUsuarios(), campo));
    this.paginaUsuarios.set(1);
  }

  iconoOrdenUsuarios(campo: CampoOrdenUsuariosFederal): string {
    return obtenerIconoOrden(this.ordenUsuarios(), campo);
  }

  buscarUsuarios(valor: string): void {
    this.busqueda.set(valor);
    this.paginaUsuarios.set(1);
  }

  cambiarPaginaUsuarios(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginasUsuarios()) return;

    this.paginaUsuarios.set(pagina);
  }

  cambiarFiltroInactivos(valor: boolean): void {
    this.mostrarInactivos.set(valor);
    this.paginaUsuarios.set(1);
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.cargando.set(true);

    this.usuariosService.obtenerUsuarios(this.mostrarInactivos()).subscribe({
      next: (response) => {
        this.usuarios.set(response.usuarios ?? []);
        this.paginaUsuarios.set(1);
        this.cargando.set(false);
      },
      error: (error) => {
        this.cargando.set(false);

        mostrarError(
          'No fue posible cargar usuarios Federal',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  async exportarUsuariosExcel(): Promise<void> {
    this.exportandoExcel.set(true);

    try {
      const filas = this.usuariosFiltrados().map((usuario) => ({
        Nombre: usuario.nombreCompleto,
        Usuario: usuario.usuario,
        Correo: usuario.correoElectronico,
        Rol: usuario.rol,
        'Acceso Federal': usuario.habilitaFederal ? 'Sí' : 'No',
        Carga: usuario.habilitaCarga ? 'Sí' : 'No',
        Actualización: usuario.habilitaModificacion ? 'Sí' : 'No',
        'Otros módulos': usuario.tieneOtrosModulos ? 'Sí' : 'No',
        Estado: usuario.activo ? 'ACTIVO' : 'INACTIVO',
      }));

      const exportado = await exportarFilasExcel(
        filas,
        'usuarios_modulo_federal.xlsx',
        'Usuarios',
      );

      if (!exportado) {
        mostrarInfo('Sin registros', 'No hay información para exportar.');
      }
    } catch {
      mostrarError('No fue posible exportar', 'Intente nuevamente.');
    } finally {
      this.exportandoExcel.set(false);
    }
  }

  abrirNuevoUsuario(): void {
    this.modoFormulario.set('NUEVO');
    this.formulario.set(this.crearFormularioVacio());
    this.modalAbierto.set(true);
  }

  abrirEditarUsuario(usuario: FederalUsuarioDetalle): void {
    if (!usuario.activo) {
      mostrarAdvertencia(
        'Usuario inactivo',
        'Reactive el usuario antes de editar sus datos.',
      );
      return;
    }

    this.cargando.set(true);

    this.usuariosService.obtenerDetalle(usuario.idUsuario).subscribe({
      next: (response) => {
        this.cargando.set(false);

        if (!response.esValido || !response.usuario) {
          mostrarAdvertencia(
            'Usuario no encontrado',
            response.mensaje || 'No fue posible obtener el detalle.',
          );
          return;
        }

        this.modoFormulario.set('EDITAR');
        this.formulario.set(this.mapearDetalleAFormulario(response.usuario));
        this.modalAbierto.set(true);
      },
      error: (error) => {
        this.cargando.set(false);

        mostrarError(
          'No fue posible obtener el usuario',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  cerrarModal(): void {
    if (this.guardando()) return;

    this.modalAbierto.set(false);
    this.formulario.set(this.crearFormularioVacio());
  }

  guardarUsuario(): void {
    if (!this.formularioValido()) {
      mostrarAdvertencia(
        'Formulario incompleto',
        'Revise los campos obligatorios. La contraseña debe tener al menos 8 caracteres.',
      );
      return;
    }

    const form = this.formulario();

    if (this.modoFormulario() === 'NUEVO') {
      this.crearUsuario(form);
      return;
    }

    this.editarUsuario(form);
  }

  cambiarEstado(usuario: FederalUsuarioDetalle): void {
    if (!this.puedeCambiarEstado(usuario)) {
      mostrarAdvertencia(
        'Operación no permitida',
        this.motivoBloqueoEstado(usuario),
      );
      return;
    }

    if (usuario.activo) {
      void this.confirmarDesactivacion(usuario);
      return;
    }

    void this.confirmarReactivacion(usuario);
  }

  actualizarCampo<K extends keyof UsuarioFederalForm>(
    campo: K,
    valor: UsuarioFederalForm[K],
  ): void {
    this.formulario.update((actual) => ({
      ...actual,
      [campo]: valor,
    }));

    if (campo === 'rol') {
      this.normalizarPermisosPorRol(valor as string);
    }

    if (campo === 'habilitaFederal' && valor === false) {
      this.formulario.update((actual) => ({
        ...actual,
        habilitaCarga: false,
        habilitaModificacion: false,
      }));
    }
  }

  esUsuarioActual(usuario: FederalUsuarioDetalle): boolean {
    return usuario.idUsuario === this.usuarioActual()?.idUsuario;
  }

  esUsuarioActualFormulario(): boolean {
    return (
      this.modoFormulario() === 'EDITAR' &&
      this.formulario().idUsuario === this.usuarioActual()?.idUsuario
    );
  }

  esUnicoSuperUsuarioActivo(usuario: FederalUsuarioDetalle): boolean {
    return (
      usuario.activo &&
      usuario.habilitaFederal &&
      usuario.rol === ROLES.SUPER_USUARIO &&
      this.totalSuperUsuariosActivos() === 1
    );
  }

  puedeCambiarEstado(usuario: FederalUsuarioDetalle): boolean {
    if (this.esUsuarioActual(usuario)) return false;
    if (this.esUnicoSuperUsuarioActivo(usuario)) return false;

    return true;
  }

  motivoBloqueoEstado(usuario: FederalUsuarioDetalle): string {
    if (this.esUsuarioActual(usuario)) {
      return 'No puedes desactivar tu propio usuario';
    }

    if (this.esUnicoSuperUsuarioActivo(usuario)) {
      return 'No puedes desactivar el único superusuario Federal activo';
    }

    return usuario.activo ? 'Desactivar usuario' : 'Reactivar usuario';
  }

  bloquearRolFormulario(): boolean {
    if (this.modoFormulario() === 'NUEVO') return false;

    const usuario = this.obtenerUsuarioFormularioOriginal();

    if (!usuario) return false;
    if (this.esUsuarioActual(usuario)) return true;
    if (usuario.tieneOtrosModulos) return true;
    if (this.esUnicoSuperUsuarioActivo(usuario)) return true;

    return false;
  }

  bloquearAccesoFormulario(): boolean {
    if (this.modoFormulario() === 'NUEVO') return true;

    const usuario = this.obtenerUsuarioFormularioOriginal();

    if (!usuario) return false;
    if (this.esUsuarioActual(usuario)) return true;
    if (this.esUnicoSuperUsuarioActivo(usuario)) return true;

    return false;
  }

  private ordenarListaUsuarios(
    lista: FederalUsuarioDetalle[],
  ): FederalUsuarioDetalle[] {
    return ordenarPorEstado(
      lista,
      this.ordenUsuarios(),
      (usuario, campo) => this.obtenerValorOrdenUsuario(usuario, campo),
    );
  }

  private obtenerValorOrdenUsuario(
    usuario: FederalUsuarioDetalle,
    campo: CampoOrdenUsuariosFederal,
  ): ValorOrden {
    return usuario[campo] ?? '';
  }

  private crearUsuario(form: UsuarioFederalForm): void {
    const request: CrearUsuarioFederalRequest = {
      usuario: form.usuario.trim(),
      password: form.password,
      nombre: form.nombre.trim(),
      primerApellido: form.primerApellido.trim(),
      segundoApellido: this.valorNullable(form.segundoApellido),
      correoElectronico: form.correoElectronico.trim(),
      rfc: this.valorNullable(form.rfc.toUpperCase()),
      curp: this.valorNullable(form.curp.toUpperCase()),
      telefonoContacto: this.valorNullable(form.telefonoContacto),
      rol: form.rol,
      habilitaFederal: form.habilitaFederal,
      habilitaCarga: form.habilitaCarga,
      habilitaModificacion: form.habilitaModificacion,
    };

    this.guardando.set(true);

    this.usuariosService.crearUsuario(request).subscribe({
      next: (response) =>
        this.procesarGuardadoCorrecto(
          response,
          'Usuario creado correctamente en Federal.',
        ),
      error: (error) =>
        this.procesarErrorOperacion(
          error,
          'No fue posible crear el usuario Federal.',
        ),
    });
  }

  private editarUsuario(form: UsuarioFederalForm): void {
    if (!form.idUsuario) return;

    const request: EditarUsuarioFederalRequest = {
      usuario: form.usuario.trim(),
      nuevaPassword: this.valorNullable(form.password),
      nombre: form.nombre.trim(),
      primerApellido: form.primerApellido.trim(),
      segundoApellido: this.valorNullable(form.segundoApellido),
      correoElectronico: form.correoElectronico.trim(),
      rfc: this.valorNullable(form.rfc.toUpperCase()),
      curp: this.valorNullable(form.curp.toUpperCase()),
      telefonoContacto: this.valorNullable(form.telefonoContacto),
      rol: form.rol,
      habilitaFederal: form.habilitaFederal,
      habilitaCarga: form.habilitaCarga,
      habilitaModificacion: form.habilitaModificacion,
    };

    this.guardando.set(true);

    this.usuariosService.editarUsuario(form.idUsuario, request).subscribe({
      next: (response) =>
        this.procesarGuardadoCorrecto(
          response,
          'Usuario actualizado correctamente.',
        ),
      error: (error) =>
        this.procesarErrorOperacion(
          error,
          'No fue posible actualizar el usuario Federal.',
        ),
    });
  }

  private async confirmarDesactivacion(
    usuario: FederalUsuarioDetalle,
  ): Promise<void> {
    const result = await confirmarAccion(
      'Desactivar usuario Federal',
      `Se desactivará a ${usuario.nombreCompleto} del módulo Federal. Sus accesos a otros módulos no serán modificados.`,
      'Desactivar',
    );

    if (!result.isConfirmed) return;

    this.cargando.set(true);

    this.usuariosService.desactivarUsuario(usuario.idUsuario).subscribe({
      next: (response) => {
        this.cargando.set(false);

        if (!response.esValido) {
          mostrarAdvertencia(
            'No fue posible desactivar',
            response.mensaje,
          );
          return;
        }

        mostrarExitoInstitucional(
          'Usuario desactivado',
          response.mensaje,
        );

        this.cargarUsuarios();
      },
      error: (error) => {
        this.cargando.set(false);

        mostrarError(
          'No fue posible desactivar',
          obtenerMensajeErrorHttp(error, 'Intente nuevamente.'),
        );
      },
    });
  }

  private async confirmarReactivacion(
    usuario: FederalUsuarioDetalle,
  ): Promise<void> {
    const result = await confirmarAccion(
      'Reactivar usuario Federal',
      `Se reactivará a ${usuario.nombreCompleto} con acceso al módulo Federal. Los permisos de carga y actualización quedarán deshabilitados hasta que sean configurados.`,
      'Reactivar',
    );

    if (!result.isConfirmed) return;

    this.cargando.set(true);

    this.usuariosService
      .reactivarUsuario(usuario.idUsuario, {
        habilitaFederal: true,
        habilitaCarga: false,
        habilitaModificacion: false,
      })
      .subscribe({
        next: (response) => {
          this.cargando.set(false);

          if (!response.esValido) {
            mostrarAdvertencia(
              'No fue posible reactivar',
              response.mensaje,
            );
            return;
          }

          mostrarExitoInstitucional(
            'Usuario reactivado',
            response.mensaje,
          );

          this.cargarUsuarios();
        },
        error: (error) => {
          this.cargando.set(false);

          mostrarError(
            'No fue posible reactivar',
            obtenerMensajeErrorHttp(error, 'Intente nuevamente.'),
          );
        },
      });
  }

  private procesarGuardadoCorrecto(
    response: FederalUsuarioOperacionResponse,
    mensajeDefault: string,
  ): void {
    this.guardando.set(false);

    if (!response.esValido) {
      const detalle =
        response.errores?.map((error) => error.mensaje).join('\n') ||
        response.mensaje;

      mostrarAdvertencia(
        'No fue posible guardar',
        detalle,
      );
      return;
    }

    this.modalAbierto.set(false);
    this.formulario.set(this.crearFormularioVacio());

    mostrarExitoInstitucional(
      'Operación realizada',
      response.mensaje || mensajeDefault,
    );

    this.cargarUsuarios();
  }

  private procesarErrorOperacion(
    error: unknown,
    mensajeDefault: string,
  ): void {
    this.guardando.set(false);

    const respuesta = (
      error as {
        error?: FederalUsuarioOperacionResponse;
      }
    )?.error;

    const detalle =
      respuesta?.errores?.map((item) => item.mensaje).join('\n') ||
      respuesta?.mensaje ||
      obtenerMensajeErrorHttp(error, mensajeDefault);

    mostrarError(
      'No fue posible guardar el usuario',
      detalle,
    );
  }

  private mapearDetalleAFormulario(
    usuario: FederalUsuarioDetalle,
  ): UsuarioFederalForm {
    return {
      idUsuario: usuario.idUsuario,
      nombre: usuario.nombre ?? '',
      primerApellido: usuario.primerApellido ?? '',
      segundoApellido: usuario.segundoApellido ?? '',
      rfc: usuario.rfc ?? '',
      curp: usuario.curp ?? '',
      correoElectronico: usuario.correoElectronico ?? '',
      telefonoContacto: usuario.telefonoContacto ?? '',
      usuario: usuario.usuario ?? '',
      password: '',
      rol: usuario.rol ?? '',
      habilitaFederal: usuario.habilitaFederal,
      habilitaCarga: usuario.habilitaCarga,
      habilitaModificacion: usuario.habilitaModificacion,
      tieneOtrosModulos: usuario.tieneOtrosModulos,
    };
  }

  private crearFormularioVacio(): UsuarioFederalForm {
    return {
      idUsuario: null,
      nombre: '',
      primerApellido: '',
      segundoApellido: '',
      rfc: '',
      curp: '',
      correoElectronico: '',
      telefonoContacto: '',
      usuario: '',
      password: '',
      rol: '',
      habilitaFederal: true,
      habilitaCarga: true,
      habilitaModificacion: true,
      tieneOtrosModulos: false,
    };
  }

  private normalizarPermisosPorRol(rol: string): void {
    if (rol !== ROLES.CONSULTA) return;

    this.formulario.update((actual) => ({
      ...actual,
      habilitaCarga: false,
      habilitaModificacion: false,
    }));
  }

  private obtenerUsuarioFormularioOriginal():
    | FederalUsuarioDetalle
    | undefined {
    const idUsuario = this.formulario().idUsuario;

    if (!idUsuario) return undefined;

    return this.usuarios().find(
      (usuario) => usuario.idUsuario === idUsuario,
    );
  }

  private valorNullable(valor: string): string | null {
    const texto = valor.trim();

    return texto === '' ? null : texto;
  }
}