import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { ROLES } from '../../core/constants/roles.constants';
import { forkJoin } from 'rxjs';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';
import { CatalogosService } from '../../core/services/catalogos.service';
import { EntidadFederativaCatalogoItem, RolCatalogoItem } from '../../core/models/catalogos.models';
import { UsuariosService } from '../../core/services/usuarios.service';
import { SessionService } from '../../core/services/session.service';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';

import {
  CrearUsuarioRequest,
  EditarUsuarioRequest,
  UsuarioDetalle,
  UsuarioListadoItem,
  UsuarioOperacionResponse,
} from '../../core/models/usuarios.models';

import {
  EstadoOrden,
  ValorOrden,
  alternarOrden,
  obtenerIconoOrden,
  ordenarPorEstado,
} from '../../core/utils/sort.utils';

type ModoFormulario = 'NUEVO' | 'EDITAR';

interface UsuarioForm {
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
  idEntidadFederativa: string;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
}

type CampoOrdenUsuarios =
  | 'nombreCompleto'
  | 'usuario'
  | 'correoElectronico'
  | 'rol'
  | 'entidadFederativa'
  | 'habilitaCarga'
  | 'habilitaModificacion'
  | 'activo';

@Component({
  selector: 'app-crud-registros',
  imports: [FormsModule],
  templateUrl: './crud-registros.html',
  styleUrl: './crud-registros.css',
})
export class CrudRegistros implements OnInit {
  private readonly usuariosService = inject(UsuariosService);
  private readonly sessionService = inject(SessionService);
  private readonly catalogosService = inject(CatalogosService);

  ordenUsuarios = signal<EstadoOrden<CampoOrdenUsuarios> | null>(null);
  exportandoExcel = signal(false);

  busqueda = signal('');
  mostrarInactivos = signal(false);
  cargando = signal(false);
  guardando = signal(false);
  modalAbierto = signal(false);
  modoFormulario = signal<ModoFormulario>('NUEVO');

  usuarios = signal<UsuarioListadoItem[]>([]);

  formulario = signal<UsuarioForm>(this.crearFormularioVacio());

  entidades = signal<EntidadFederativaCatalogoItem[]>([]);
  roles = signal<RolCatalogoItem[]>([]);

  usuariosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();

    const filtrados = this.usuarios().filter((usuario) => {
      const pasaBusqueda =
        !texto ||
        usuario.nombreCompleto?.toLowerCase().includes(texto) ||
        usuario.usuario?.toLowerCase().includes(texto) ||
        usuario.correoElectronico?.toLowerCase().includes(texto) ||
        usuario.rol?.toLowerCase().includes(texto) ||
        usuario.entidadFederativa?.toLowerCase().includes(texto);

      return pasaBusqueda;
    });

