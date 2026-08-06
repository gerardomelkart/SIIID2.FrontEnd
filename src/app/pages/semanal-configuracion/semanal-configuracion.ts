import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ROLES } from '../../core/constants/roles.constants';
import { UsuarioListadoItem } from '../../core/models/usuarios.models';
import { SessionService } from '../../core/services/session.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import {
  confirmarAccion,
  mostrarAdvertenciaHtml,
  mostrarError,
  mostrarExitoInstitucional,
  mostrarInfo,
} from '../../core/utils/alert.utils';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';
import {
  EstadoOrden,
  alternarOrden,
  obtenerIconoOrden,
  ordenarPorEstado,
} from '../../core/utils/sort.utils';

interface ConfiguracionEntidadSemanal {
  idEntidadFederativa: number | null;
  entidadFederativa: string;
  totalUsuarios: number;
  totalUsuariosOperativos: number;
  usuariosAcceso: number;
  usuariosCarga: number;
  estadoAcceso: 'ACTIVO' | 'INACTIVO' | 'MIXTO';
  estadoCarga: 'ACTIVO' | 'INACTIVO' | 'MIXTO';
}

interface UsuarioPermisoEntidadSemanal {
  idUsuario: number;
  usuario: string;
  nombreCompleto: string;
  rol: string;
  habilitaSemanalOriginal: boolean;
  habilitaCargaOriginal: boolean;
  habilitaSemanal: boolean;
  habilitaCarga: boolean;
  administraDelitosSemanal: boolean;
  bloqueaOperacion: boolean;
  esUsuarioActual: boolean;
}

type CampoOrdenConfiguracionSemanal =
  | 'entidadFederativa'
  | 'estadoAcceso'
  | 'estadoCarga'
  | 'usuariosAcceso'
  | 'usuariosCarga'
  | 'totalUsuarios';

@Component({
  selector: 'app-semanal-configuracion',
  imports: [FormsModule],
  templateUrl: './semanal-configuracion.html',
  styleUrls: ['../configuracion/configuracion.css', './semanal-configuracion.css'],
})
export class SemanalConfiguracion implements OnInit {
  private readonly usuariosService = inject(UsuariosService);
  private readonly sessionService = inject(SessionService);

  cargando = signal(false);
  guardandoGlobal = signal(false);
  guardandoEntidad = signal(false);
  exportandoExcel = signal(false);
  modalEntidadAbierto = signal(false);

  busquedaEntidad = signal('');
  paginaEntidades = signal(1);
  readonly tamanioPaginaEntidades = 10;

  habilitaCargaGlobal = signal(true);

  ordenEntidades = signal<EstadoOrden<CampoOrdenConfiguracionSemanal> | null>(null);
  entidadSeleccionada = signal<ConfiguracionEntidadSemanal | null>(null);
  usuariosEntidad = signal<UsuarioPermisoEntidadSemanal[]>([]);
  usuarios = signal<UsuarioListadoItem[]>([]);

  usuarioActual = this.sessionService.usuario;

