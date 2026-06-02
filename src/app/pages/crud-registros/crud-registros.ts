import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { forkJoin } from 'rxjs';
import * as XLSX from 'xlsx';

import { CatalogosService } from '../../core/services/catalogos.service';
import {
  EntidadFederativaCatalogoItem,
  RolCatalogoItem
} from '../../core/models/catalogos.models';

import {
  CrearUsuarioRequest,
  EditarUsuarioRequest,
  UsuarioDetalle,
  UsuarioListadoItem,
  UsuarioOperacionResponse
} from '../../core/models/usuarios.models';

import { UsuariosService } from '../../core/services/usuarios.service';
import { SessionService } from '../../core/services/session.service';

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

type DireccionOrden = 'asc' | 'desc';

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
  styleUrl: './crud-registros.css'
})
export class CrudRegistros implements OnInit {
  private readonly usuariosService = inject(UsuariosService);
  private readonly sessionService = inject(SessionService);
  private readonly catalogosService = inject(CatalogosService);

  ordenUsuarios = signal<{ campo: CampoOrdenUsuarios; direccion: DireccionOrden } | null>(null);
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

  const filtrados = this.usuarios().filter(usuario => {
    const pasaBusqueda = !texto ||
      usuario.nombreCompleto?.toLowerCase().includes(texto) ||
      usuario.usuario?.toLowerCase().includes(texto) ||
      usuario.correoElectronico?.toLowerCase().includes(texto) ||
      usuario.rol?.toLowerCase().includes(texto) ||
      usuario.entidadFederativa?.toLowerCase().includes(texto);

    return pasaBusqueda;
  });

  return this.ordenarUsuarios(filtrados);
});

  totalUsuarios = computed(() => this.usuarios().length);
  totalActivos = computed(() => this.usuarios().filter(x => x.activo).length);
  totalInactivos = computed(() => this.usuarios().filter(x => !x.activo).length);
  totalSuperUsuarios = computed(() => this.usuarios().filter(x => x.rol === 'SUPER_USUARIO').length);

  usuarioActual = this.sessionService.usuario;

  totalSuperUsuariosActivos = computed(() => {
    return this.usuarios().filter(x => x.activo && x.rol === 'SUPER_USUARIO').length;
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

    if (form.rol !== 'SUPER_USUARIO' && form.idEntidadFederativa === '') {
      return false;
    }

    return true;
  });

  esUsuarioActual(usuario: UsuarioListadoItem): boolean {
    return usuario.idUsuario === this.usuarioActual()?.idUsuario;
  }

  ordenarUsuariosPor(campo: CampoOrdenUsuarios): void {
  const actual = this.ordenUsuarios();

  if (actual?.campo === campo) {
    this.ordenUsuarios.set({
      campo,
      direccion: actual.direccion === 'asc' ? 'desc' : 'asc'
    });

    return;
  }

  this.ordenUsuarios.set({ campo, direccion: 'asc' });
}

iconoOrdenUsuarios(campo: CampoOrdenUsuarios): string {
  const orden = this.ordenUsuarios();

  if (orden?.campo !== campo) {
    return 'fa-solid fa-sort sort-icon';
  }

  return orden.direccion === 'asc'
    ? 'fa-solid fa-sort-up sort-icon active'
    : 'fa-solid fa-sort-down sort-icon active';
}

exportarUsuariosExcel(): void {
  this.exportandoExcel.set(true);

  try {
    const filas = this.usuariosFiltrados().map(usuario => ({
      'Nombre': usuario.nombreCompleto,
      'Usuario': usuario.usuario,
      'Correo': usuario.correoElectronico,
      'Rol': usuario.rol,
      'Entidad': usuario.entidadFederativa || 'Nacional',
      'Carga': usuario.habilitaCarga ? 'Sí' : 'No',
      'Modificación': usuario.habilitaModificacion ? 'Sí' : 'No',
      'Estado': usuario.activo ? 'ACTIVO' : 'INACTIVO'
    }));

    this.exportarFilasExcel(filas, 'usuarios_sistema.xlsx', 'Usuarios');
  } finally {
    setTimeout(() => this.exportandoExcel.set(false), 300);
  }
}

private ordenarUsuarios(lista: UsuarioListadoItem[]): UsuarioListadoItem[] {
  const orden = this.ordenUsuarios();

  if (!orden) {
    return lista;
  }

  return [...lista].sort((a, b) => {
    const valorA = this.obtenerValorOrdenUsuario(a, orden.campo);
    const valorB = this.obtenerValorOrdenUsuario(b, orden.campo);
    const resultado = this.compararValores(valorA, valorB);

    return orden.direccion === 'asc' ? resultado : resultado * -1;
  });
}

private obtenerValorOrdenUsuario(
  usuario: UsuarioListadoItem,
  campo: CampoOrdenUsuarios
): string | number | boolean | null {
  return usuario[campo] ?? '';
}

