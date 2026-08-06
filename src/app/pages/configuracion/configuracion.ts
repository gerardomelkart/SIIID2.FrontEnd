import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  confirmarAccion,
  mostrarAdvertenciaHtml,
  mostrarError,
  mostrarExitoInstitucional,
  mostrarInfo,
} from '../../core/utils/alert.utils';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ROLES } from '../../core/constants/roles.constants';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';

import {
  EditarUsuarioRequest,
  UsuarioDetalle,
  UsuarioListadoItem,
} from '../../core/models/usuarios.models';

import {
  EstadoOrden,
  alternarOrden,
  obtenerIconoOrden,
  ordenarPorEstado,
} from '../../core/utils/sort.utils';

import { UsuariosService } from '../../core/services/usuarios.service';
import { SessionService } from '../../core/services/session.service';

interface ConfiguracionEntidad {
  idEntidadFederativa: number | null;
  entidadFederativa: string;
  totalUsuarios: number;
  totalUsuariosOperativos: number;
  usuariosAcceso: number;
  usuariosCarga: number;
  usuariosModificacion: number;
  estadoAcceso: 'ACTIVO' | 'INACTIVO' | 'MIXTO';
  estadoCarga: 'ACTIVO' | 'INACTIVO' | 'MIXTO';
  estadoModificacion: 'ACTIVO' | 'INACTIVO' | 'MIXTO';
}

interface UsuarioPermisoEntidad {
  idUsuario: number;
  usuario: string;
  nombreCompleto: string;
  rol: string;
  entidadFederativa: string;
  habilitaMensualOriginal: boolean;
  habilitaCargaOriginal: boolean;
  habilitaModificacionOriginal: boolean;
  habilitaMensual: boolean;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  habilitaSemanal: boolean;
  bloqueaOperacion: boolean;
  esUsuarioActual: boolean;
}

type CampoOrdenConfiguracionEntidad =
  | 'entidadFederativa'
  | 'estadoAcceso'
  | 'estadoCarga'
  | 'estadoModificacion'
  | 'usuariosAcceso'
  | 'usuariosCarga'
  | 'usuariosModificacion'
  | 'totalUsuarios';

@Component({
  selector: 'app-configuracion',
  imports: [FormsModule],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.css',
})
export class Configuracion implements OnInit {
  private readonly usuariosService = inject(UsuariosService);
  private readonly sessionService = inject(SessionService);

  cargando = signal(false);
  guardandoGlobal = signal(false);

  busquedaEntidad = signal('');
  paginaEntidades = signal(1);
  readonly tamanioPaginaEntidades = 10;

  habilitaCargaGlobal = signal(true);
  habilitaModificacionGlobal = signal(true);

  ordenEntidades = signal<EstadoOrden<CampoOrdenConfiguracionEntidad> | null>(null);

  exportandoExcel = signal(false);

  modalEntidadAbierto = signal(false);
  guardandoEntidad = signal(false);
  entidadSeleccionada = signal<ConfiguracionEntidad | null>(null);
  usuariosEntidad = signal<UsuarioPermisoEntidad[]>([]);

  usuarios = signal<UsuarioListadoItem[]>([]);

  usuarioActual = this.sessionService.usuario;

  entidadesConfiguracion = computed<ConfiguracionEntidad[]>(() => {
    const grupos = new Map<string, UsuarioListadoItem[]>();

    for (const usuario of this.usuarios()) {
      if (!usuario.activo) {
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
      const usuariosOperativos = lista.filter((usuario) => usuario.rol !== ROLES.CONSULTA);
      const usuariosAcceso = lista.filter((usuario) => usuario.habilitaMensual).length;
      const usuariosCarga = usuariosOperativos.filter(
        (usuario) => usuario.habilitaMensual && usuario.habilitaCarga,
      ).length;
      const usuariosModificacion = usuariosOperativos.filter(
        (usuario) => usuario.habilitaMensual && usuario.habilitaModificacion,
      ).length;

      resultado.push({
        idEntidadFederativa: primero.idEntidadFederativa,
        entidadFederativa: primero.entidadFederativa || 'Nacional',
        totalUsuarios: lista.length,
        totalUsuariosOperativos: usuariosOperativos.length,
        usuariosAcceso,
        usuariosCarga,
        usuariosModificacion,
        estadoAcceso: this.obtenerEstadoPermiso(usuariosAcceso, lista.length),
        estadoCarga: this.obtenerEstadoPermiso(usuariosCarga, usuariosOperativos.length),
        estadoModificacion: this.obtenerEstadoPermiso(
          usuariosModificacion,
          usuariosOperativos.length,
        ),
      });
    });

    return resultado;
  });