    return this.ordenarListaUsuarios(filtrados);
  });

  totalUsuarios = computed(() => this.usuarios().length);
  totalActivos = computed(() => this.usuarios().filter((x) => x.activo).length);
  totalInactivos = computed(() => this.usuarios().filter((x) => !x.activo).length);
  totalSuperUsuarios = computed(
    () => this.usuarios().filter((x) => x.rol === ROLES.SUPER_USUARIO).length,
  );

  usuarioActual = this.sessionService.usuario;

  totalSuperUsuariosActivos = computed(() => {
    return this.usuarios().filter((x) => x.activo && x.rol === ROLES.SUPER_USUARIO).length;
  });

  formularioValido = computed(() => {
    const form = this.formulario();

    const camposBaseValidos =
      form.nombre.trim() !== '' &&
      form.primerApellido.trim() !== '' &&
      form.rfc.trim() !== '' &&
      form.curp.trim() !== '' &&
      form.correoElectronico.trim() !== '' &&
      form.usuario.trim() !== '' &&
      form.rol.trim() !== '';

    if (!camposBaseValidos) {
      return false;
    }

    if (this.modoFormulario() === 'NUEVO' && form.password.trim() === '') {
      return false;
    }

    if (form.rol !== ROLES.SUPER_USUARIO && form.idEntidadFederativa === '') {
      return false;
    }

    return true;
  });

  private ordenarListaUsuarios(lista: UsuarioListadoItem[]): UsuarioListadoItem[] {
    return ordenarPorEstado(lista, this.ordenUsuarios(), (usuario, campo) =>
      this.obtenerValorOrdenUsuario(usuario, campo),
    );
  }

  private obtenerValorOrdenUsuario(
    usuario: UsuarioListadoItem,
    campo: CampoOrdenUsuarios,
  ): ValorOrden {
    return usuario[campo] ?? '';
  }

  esUsuarioActual(usuario: UsuarioListadoItem): boolean {
    return usuario.idUsuario === this.usuarioActual()?.idUsuario;
  }

  ordenarUsuariosPor(campo: CampoOrdenUsuarios): void {
    this.ordenUsuarios.set(alternarOrden(this.ordenUsuarios(), campo));
  }

  iconoOrdenUsuarios(campo: CampoOrdenUsuarios): string {
    return obtenerIconoOrden(this.ordenUsuarios(), campo);
  }

  async exportarUsuariosExcel(): Promise<void> {
    this.exportandoExcel.set(true);

    try {
      const filas = this.usuariosFiltrados().map((usuario) => ({
        Nombre: usuario.nombreCompleto,
        Usuario: usuario.usuario,
        Correo: usuario.correoElectronico,
        Rol: usuario.rol,
        Entidad: usuario.entidadFederativa || 'Nacional',
        Carga: usuario.habilitaCarga ? 'Sí' : 'No',
        Modificación: usuario.habilitaModificacion ? 'Sí' : 'No',
        Estado: usuario.activo ? 'ACTIVO' : 'INACTIVO',
      }));

      const exportado = await exportarFilasExcel(filas, 'usuarios_sistema.xlsx', 'Usuarios');

      if (!exportado) {
        Swal.fire({
          icon: 'info',
          title: 'Sin registros',
          text: 'No hay información para exportar.',
          confirmButtonColor: '#691C32',
        });
      }
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'No fue posible exportar',
        text: 'Intente nuevamente.',
        confirmButtonColor: '#691C32',
      });
    } finally {
      this.exportandoExcel.set(false);
    }
  }

  esUnicoSuperUsuarioActivo(usuario: UsuarioListadoItem): boolean {
    return (
      usuario.activo &&
      usuario.rol === ROLES.SUPER_USUARIO &&
      this.totalSuperUsuariosActivos() === 1
    );
  }

  puedeCambiarEstado(usuario: UsuarioListadoItem): boolean {
    if (this.esUsuarioActual(usuario)) {
      return false;
    }

    if (this.esUnicoSuperUsuarioActivo(usuario)) {
      return false;
    }

    return true;
  }

  motivoBloqueoEstado(usuario: UsuarioListadoItem): string {
    if (this.esUsuarioActual(usuario)) {
      return 'No puedes desactivar tu propio usuario';
    }

    if (this.esUnicoSuperUsuarioActivo(usuario)) {
      return 'No puedes desactivar el único super usuario activo';
    }

    return usuario.activo ? 'Desactivar usuario' : 'Activar usuario';
  }

  ngOnInit(): void {
    this.cargarInicial();
  }

  cargarInicial(): void {
    this.cargando.set(true);

    forkJoin({
      usuarios: this.usuariosService.obtenerUsuarios(this.mostrarInactivos()),
      entidades: this.catalogosService.obtenerEntidadesFederativas(),
      roles: this.catalogosService.obtenerRoles(),
    }).subscribe({
      next: ({ usuarios, entidades, roles }) => {
        this.usuarios.set(usuarios.usuarios ?? []);
        this.entidades.set(entidades ?? []);
        this.roles.set(roles ?? []);
        this.cargando.set(false);
      },
      error: (error) => {
        this.cargando.set(false);

        Swal.fire({
          icon: 'error',
          title: 'No fue posible cargar administración',
          text: obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
          confirmButtonColor: '#691C32',
        });
      },
    });
  }

  cargarUsuarios(): void {
    this.cargando.set(true);

    this.usuariosService.obtenerUsuarios(this.mostrarInactivos()).subscribe({
      next: (response) => {
        this.usuarios.set(response.usuarios ?? []);
        this.cargando.set(false);
      },
      error: (error) => {
        this.cargando.set(false);

        Swal.fire({
          icon: 'error',
          title: 'No fue posible cargar usuarios',
          text: obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
          confirmButtonColor: '#691C32',
        });
      },
    });
  }

  cambiarFiltroInactivos(valor: boolean): void {
    this.mostrarInactivos.set(valor);
    this.cargarUsuarios();
  }

  abrirNuevoUsuario(): void {
    this.modoFormulario.set('NUEVO');
    this.formulario.set(this.crearFormularioVacio());
    this.modalAbierto.set(true);
  }

  abrirEditarUsuario(usuario: UsuarioListadoItem): void {
    this.cargando.set(true);

    this.usuariosService.obtenerDetalle(usuario.idUsuario).subscribe({
      next: (response) => {
        this.cargando.set(false);

        if (!response.esValido || !response.usuario) {
          Swal.fire({
            icon: 'warning',
            title: 'Usuario no encontrado',
            text: response.mensaje || 'No fue posible obtener el detalle.',
            confirmButtonColor: '#691C32',
          });
          return;
        }

        this.modoFormulario.set('EDITAR');
        this.formulario.set(this.mapearDetalleAFormulario(response.usuario));
        this.modalAbierto.set(true);
      },
      error: (error) => {
        this.cargando.set(false);

        Swal.fire({
          icon: 'error',
          title: 'No fue posible obtener el usuario',
          text: obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
          confirmButtonColor: '#691C32',
        });
      },
    });
  }

  cerrarModal(): void {
    if (this.guardando()) {
      return;
    }

    this.modalAbierto.set(false);
    this.formulario.set(this.crearFormularioVacio());
  }

  guardarUsuario(): void {
    if (!this.formularioValido()) {
      Swal.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: 'Revise los campos obligatorios antes de guardar.',
        confirmButtonColor: '#691C32',
      });

      return;
    }

    const form = this.formulario();

    if (this.modoFormulario() === 'NUEVO') {
      this.crearUsuario(form);
      return;
    }

    this.editarUsuario(form);
  }

  cambiarEstado(usuario: UsuarioListadoItem): void {
    if (!this.puedeCambiarEstado(usuario)) {
      Swal.fire({
        icon: 'warning',
        title: 'Operación no permitida',
        text: this.motivoBloqueoEstado(usuario),
        confirmButtonColor: '#691C32',
      });

      return;
    }

    if (usuario.activo) {
      this.confirmarDesactivacion(usuario);
      return;
    }

    this.confirmarReactivacion(usuario);
  }

  actualizarCampo<K extends keyof UsuarioForm>(campo: K, valor: UsuarioForm[K]): void {
    this.formulario.update((actual) => ({
      ...actual,
      [campo]: valor,
    }));

    if (campo === 'rol') {
      this.normalizarPermisosPorRol(valor as string);
    }
  }

  private crearUsuario(form: UsuarioForm): void {
    const request: CrearUsuarioRequest = {
      usuario: form.usuario.trim(),
      password: form.password,
      nombre: form.nombre.trim(),
      primerApellido: form.primerApellido.trim(),
      segundoApellido: this.valorNullable(form.segundoApellido),
      correoElectronico: form.correoElectronico.trim(),
      rfc: form.rfc.trim().toUpperCase(),
      curp: form.curp.trim().toUpperCase(),
      telefonoContacto: this.valorNullable(form.telefonoContacto),
      idEntidadFederativa: this.obtenerEntidadParaRequest(form),
      rol: form.rol,
      habilitaCarga: form.habilitaCarga,
      habilitaModificacion: form.habilitaModificacion,
    };

    this.guardando.set(true);

    this.usuariosService.crearUsuario(request).subscribe({
      next: (response) => this.procesarGuardadoCorrecto(response, 'Usuario creado correctamente.'),
      error: (error) => this.procesarErrorOperacion(error, 'No fue posible crear el usuario.'),
    });
  }

  private editarUsuario(form: UsuarioForm): void {
    if (!form.idUsuario) {
      return;
    }

    const request: EditarUsuarioRequest = {
      usuario: form.usuario.trim(),
      nuevaPassword: this.valorNullable(form.password),
      nombre: form.nombre.trim(),
      primerApellido: form.primerApellido.trim(),
      segundoApellido: this.valorNullable(form.segundoApellido),
      correoElectronico: form.correoElectronico.trim(),
      rfc: form.rfc.trim().toUpperCase(),
      curp: form.curp.trim().toUpperCase(),
      telefonoContacto: this.valorNullable(form.telefonoContacto),
      idEntidadFederativa: this.obtenerEntidadParaRequest(form),
      rol: form.rol,
      habilitaCarga: form.habilitaCarga,
      habilitaModificacion: form.habilitaModificacion,
    };

    this.guardando.set(true);

    this.usuariosService.editarUsuario(form.idUsuario, request).subscribe({
      next: (response) =>
        this.procesarGuardadoCorrecto(response, 'Usuario actualizado correctamente.'),
      error: (error) => this.procesarErrorOperacion(error, 'No fue posible editar el usuario.'),
    });
  }

  private confirmarDesactivacion(usuario: UsuarioListadoItem): void {
    Swal.fire({
      icon: 'warning',
      title: 'Desactivar usuario',
      text: `El usuario ${usuario.usuario} ya no podrá iniciar sesión ni operar módulos.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#691C32',
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.usuariosService.desactivarUsuario(usuario.idUsuario).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Usuario desactivado',
            confirmButtonColor: '#691C32',
          });

          this.cargarUsuarios();
        },
        error: (error) =>
          this.procesarErrorOperacion(error, 'No fue posible desactivar el usuario.'),
      });
    });
  }

  private confirmarReactivacion(usuario: UsuarioListadoItem): void {
    Swal.fire({
      icon: 'question',
      title: 'Reactivar usuario',
      text: `El usuario ${usuario.usuario} volverá a estar activo.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, reactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#691C32',
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.usuariosService
        .reactivarUsuario(usuario.idUsuario, {
          habilitaCarga: usuario.habilitaCarga,
          habilitaModificacion: usuario.habilitaModificacion,
        })
        .subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Usuario reactivado',
              confirmButtonColor: '#691C32',
            });

            this.cargarUsuarios();
          },
          error: (error) =>
            this.procesarErrorOperacion(error, 'No fue posible reactivar el usuario.'),
        });
    });
  }

  private procesarGuardadoCorrecto(
    response: UsuarioOperacionResponse,
    mensajeDefault: string,
  ): void {
    this.guardando.set(false);

    Swal.fire({
      icon: 'success',
      title: response.mensaje || mensajeDefault,
      confirmButtonColor: '#691C32',
    });

    this.cerrarModal();
    this.cargarUsuarios();
  }

  private procesarErrorOperacion(error: unknown, mensajeDefault: string): void {
    this.guardando.set(false);

    const errores = this.obtenerErroresOperacion(error);
    const detalle = errores?.map((x) => `• ${x.mensaje}`).join('\n');

    Swal.fire({
      icon: 'error',
      title: mensajeDefault,
      text: detalle || obtenerMensajeErrorHttp(error, 'Intente nuevamente.'),
      confirmButtonColor: '#691C32',
    });
  }

  private obtenerErroresOperacion(error: unknown): { mensaje: string }[] | undefined {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const payload = (error as { error?: { errores?: { mensaje: string }[] } }).error;
      return payload?.errores;
    }

    return undefined;
  }

  private mapearDetalleAFormulario(usuario: UsuarioDetalle): UsuarioForm {
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
      idEntidadFederativa: usuario.idEntidadFederativa?.toString() ?? '',
      habilitaCarga: usuario.habilitaCarga,
      habilitaModificacion: usuario.habilitaModificacion,
    };
  }

  private crearFormularioVacio(): UsuarioForm {
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
      idEntidadFederativa: '',
      habilitaCarga: true,
      habilitaModificacion: true,
    };
  }

  private obtenerEntidadParaRequest(form: UsuarioForm): number | null {
    if (form.rol === ROLES.SUPER_USUARIO) {
      return null;
    }

    return form.idEntidadFederativa ? Number(form.idEntidadFederativa) : null;
  }

  private valorNullable(valor: string): string | null {
    const limpio = valor?.trim();

    return limpio ? limpio : null;
  }

  private normalizarPermisosPorRol(rol: string): void {
    if (rol !== ROLES.CONSULTA) {
      return;
    }

    this.formulario.update((actual) => ({
      ...actual,
      habilitaCarga: false,
      habilitaModificacion: false,
    }));
  }
}