private compararValores(
  valorA: string | number | boolean | null | undefined,
  valorB: string | number | boolean | null | undefined
): number {
  if (valorA === null || valorA === undefined || valorA === '') {
    return 1;
  }

  if (valorB === null || valorB === undefined || valorB === '') {
    return -1;
  }

  if (typeof valorA === 'boolean' && typeof valorB === 'boolean') {
    return Number(valorA) - Number(valorB);
  }

  if (typeof valorA === 'number' && typeof valorB === 'number') {
    return valorA - valorB;
  }

  return String(valorA).localeCompare(String(valorB), 'es', {
    numeric: true,
    sensitivity: 'base'
  });
}

private exportarFilasExcel(
  filas: Record<string, string | number>[],
  nombreArchivo: string,
  nombreHoja: string
): void {
  if (!filas.length) {
    Swal.fire({
      icon: 'info',
      title: 'Sin registros',
      text: 'No hay información para exportar.',
      confirmButtonColor: '#691C32'
    });

    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(filas);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, nombreHoja);
  XLSX.writeFile(workbook, nombreArchivo);
}

  esUnicoSuperUsuarioActivo(usuario: UsuarioListadoItem): boolean {
    return usuario.activo
      && usuario.rol === 'SUPER_USUARIO'
      && this.totalSuperUsuariosActivos() === 1;
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
    roles: this.catalogosService.obtenerRoles()
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
        text: error?.error?.mensaje || 'Revise la conexión con la API.',
        confirmButtonColor: '#691C32'
      });
    }
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
          text: error?.error?.mensaje || 'Revise la conexión con la API.',
          confirmButtonColor: '#691C32'
        });
      }
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
            confirmButtonColor: '#691C32'
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
          text: error?.error?.mensaje || 'Intente nuevamente.',
          confirmButtonColor: '#691C32'
        });
      }
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
        confirmButtonColor: '#691C32'
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
        confirmButtonColor: '#691C32'
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
    this.formulario.update(actual => ({
      ...actual,
      [campo]: valor
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
      habilitaModificacion: form.habilitaModificacion
    };

    this.guardando.set(true);

    this.usuariosService.crearUsuario(request).subscribe({
      next: (response) => this.procesarGuardadoCorrecto(response, 'Usuario creado correctamente.'),
      error: (error) => this.procesarErrorOperacion(error, 'No fue posible crear el usuario.')
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
      habilitaModificacion: form.habilitaModificacion
    };

    this.guardando.set(true);

    this.usuariosService.editarUsuario(form.idUsuario, request).subscribe({
      next: (response) => this.procesarGuardadoCorrecto(response, 'Usuario actualizado correctamente.'),
      error: (error) => this.procesarErrorOperacion(error, 'No fue posible editar el usuario.')
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
      confirmButtonColor: '#691C32'
    }).then(result => {
      if (!result.isConfirmed) {
        return;
      }

      this.usuariosService.desactivarUsuario(usuario.idUsuario).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Usuario desactivado',
            confirmButtonColor: '#691C32'
          });

          this.cargarUsuarios();
        },
        error: (error) => this.procesarErrorOperacion(error, 'No fue posible desactivar el usuario.')
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
      confirmButtonColor: '#691C32'
    }).then(result => {
      if (!result.isConfirmed) {
        return;
      }

      this.usuariosService.reactivarUsuario(usuario.idUsuario, {
        habilitaCarga: usuario.habilitaCarga,
        habilitaModificacion: usuario.habilitaModificacion
      }).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Usuario reactivado',
            confirmButtonColor: '#691C32'
          });

          this.cargarUsuarios();
        },
        error: (error) => this.procesarErrorOperacion(error, 'No fue posible reactivar el usuario.')
      });
    });
  }

  private procesarGuardadoCorrecto(response: UsuarioOperacionResponse, mensajeDefault: string): void {
    this.guardando.set(false);

    Swal.fire({
      icon: 'success',
      title: response.mensaje || mensajeDefault,
      confirmButtonColor: '#691C32'
    });

    this.cerrarModal();
    this.cargarUsuarios();
  }

  private procesarErrorOperacion(error: any, mensajeDefault: string): void {
    this.guardando.set(false);

    const errores = error?.error?.errores as { mensaje: string }[] | undefined;
    const detalle = errores?.map(x => `• ${x.mensaje}`).join('\n');

    Swal.fire({
      icon: 'error',
      title: mensajeDefault,
      text: detalle || error?.error?.mensaje || 'Intente nuevamente.',
      confirmButtonColor: '#691C32'
    });
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
      habilitaModificacion: usuario.habilitaModificacion
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
      habilitaModificacion: true
    };
  }

  private obtenerEntidadParaRequest(form: UsuarioForm): number | null {
    if (form.rol === 'SUPER_USUARIO') {
      return null;
    }

    return form.idEntidadFederativa ? Number(form.idEntidadFederativa) : null;
  }

  private valorNullable(valor: string): string | null {
    const limpio = valor?.trim();

    return limpio ? limpio : null;
  }

  private normalizarPermisosPorRol(rol: string): void {
    if (rol !== 'CONSULTA') {
      return;
    }

    this.formulario.update(actual => ({
      ...actual,
      habilitaCarga: false,
      habilitaModificacion: false
    }));
  }
}