  entidadesFiltradas = computed(() => {
    const texto = this.busquedaEntidad().trim().toLowerCase();

    const filtradas = !texto
      ? this.entidadesConfiguracion()
      : this.entidadesConfiguracion().filter((entidad) =>
          entidad.entidadFederativa.toLowerCase().includes(texto),
        );

    return this.ordenarEntidadesConfiguracion(filtradas);
  });

  entidadesPaginadas = computed(() => {
    const inicio = (this.paginaEntidades() - 1) * this.tamanioPaginaEntidades;
    return this.entidadesFiltradas().slice(inicio, inicio + this.tamanioPaginaEntidades);
  });

  totalPaginasEntidades = computed(() =>
    Math.max(1, Math.ceil(this.entidadesFiltradas().length / this.tamanioPaginaEntidades)),
  );

  totalEntidades = computed(() => this.entidadesConfiguracion().length);

  totalEntidadesAccesoActivo = computed(() => {
    return this.entidadesConfiguracion().filter((x) => x.estadoAcceso === 'ACTIVO').length;
  });

  totalEntidadesCargaActiva = computed(() => {
    return this.entidadesConfiguracion().filter((x) => x.estadoCarga === 'ACTIVO').length;
  });

  totalEntidadesModificacionActiva = computed(() => {
    return this.entidadesConfiguracion().filter((x) => x.estadoModificacion === 'ACTIVO').length;
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
        this.paginaEntidades.set(1);
        this.sincronizarSwitchesGlobales(usuarios);
        this.cargando.set(false);
      },
      error: (error) => {
        this.cargando.set(false);

        mostrarError(
          'No fue posible cargar configuración',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  ordenarEntidadesPor(campo: CampoOrdenConfiguracionEntidad): void {
    this.ordenEntidades.set(alternarOrden(this.ordenEntidades(), campo));
    this.paginaEntidades.set(1);
  }

  iconoOrdenEntidades(campo: CampoOrdenConfiguracionEntidad): string {
    return obtenerIconoOrden(this.ordenEntidades(), campo);
  }

  buscarEntidades(valor: string): void {
    this.busquedaEntidad.set(valor);
    this.paginaEntidades.set(1);
  }

  cambiarPaginaEntidades(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginasEntidades()) {
      return;
    }

    this.paginaEntidades.set(pagina);
  }

  async exportarConfiguracionExcel(): Promise<void> {
    this.exportandoExcel.set(true);

    try {
      const filas = this.entidadesFiltradas().map((entidad) => ({
        'Entidad federativa': entidad.entidadFederativa,
        'Acceso al módulo consolidado': this.etiquetaEstado(entidad.estadoAcceso),
        'Usuarios con acceso': `${entidad.usuariosAcceso} de ${entidad.totalUsuarios}`,
        'Carga de archivos': this.etiquetaEstado(entidad.estadoCarga),
        'Usuarios con carga': `${entidad.usuariosCarga} de ${entidad.totalUsuariosOperativos}`,
        Actualización: this.etiquetaEstado(entidad.estadoModificacion),
        'Usuarios con actualización': `${entidad.usuariosModificacion} de ${entidad.totalUsuariosOperativos}`,
      }));

      const exportado = await exportarFilasExcel(
        filas,
        'configuracion_por_entidad.xlsx',
        'Configuracion',
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

  private ordenarEntidadesConfiguracion(lista: ConfiguracionEntidad[]): ConfiguracionEntidad[] {
    return ordenarPorEstado(lista, this.ordenEntidades(), (entidad, campo) => entidad[campo] ?? '');
  }

  guardarConfiguracionGlobal(): void {
    confirmarAccion(
      'Actualizar permisos globales',
      'Esta acción actualizará carga y actualización para todos los usuarios activos con acceso al módulo consolidado, excepto usuarios con rol CONSULTA.',
      'Sí, actualizar',
    ).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.guardandoGlobal.set(true);

      this.usuariosService
        .actualizarPermisosGlobales({
          habilitaCarga: this.habilitaCargaGlobal(),
          habilitaModificacion: this.habilitaModificacionGlobal(),
        })
        .subscribe({
          next: (response) => {
            this.guardandoGlobal.set(false);

            mostrarExitoInstitucional(response.mensaje || 'Configuración global actualizada.');

            this.cargarUsuarios();
          },
          error: (error) => {
            this.guardandoGlobal.set(false);

            mostrarError(
              'No fue posible actualizar configuración global',
              obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
            );
          },
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
    const idUsuarioActual = this.usuarioActual()?.idUsuario ?? null;

    const usuariosEntidad = this.usuarios()
      .filter((usuario) => usuario.activo)
      .filter((usuario) => usuario.idEntidadFederativa === entidad.idEntidadFederativa)
      .map((usuario) => ({
        idUsuario: usuario.idUsuario,
        usuario: usuario.usuario,
        nombreCompleto: usuario.nombreCompleto,
        rol: usuario.rol,
        entidadFederativa: usuario.entidadFederativa || 'Nacional',
        habilitaMensualOriginal: usuario.habilitaMensual,
        habilitaCargaOriginal: usuario.habilitaCarga,
        habilitaModificacionOriginal: usuario.habilitaModificacion,
        habilitaMensual: usuario.habilitaMensual,
        habilitaCarga: usuario.habilitaCarga,
        habilitaModificacion: usuario.habilitaModificacion,
        habilitaSemanal: usuario.habilitaSemanal,
        bloqueaOperacion: usuario.rol === ROLES.CONSULTA,
        esUsuarioActual: usuario.idUsuario === idUsuarioActual,
      }))
      .sort((a, b) =>
        a.nombreCompleto.localeCompare(b.nombreCompleto, 'es', { sensitivity: 'base' }),
      );

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
    permiso: 'habilitaMensual' | 'habilitaCarga' | 'habilitaModificacion',
    valor: boolean,
  ): void {
    this.usuariosEntidad.update((usuarios) =>
      usuarios.map((usuario) => {
        if (usuario.idUsuario !== idUsuario) {
          return usuario;
        }

        if (permiso === 'habilitaMensual') {
          if (!valor && (usuario.esUsuarioActual || !usuario.habilitaSemanal)) {
            return usuario;
          }

          return {
            ...usuario,
            habilitaMensual: valor,
            habilitaCarga: valor ? usuario.habilitaCarga : false,
            habilitaModificacion: valor ? usuario.habilitaModificacion : false,
          };
        }

        if (usuario.bloqueaOperacion) {
          return usuario;
        }

        return {
          ...usuario,
          habilitaMensual: valor ? true : usuario.habilitaMensual,
          [permiso]: valor,
        };
      }),
    );
  }

  hayCambiosEntidad(): boolean {
    return this.usuariosEntidad().some(
      (usuario) =>
        usuario.habilitaMensual !== usuario.habilitaMensualOriginal ||
        usuario.habilitaCarga !== usuario.habilitaCargaOriginal ||
        usuario.habilitaModificacion !== usuario.habilitaModificacionOriginal,
    );
  }

  guardarPermisosEntidad(): void {
    const usuariosModificados = this.usuariosEntidad().filter(
      (usuario) =>
        usuario.habilitaMensual !== usuario.habilitaMensualOriginal ||
        usuario.habilitaCarga !== usuario.habilitaCargaOriginal ||
        usuario.habilitaModificacion !== usuario.habilitaModificacionOriginal,
    );

    if (usuariosModificados.length === 0) {
      mostrarInfo('Sin cambios', 'No hay cambios por guardar.');

      return;
    }

    confirmarAccion(
      'Guardar permisos por entidad',
      `Se actualizarán permisos de ${usuariosModificados.length} usuario(s).`,
      'Sí, guardar',
    ).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.guardandoEntidad.set(true);

      const operaciones = usuariosModificados.map((usuarioPermiso) =>
        this.usuariosService.obtenerDetalle(usuarioPermiso.idUsuario).pipe(
          switchMap((detalleResponse) => {
            if (!detalleResponse.esValido || !detalleResponse.usuario) {
              throw new Error(
                `No fue posible obtener detalle del usuario ${usuarioPermiso.usuario}.`,
              );
            }

            const request = this.construirRequestEditarUsuario(
              detalleResponse.usuario,
              usuarioPermiso.habilitaMensual,
              usuarioPermiso.habilitaMensual &&
                !usuarioPermiso.bloqueaOperacion &&
                usuarioPermiso.habilitaCarga,
              usuarioPermiso.habilitaMensual &&
                !usuarioPermiso.bloqueaOperacion &&
                usuarioPermiso.habilitaModificacion,
            );

            return this.usuariosService.editarUsuario(usuarioPermiso.idUsuario, request);
          }),
          catchError((error) => {
            return of({
              esValido: false,
              codigo: 'ERROR_ACTUALIZAR_USUARIO',
              mensaje: obtenerMensajeErrorHttp(
                error,
                error?.message || `No fue posible actualizar ${usuarioPermiso.usuario}.`,
              ),
              idUsuario: usuarioPermiso.idUsuario,
            });
          }),
        ),
      );

      forkJoin(operaciones).subscribe({
        next: (resultados) => {
          this.guardandoEntidad.set(false);

          const errores = resultados.filter((resultado) => !resultado.esValido);

          if (errores.length > 0) {
            mostrarAdvertenciaHtml(
              'Algunos usuarios no se actualizaron',
              errores.map((error) => `• ${error.mensaje}`).join('<br>'),
            );

            this.cargarUsuarios();
            return;
          }

          mostrarExitoInstitucional(
            'Permisos actualizados',
            `Se actualizaron correctamente los permisos de ${usuariosModificados.length} usuario(s).`,
          );

          this.cerrarPermisosEntidad();
          this.cargarUsuarios();
        },
        error: (error) => {
          this.guardandoEntidad.set(false);

          mostrarError(
            'No fue posible actualizar permisos',
            obtenerMensajeErrorHttp(error, 'Intente nuevamente.'),
          );
        },
      });
    });
  }

  private construirRequestEditarUsuario(
    usuario: UsuarioDetalle,
    habilitaMensual: boolean,
    habilitaCarga: boolean,
    habilitaModificacion: boolean,
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
      habilitaMensual,
      habilitaCarga,
      habilitaModificacion,
      habilitaSemanal: usuario.habilitaSemanal,
      habilitaCargaSemanal: usuario.habilitaCargaSemanal,
      administraDelitosSemanal: usuario.administraDelitosSemanal,
    };
  }

  private obtenerEstadoPermiso(
    totalActivos: number,
    totalUsuarios: number,
  ): 'ACTIVO' | 'INACTIVO' | 'MIXTO' {
    if (totalUsuarios === 0 || totalActivos === 0) {
      return 'INACTIVO';
    }

    if (totalActivos === totalUsuarios) {
      return 'ACTIVO';
    }

    return 'MIXTO';
  }
  
  private sincronizarSwitchesGlobales(usuarios: UsuarioListadoItem[]): void {
    const usuariosOperativosConAcceso = usuarios.filter(
      (usuario) => usuario.activo && usuario.rol !== ROLES.CONSULTA && usuario.habilitaMensual,
    );

    if (usuariosOperativosConAcceso.length === 0) {
      this.habilitaCargaGlobal.set(false);
      this.habilitaModificacionGlobal.set(false);
      return;
    }

    this.habilitaCargaGlobal.set(usuariosOperativosConAcceso.every((usuario) => usuario.habilitaCarga));
    this.habilitaModificacionGlobal.set(usuariosOperativosConAcceso.every((usuario) => usuario.habilitaModificacion));
  }
}