  entidadesConfiguracion = computed<ConfiguracionEntidadSemanal[]>(() => {
    const grupos = new Map<string, UsuarioListadoItem[]>();

    for (const usuario of this.usuarios()) {
      if (!usuario.activo) continue;

      const key = usuario.idEntidadFederativa?.toString() ?? 'NACIONAL';
      const lista = grupos.get(key) ?? [];

      lista.push(usuario);
      grupos.set(key, lista);
    }

    const resultado: ConfiguracionEntidadSemanal[] = [];

    grupos.forEach((lista) => {
      const primero = lista[0];
      const usuariosOperativos = lista.filter((usuario) => usuario.rol !== ROLES.CONSULTA);
      const usuariosAcceso = lista.filter((usuario) => usuario.habilitaSemanal).length;
      const usuariosCarga = usuariosOperativos.filter(
        (usuario) => usuario.habilitaSemanal && usuario.habilitaCargaSemanal,
      ).length;

      resultado.push({
        idEntidadFederativa: primero.idEntidadFederativa,
        entidadFederativa: primero.entidadFederativa || 'Nacional',
        totalUsuarios: lista.length,
        totalUsuariosOperativos: usuariosOperativos.length,
        usuariosAcceso,
        usuariosCarga,
        estadoAcceso: this.obtenerEstadoPermiso(usuariosAcceso, lista.length),
        estadoCarga: this.obtenerEstadoPermiso(usuariosCarga, usuariosOperativos.length),
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

    return ordenarPorEstado(
      filtradas,
      this.ordenEntidades(),
      (entidad, campo) => entidad[campo] ?? '',
    );
  });

  entidadesPaginadas = computed(() => {
    const inicio = (this.paginaEntidades() - 1) * this.tamanioPaginaEntidades;

    return this.entidadesFiltradas().slice(inicio, inicio + this.tamanioPaginaEntidades);
  });

  totalPaginasEntidades = computed(() =>
    Math.max(1, Math.ceil(this.entidadesFiltradas().length / this.tamanioPaginaEntidades)),
  );

  totalEntidades = computed(() => this.entidadesConfiguracion().length);

  totalEntidadesAccesoActivo = computed(
    () =>
      this.entidadesConfiguracion().filter((entidad) => entidad.estadoAcceso === 'ACTIVO').length,
  );

  totalEntidadesCargaActiva = computed(
    () =>
      this.entidadesConfiguracion().filter((entidad) => entidad.estadoCarga === 'ACTIVO').length,
  );

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
        this.paginaEntidades.set(1);
        this.cargando.set(false);
      },
      error: (error) => {
        this.cargando.set(false);

        mostrarError(
          'No fue posible cargar configuración semanal',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  ordenarEntidadesPor(campo: CampoOrdenConfiguracionSemanal): void {
    this.ordenEntidades.set(alternarOrden(this.ordenEntidades(), campo));
    this.paginaEntidades.set(1);
  }

  iconoOrdenEntidades(campo: CampoOrdenConfiguracionSemanal): string {
    return obtenerIconoOrden(this.ordenEntidades(), campo);
  }

  buscarEntidades(valor: string): void {
    this.busquedaEntidad.set(valor);
    this.paginaEntidades.set(1);
  }

  cambiarPaginaEntidades(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginasEntidades()) return;

    this.paginaEntidades.set(pagina);
  }

  cambiarCargaGlobal(valor: boolean): void {
    this.habilitaCargaGlobal.set(valor);
  }

  etiquetaEstado(estado: 'ACTIVO' | 'INACTIVO' | 'MIXTO'): string {
    if (estado === 'ACTIVO') return 'Activo';
    if (estado === 'INACTIVO') return 'Inactivo';

    return 'Mixto';
  }

  async exportarConfiguracionExcel(): Promise<void> {
    this.exportandoExcel.set(true);

    try {
      const filas = this.entidadesFiltradas().map((entidad) => ({
        'Entidad federativa': entidad.entidadFederativa,
        'Acceso al módulo preliminar': this.etiquetaEstado(entidad.estadoAcceso),
        'Usuarios con acceso': `${entidad.usuariosAcceso} de ${entidad.totalUsuarios}`,
        'Carga semanal': this.etiquetaEstado(entidad.estadoCarga),
        'Usuarios con carga': `${entidad.usuariosCarga} de ${entidad.totalUsuariosOperativos}`,
      }));

      const exportado = await exportarFilasExcel(
        filas,
        'configuracion_semanal_por_entidad.xlsx',
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

  guardarConfiguracionGlobal(): void {
    const usuariosObjetivo = this.usuarios().filter(
      (usuario) => usuario.activo && usuario.rol !== ROLES.CONSULTA && usuario.habilitaSemanal,
    );

    if (usuariosObjetivo.length === 0) {
      mostrarInfo(
        'Sin usuarios operativos',
        'No existen usuarios operativos con acceso al módulo preliminar para actualizar.',
      );

      return;
    }

    confirmarAccion(
      'Actualizar configuración semanal global',
      `Se actualizará la carga semanal de ${usuariosObjetivo.length} usuario(s) operativo(s) con acceso al módulo preliminar.`,
      'Sí, actualizar',
    ).then((result) => {
      if (!result.isConfirmed) return;

      this.guardandoGlobal.set(true);

      const operaciones = usuariosObjetivo.map((usuario) =>
        this.usuariosService
          .actualizarPermisosSemanales(usuario.idUsuario, {
            habilitaSemanal: usuario.habilitaSemanal,
            habilitaCargaSemanal: this.habilitaCargaGlobal(),
            administraDelitosSemanal: usuario.administraDelitosSemanal,
          })
          .pipe(
            catchError((error) =>
              of({
                esValido: false,
                codigo: 'ERROR_ACTUALIZAR_PERMISOS_SEMANALES',
                mensaje: obtenerMensajeErrorHttp(
                  error,
                  `No fue posible actualizar ${usuario.usuario}.`,
                ),
                idUsuario: usuario.idUsuario,
              }),
            ),
          ),
      );

      forkJoin(operaciones).subscribe({
        next: (resultados) => {
          this.guardandoGlobal.set(false);

          const errores = resultados.filter((resultado) => !resultado.esValido);

          if (errores.length > 0) {
            mostrarAdvertenciaHtml(
              'Algunos usuarios no se actualizaron',
              errores.map((error) => `• ${error.mensaje}`).join('<br>'),
            );

            this.cargarUsuarios();
            return;
          }

          mostrarExitoInstitucional('Configuración semanal actualizada');

          this.cargarUsuarios();
        },
        error: (error) => {
          this.guardandoGlobal.set(false);

          mostrarError(
            'No fue posible actualizar configuración semanal',
            obtenerMensajeErrorHttp(error, 'Intente nuevamente.'),
          );
        },
      });
    });
  }

  abrirPermisosEntidad(entidad: ConfiguracionEntidadSemanal): void {
    const idUsuarioActual = this.usuarioActual()?.idUsuario ?? null;

    const usuariosEntidad = this.usuarios()
      .filter((usuario) => usuario.activo)
      .filter((usuario) => usuario.idEntidadFederativa === entidad.idEntidadFederativa)
      .map((usuario) => ({
        idUsuario: usuario.idUsuario,
        usuario: usuario.usuario,
        nombreCompleto: usuario.nombreCompleto,
        rol: usuario.rol,
        habilitaSemanalOriginal: usuario.habilitaSemanal,
        habilitaCargaOriginal: usuario.habilitaCargaSemanal,
        habilitaSemanal: usuario.habilitaSemanal,
        habilitaCarga: usuario.habilitaCargaSemanal,
        administraDelitosSemanal: usuario.administraDelitosSemanal,
        bloqueaOperacion: usuario.rol === ROLES.CONSULTA,
        esUsuarioActual: usuario.idUsuario === idUsuarioActual,
      }))
      .sort((a, b) =>
        a.nombreCompleto.localeCompare(b.nombreCompleto, 'es', {
          sensitivity: 'base',
        }),
      );

    this.entidadSeleccionada.set(entidad);
    this.usuariosEntidad.set(usuariosEntidad);
    this.modalEntidadAbierto.set(true);
  }

  cerrarPermisosEntidad(): void {
    if (this.guardandoEntidad()) return;

    this.modalEntidadAbierto.set(false);
    this.entidadSeleccionada.set(null);
    this.usuariosEntidad.set([]);
  }

  cambiarPermisoUsuarioEntidad(
    idUsuario: number,
    permiso: 'habilitaSemanal' | 'habilitaCarga',
    valor: boolean,
  ): void {
    this.usuariosEntidad.update((usuarios) =>
      usuarios.map((usuario) => {
        if (usuario.idUsuario !== idUsuario) return usuario;

        if (permiso === 'habilitaSemanal') {
          if (usuario.esUsuarioActual && !valor) return usuario;

          return {
            ...usuario,
            habilitaSemanal: valor,
            habilitaCarga: valor ? usuario.habilitaCarga : false,
          };
        }

        if (usuario.bloqueaOperacion) return usuario;

        return {
          ...usuario,
          habilitaSemanal: valor ? true : usuario.habilitaSemanal,
          [permiso]: valor,
        };
      }),
    );
  }

  hayCambiosEntidad(): boolean {
    return this.usuariosEntidad().some(
      (usuario) =>
        usuario.habilitaSemanal !== usuario.habilitaSemanalOriginal ||
        usuario.habilitaCarga !== usuario.habilitaCargaOriginal,
    );
  }

  guardarPermisosEntidad(): void {
    const usuariosModificados = this.usuariosEntidad().filter(
      (usuario) =>
        usuario.habilitaSemanal !== usuario.habilitaSemanalOriginal ||
        usuario.habilitaCarga !== usuario.habilitaCargaOriginal,
    );

    if (usuariosModificados.length === 0) {
      mostrarInfo('Sin cambios', 'No hay cambios por guardar.');

      return;
    }

    confirmarAccion(
      'Guardar configuración semanal por entidad',
      `Se actualizarán permisos de ${usuariosModificados.length} usuario(s).`,
      'Sí, guardar',
    ).then((result) => {
      if (!result.isConfirmed) return;

      this.guardandoEntidad.set(true);

      const operaciones = usuariosModificados.map((usuario) => {
        const habilitaCargaSemanal =
          usuario.habilitaSemanal && !usuario.bloqueaOperacion && usuario.habilitaCarga;

        const administraDelitosSemanal = usuario.habilitaSemanal
          ? usuario.administraDelitosSemanal
          : false;

        return this.usuariosService
          .actualizarPermisosSemanales(usuario.idUsuario, {
            habilitaSemanal: usuario.habilitaSemanal,
            habilitaCargaSemanal,
            administraDelitosSemanal,
          })
          .pipe(
            catchError((error) =>
              of({
                esValido: false,
                codigo: 'ERROR_ACTUALIZAR_PERMISOS_SEMANALES',
                mensaje: obtenerMensajeErrorHttp(
                  error,
                  `No fue posible actualizar ${usuario.usuario}.`,
                ),
                idUsuario: usuario.idUsuario,
              }),
            ),
          );
      });

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

          mostrarExitoInstitucional('Configuración semanal actualizada');

          this.cerrarPermisosEntidad();
          this.cargarUsuarios();
        },
        error: (error) => {
          this.guardandoEntidad.set(false);

          mostrarError(
            'No fue posible actualizar permisos semanales',
            obtenerMensajeErrorHttp(error, 'Intente nuevamente.'),
          );
        },
      });
    });
  }

  private obtenerEstadoPermiso(
    totalActivos: number,
    totalUsuarios: number,
  ): 'ACTIVO' | 'INACTIVO' | 'MIXTO' {
    if (totalUsuarios === 0 || totalActivos === 0) return 'INACTIVO';
    if (totalActivos === totalUsuarios) return 'ACTIVO';

    return 'MIXTO';
  }

  private sincronizarSwitchesGlobales(usuarios: UsuarioListadoItem[]): void {
    const usuariosOperativosConAcceso = usuarios.filter(
      (usuario) => usuario.activo && usuario.rol !== ROLES.CONSULTA && usuario.habilitaSemanal,
    );

    if (usuariosOperativosConAcceso.length === 0) {
      this.habilitaCargaGlobal.set(false);
      return;
    }

    this.habilitaCargaGlobal.set(
      usuariosOperativosConAcceso.every((usuario) => usuario.habilitaCargaSemanal),
    );
  }
}
