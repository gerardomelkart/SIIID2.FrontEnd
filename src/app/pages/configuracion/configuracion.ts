import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { ROLES } from '../../core/constants/roles.constants';

import {
  EditarUsuarioRequest,
  UsuarioDetalle,
  UsuarioListadoItem
} from '../../core/models/usuarios.models';

import { UsuariosService } from '../../core/services/usuarios.service';



interface ConfiguracionEntidad {
  idEntidadFederativa: number | null;
  entidadFederativa: string;
  totalUsuarios: number;
  usuariosCarga: number;
  usuariosModificacion: number;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  estadoCarga: 'ACTIVO' | 'INACTIVO' | 'MIXTO';
  estadoModificacion: 'ACTIVO' | 'INACTIVO' | 'MIXTO';
}

interface UsuarioPermisoEntidad {
  idUsuario: number;
  usuario: string;
  nombreCompleto: string;
  rol: string;
  entidadFederativa: string;
  habilitaCargaOriginal: boolean;
  habilitaModificacionOriginal: boolean;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  bloqueado: boolean;
}

type DireccionOrden = 'asc' | 'desc';

type CampoOrdenConfiguracionEntidad =
  | 'entidadFederativa'
  | 'estadoCarga'
  | 'estadoModificacion'
  | 'usuariosCarga'
  | 'usuariosModificacion'
  | 'totalUsuarios';

@Component({
  selector: 'app-configuracion',
  imports: [FormsModule],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.css'
})
export class Configuracion implements OnInit {
  private readonly usuariosService = inject(UsuariosService);

  cargando = signal(false);
  guardandoGlobal = signal(false);

  busquedaEntidad = signal('');

  habilitaCargaGlobal = signal(true);
  habilitaModificacionGlobal = signal(true);

  ordenEntidades = signal<{ campo: CampoOrdenConfiguracionEntidad; direccion: DireccionOrden } | null>(null);
  exportandoExcel = signal(false);

  modalEntidadAbierto = signal(false);
  guardandoEntidad = signal(false);
  entidadSeleccionada = signal<ConfiguracionEntidad | null>(null);
  usuariosEntidad = signal<UsuarioPermisoEntidad[]>([]);

  usuarios = signal<UsuarioListadoItem[]>([]);

  entidadesConfiguracion = computed<ConfiguracionEntidad[]>(() => {
    const grupos = new Map<string, UsuarioListadoItem[]>();

    for (const usuario of this.usuarios()) {
      if (!usuario.activo) {
        continue;
      }

      if (usuario.rol === ROLES.CONSULTA) {
        continue;
      }

      const key = usuario.idEntidadFederativa?.toString() ?? 'NACIONAL';
      const lista = grupos.get(key) ?? [];
      lista.push(usuario);
      grupos.set(key, lista);
    }

    const resultado: ConfiguracionEntidad[] = [];

    grupos.forEach((lista) => {
      const primero = lista[0];

      const usuariosCarga = lista.filter(x => x.habilitaCarga).length;
      const usuariosModificacion = lista.filter(x => x.habilitaModificacion).length;

      resultado.push({
        idEntidadFederativa: primero.idEntidadFederativa,
        entidadFederativa: primero.entidadFederativa || 'Nacional',
        totalUsuarios: lista.length,
        usuariosCarga,
        usuariosModificacion,
        habilitaCarga: usuariosCarga === lista.length,
        habilitaModificacion: usuariosModificacion === lista.length,
        estadoCarga: this.obtenerEstadoPermiso(usuariosCarga, lista.length),
        estadoModificacion: this.obtenerEstadoPermiso(usuariosModificacion, lista.length)
      });
    });
    return resultado;
  });

  entidadesFiltradas = computed(() => {
    const texto = this.busquedaEntidad().trim().toLowerCase();

    const filtradas = !texto
      ? this.entidadesConfiguracion()
      : this.entidadesConfiguracion().filter(entidad =>
        entidad.entidadFederativa.toLowerCase().includes(texto)
      );

    return this.ordenarEntidadesConfiguracion(filtradas);
  });

  totalEntidades = computed(() => this.entidadesConfiguracion().length);

  totalEntidadesCargaActiva = computed(() => {
    return this.entidadesConfiguracion().filter(x => x.estadoCarga === 'ACTIVO').length;
  });

  totalEntidadesModificacionActiva = computed(() => {
    return this.entidadesConfiguracion().filter(x => x.estadoModificacion === 'ACTIVO').length;
  });

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.cargando.set(true);

    this.usuariosService.obtenerUsuarios(true).subscribe({
      next: (response) => {
        const usuarios = response.usuarios ?? [];

        this.usuarios.set(usuarios);
        this.sincronizarSwitchesGlobales(usuarios);
        this.cargando.set(false);
      },
      error: (error) => {
        this.cargando.set(false);

        Swal.fire({
          icon: 'error',
          title: 'No fue posible cargar configuración',
          text: error?.error?.mensaje || 'Revise la conexión con la API.',
          confirmButtonColor: '#691C32'
        });
      }
    });
  }

  ordenarEntidadesPor(campo: CampoOrdenConfiguracionEntidad): void {
    const actual = this.ordenEntidades();

    if (actual?.campo === campo) {
      this.ordenEntidades.set({
        campo,
        direccion: actual.direccion === 'asc' ? 'desc' : 'asc'
      });

      return;
    }

    this.ordenEntidades.set({ campo, direccion: 'asc' });
  }

  iconoOrdenEntidades(campo: CampoOrdenConfiguracionEntidad): string {
    const orden = this.ordenEntidades();

    if (orden?.campo !== campo) {
      return 'fa-solid fa-sort sort-icon';
    }

    return orden.direccion === 'asc'
      ? 'fa-solid fa-sort-up sort-icon active'
      : 'fa-solid fa-sort-down sort-icon active';
  }

  exportarConfiguracionExcel(): void {
    this.exportandoExcel.set(true);

    try {
      const filas = this.entidadesFiltradas().map(entidad => ({
        'Entidad federativa': entidad.entidadFederativa,
        'Carga de archivos': this.etiquetaEstado(entidad.estadoCarga),
        'Usuarios con carga': `${entidad.usuariosCarga} de ${entidad.totalUsuarios}`,
        'Actualización': this.etiquetaEstado(entidad.estadoModificacion),
        'Usuarios con actualización': `${entidad.usuariosModificacion} de ${entidad.totalUsuarios}`
      }));

      this.exportarFilasExcel(filas, 'configuracion_por_entidad.xlsx', 'Configuracion');
    } finally {
      setTimeout(() => this.exportandoExcel.set(false), 300);
    }
  }

  private ordenarEntidadesConfiguracion(lista: ConfiguracionEntidad[]): ConfiguracionEntidad[] {
    const orden = this.ordenEntidades();

    if (!orden) {
      return lista;
    }

    return [...lista].sort((a, b) => {
      const valorA = a[orden.campo] ?? '';
      const valorB = b[orden.campo] ?? '';
      const resultado = this.compararValores(valorA, valorB);

      return orden.direccion === 'asc' ? resultado : resultado * -1;
    });
  }

  private compararValores(
    valorA: string | number | null | undefined,
    valorB: string | number | null | undefined
  ): number {
    if (valorA === null || valorA === undefined || valorA === '') {
      return 1;
    }

    if (valorB === null || valorB === undefined || valorB === '') {
      return -1;
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

  guardarConfiguracionGlobal(): void {
    Swal.fire({
      icon: 'question',
      title: 'Actualizar permisos globales',
      text: 'Esta acción actualizará carga y modificación para todos los usuarios activos permitidos.',
      showCancelButton: true,
      confirmButtonText: 'Sí, actualizar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#691C32'
    }).then(result => {
      if (!result.isConfirmed) {
        return;
      }

      this.guardandoGlobal.set(true);

      this.usuariosService.actualizarPermisosGlobales({
        habilitaCarga: this.habilitaCargaGlobal(),
        habilitaModificacion: this.habilitaModificacionGlobal()
      }).subscribe({
        next: (response) => {
          this.guardandoGlobal.set(false);

          Swal.fire({
            icon: 'success',
            title: response.mensaje || 'Configuración global actualizada.',
            confirmButtonColor: '#691C32'
          });

          this.cargarUsuarios();
        },
        error: (error) => {
          this.guardandoGlobal.set(false);

          Swal.fire({
            icon: 'error',
            title: 'No fue posible actualizar configuración global',
            text: error?.error?.mensaje || 'Intente nuevamente.',
            confirmButtonColor: '#691C32'
          });
        }
      });
    });
  }

  cambiarCargaGlobal(valor: boolean): void {
    this.habilitaCargaGlobal.set(valor);
  }

  cambiarModificacionGlobal(valor: boolean): void {
    this.habilitaModificacionGlobal.set(valor);
  }

  etiquetaEstado(estado: 'ACTIVO' | 'INACTIVO' | 'MIXTO'): string {
    if (estado === 'ACTIVO') {
      return 'Activo';
    }

    if (estado === 'INACTIVO') {
      return 'Inactivo';
    }

    return 'Mixto';
  }


  abrirPermisosEntidad(entidad: ConfiguracionEntidad): void {
    const usuariosEntidad = this.usuarios()
      .filter(usuario => usuario.activo)
      .filter(usuario => usuario.idEntidadFederativa === entidad.idEntidadFederativa)
      .map(usuario => ({
        idUsuario: usuario.idUsuario,
        usuario: usuario.usuario,
        nombreCompleto: usuario.nombreCompleto,
        rol: usuario.rol,
        entidadFederativa: usuario.entidadFederativa || 'Nacional',
        habilitaCargaOriginal: usuario.habilitaCarga,
        habilitaModificacionOriginal: usuario.habilitaModificacion,
        habilitaCarga: usuario.habilitaCarga,
        habilitaModificacion: usuario.habilitaModificacion,
        bloqueado: usuario.rol === ROLES.CONSULTA
      }));

    this.entidadSeleccionada.set(entidad);
    this.usuariosEntidad.set(usuariosEntidad);
    this.modalEntidadAbierto.set(true);
  }

  cerrarPermisosEntidad(): void {
    if (this.guardandoEntidad()) {
      return;
    }

    this.modalEntidadAbierto.set(false);
    this.entidadSeleccionada.set(null);
    this.usuariosEntidad.set([]);
  }

  cambiarPermisoUsuarioEntidad(
    idUsuario: number,
    permiso: 'habilitaCarga' | 'habilitaModificacion',
    valor: boolean
  ): void {
    this.usuariosEntidad.update(usuarios =>
      usuarios.map(usuario => {
        if (usuario.idUsuario !== idUsuario || usuario.bloqueado) {
          return usuario;
        }

        return {
          ...usuario,
          [permiso]: valor
        };
      })
    );
  }

  hayCambiosEntidad(): boolean {
    return this.usuariosEntidad().some(usuario =>
      usuario.habilitaCarga !== usuario.habilitaCargaOriginal ||
      usuario.habilitaModificacion !== usuario.habilitaModificacionOriginal
    );
  }

  guardarPermisosEntidad(): void {
    const usuariosModificados = this.usuariosEntidad()
      .filter(usuario => !usuario.bloqueado)
      .filter(usuario =>
        usuario.habilitaCarga !== usuario.habilitaCargaOriginal ||
        usuario.habilitaModificacion !== usuario.habilitaModificacionOriginal
      );

    if (usuariosModificados.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin cambios',
        text: 'No hay cambios por guardar.',
        confirmButtonColor: '#691C32'
      });

      return;
    }

    Swal.fire({
      icon: 'question',
      title: 'Guardar permisos por entidad',
      text: `Se actualizarán permisos de ${usuariosModificados.length} usuario(s).`,
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#691C32'
    }).then(result => {
      if (!result.isConfirmed) {
        return;
      }

      this.guardandoEntidad.set(true);

      const operaciones = usuariosModificados.map(usuarioPermiso =>
        this.usuariosService.obtenerDetalle(usuarioPermiso.idUsuario).pipe(
          switchMap(detalleResponse => {
            if (!detalleResponse.esValido || !detalleResponse.usuario) {
              throw new Error(`No fue posible obtener detalle del usuario ${usuarioPermiso.usuario}.`);
            }

            const request = this.construirRequestEditarUsuario(
              detalleResponse.usuario,
              usuarioPermiso.habilitaCarga,
              usuarioPermiso.habilitaModificacion
            );

            return this.usuariosService.editarUsuario(usuarioPermiso.idUsuario, request);
          }),
          catchError(error => {
            return of({
              esValido: false,
              codigo: 'ERROR_ACTUALIZAR_USUARIO',
              mensaje: error?.error?.mensaje || error?.message || `No fue posible actualizar ${usuarioPermiso.usuario}.`,
              idUsuario: usuarioPermiso.idUsuario
            });
          })
        )
      );

      forkJoin(operaciones).subscribe({
        next: resultados => {
          this.guardandoEntidad.set(false);

          const errores = resultados.filter(resultado => !resultado.esValido);

          if (errores.length > 0) {
            Swal.fire({
              icon: 'warning',
              title: 'Algunos usuarios no se actualizaron',
              html: errores.map(error => `• ${error.mensaje}`).join('<br>'),
              confirmButtonColor: '#691C32'
            });

            this.cargarUsuarios();
            return;
          }

          Swal.fire({
            icon: 'success',
            title: 'Permisos actualizados',
            text: 'Los permisos de la entidad se actualizaron correctamente.',
            confirmButtonColor: '#691C32'
          });

          this.cerrarPermisosEntidad();
          this.cargarUsuarios();
        },
        error: () => {
          this.guardandoEntidad.set(false);

          Swal.fire({
            icon: 'error',
            title: 'No fue posible actualizar permisos',
            text: 'Intente nuevamente.',
            confirmButtonColor: '#691C32'
          });
        }
      });
    });
  }

  private construirRequestEditarUsuario(
    usuario: UsuarioDetalle,
    habilitaCarga: boolean,
    habilitaModificacion: boolean
  ): EditarUsuarioRequest {
    return {
      usuario: usuario.usuario,
      nuevaPassword: null,
      nombre: usuario.nombre,
      primerApellido: usuario.primerApellido,
      segundoApellido: usuario.segundoApellido,
      correoElectronico: usuario.correoElectronico,
      rfc: usuario.rfc,
      curp: usuario.curp,
      telefonoContacto: usuario.telefonoContacto,
      idEntidadFederativa: usuario.idEntidadFederativa,
      rol: usuario.rol,
      habilitaCarga,
      habilitaModificacion
    };
  }


  private obtenerEstadoPermiso(totalActivos: number, totalUsuarios: number): 'ACTIVO' | 'INACTIVO' | 'MIXTO' {
    if (totalUsuarios === 0 || totalActivos === 0) {
      return 'INACTIVO';
    }

    if (totalActivos === totalUsuarios) {
      return 'ACTIVO';
    }

    return 'MIXTO';
  }

  private sincronizarSwitchesGlobales(usuarios: UsuarioListadoItem[]): void {
    const usuariosOperativos = usuarios.filter(x => x.activo && x.rol !== 'CONSULTA');

    if (usuariosOperativos.length === 0) {
      this.habilitaCargaGlobal.set(false);
      this.habilitaModificacionGlobal.set(false);
      return;
    }

    this.habilitaCargaGlobal.set(usuariosOperativos.every(x => x.habilitaCarga));
    this.habilitaModificacionGlobal.set(usuariosOperativos.every(x => x.habilitaModificacion));
  }
}