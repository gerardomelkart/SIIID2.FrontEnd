import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  confirmarAccion,
  mostrarAdvertencia,
  mostrarError,
  mostrarExitoInstitucional,
  mostrarInfo,
} from '../../core/utils/alert.utils';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ROLES } from '../../core/constants/roles.constants';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';

import { FederalUsuarioDetalle } from '../../core/models/federal-usuarios.models';

import {
  EstadoOrden,
  alternarOrden,
  obtenerIconoOrden,
  ordenarPorEstado,
} from '../../core/utils/sort.utils';

import { FederalUsuariosService } from '../../core/services/federal-usuarios.service';
import { SessionService } from '../../core/services/session.service';

interface ConfiguracionGrupo {
  clave: string;
  alcance: string;
  totalUsuarios: number;
  totalUsuariosOperativos: number;
  usuariosAcceso: number;
  usuariosCarga: number;
  usuariosModificacion: number;
  estadoAcceso: 'ACTIVO' | 'INACTIVO' | 'MIXTO';
  estadoCarga: 'ACTIVO' | 'INACTIVO' | 'MIXTO';
  estadoModificacion: 'ACTIVO' | 'INACTIVO' | 'MIXTO';
}

interface UsuarioPermisoGrupo {
  idUsuario: number;
  usuario: string;
  nombreCompleto: string;
  rol: string;
  alcance: string;
  habilitaFederalOriginal: boolean;
  habilitaCargaOriginal: boolean;
  habilitaModificacionOriginal: boolean;
  habilitaFederal: boolean;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  bloqueaOperacion: boolean;
  esUsuarioActual: boolean;
}

type CampoOrdenConfiguracionGrupo =
  | 'alcance'
  | 'estadoAcceso'
  | 'estadoCarga'
  | 'estadoModificacion'
  | 'usuariosAcceso'
  | 'usuariosCarga'
  | 'usuariosModificacion'
  | 'totalUsuarios';

@Component({
  selector: 'app-federal-configuracion',
  imports: [FormsModule],
  templateUrl: './federal-configuracion.html',
  styleUrl: './federal-configuracion.css',
})
export class FederalConfiguracion implements OnInit {
  private readonly usuariosService = inject(FederalUsuariosService);
  private readonly sessionService = inject(SessionService);

  cargando = signal(false);
  guardandoGlobal = signal(false);

  busquedaGrupo = signal('');
  paginaGrupos = signal(1);
  readonly tamanioPaginaGrupos = 10;

  habilitaCargaGlobal = signal(true);
  habilitaModificacionGlobal = signal(true);

  ordenGrupos = signal<EstadoOrden<CampoOrdenConfiguracionGrupo> | null>(null);

  exportandoExcel = signal(false);

  modalGrupoAbierto = signal(false);
  guardandoGrupo = signal(false);
  grupoSeleccionada = signal<ConfiguracionGrupo | null>(null);
  usuariosGrupo = signal<UsuarioPermisoGrupo[]>([]);

  usuarios = signal<FederalUsuarioDetalle[]>([]);

  usuarioActual = this.sessionService.usuario;

  gruposConfiguracion = computed<ConfiguracionGrupo[]>(() => {
    const grupos = new Map<string, FederalUsuarioDetalle[]>();
    for (const usuario of this.usuarios()) {
      if (!usuario.activo) continue;
      const clave = this.claveGrupoUsuario(usuario);
      const lista = grupos.get(clave) ?? [];
      lista.push(usuario);
      grupos.set(clave, lista);
    }

    const resultado: ConfiguracionGrupo[] = [];
    grupos.forEach((lista, clave) => {
      const usuariosOperativos = lista.filter((usuario) => usuario.rol !== ROLES.CONSULTA);
      const usuariosAcceso = lista.filter((usuario) => usuario.habilitaFederal).length;
      const usuariosCarga = usuariosOperativos.filter((usuario) => usuario.habilitaFederal && usuario.habilitaCarga).length;
      const usuariosModificacion = usuariosOperativos.filter((usuario) => usuario.habilitaFederal && usuario.habilitaModificacion).length;
      resultado.push({
        clave,
        alcance: lista[0].entidadFederativa || 'Nacional',
        totalUsuarios: lista.length,
        totalUsuariosOperativos: usuariosOperativos.length,
        usuariosAcceso,
        usuariosCarga,
        usuariosModificacion,
        estadoAcceso: this.obtenerEstadoPermiso(usuariosAcceso, lista.length),
        estadoCarga: this.obtenerEstadoPermiso(usuariosCarga, usuariosOperativos.length),
        estadoModificacion: this.obtenerEstadoPermiso(usuariosModificacion, usuariosOperativos.length),
      });
    });

    return resultado;
  });

  gruposFiltradas = computed(() => {
    const texto = this.busquedaGrupo().trim().toLowerCase();

    const filtradas = !texto
      ? this.gruposConfiguracion()
      : this.gruposConfiguracion().filter((grupo) =>
          grupo.alcance.toLowerCase().includes(texto),
        );

    return this.ordenarGruposConfiguracion(filtradas);
  });

  gruposPaginadas = computed(() => {
    const inicio = (this.paginaGrupos() - 1) * this.tamanioPaginaGrupos;
    return this.gruposFiltradas().slice(inicio, inicio + this.tamanioPaginaGrupos);
  });

  totalPaginasGrupos = computed(() =>
    Math.max(1, Math.ceil(this.gruposFiltradas().length / this.tamanioPaginaGrupos)),
  );

  totalGrupos = computed(() => this.gruposConfiguracion().length);
  totalGruposAccesoActivo = computed(() => this.gruposConfiguracion().filter((grupo) => grupo.usuariosAcceso > 0).length);
  totalGruposCargaActiva = computed(() => this.gruposConfiguracion().filter((grupo) => grupo.usuariosCarga > 0).length);
  totalGruposModificacionActiva = computed(() => this.gruposConfiguracion().filter((grupo) => grupo.usuariosModificacion > 0).length);

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.cargando.set(true);

    this.usuariosService.obtenerUsuarios(true).subscribe({
      next: (response) => {
        const usuarios = response.usuarios ?? [];

        this.usuarios.set(usuarios);
        this.paginaGrupos.set(1);
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

  ordenarGruposPor(campo: CampoOrdenConfiguracionGrupo): void {
    this.ordenGrupos.set(alternarOrden(this.ordenGrupos(), campo));
    this.paginaGrupos.set(1);
  }

  iconoOrdenGrupos(campo: CampoOrdenConfiguracionGrupo): string {
    return obtenerIconoOrden(this.ordenGrupos(), campo);
  }

  buscarGrupos(valor: string): void {
    this.busquedaGrupo.set(valor);
    this.paginaGrupos.set(1);
  }

  cambiarPaginaGrupos(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginasGrupos()) {
      return;
    }

    this.paginaGrupos.set(pagina);
  }

  async exportarConfiguracionExcel(): Promise<void> {
    this.exportandoExcel.set(true);

    try {
      const filas = this.gruposFiltradas().map((grupo) => ({
        'Entidad federativa': grupo.alcance,
        'Acceso al módulo Federal': this.etiquetaEstado(grupo.estadoAcceso),
        'Usuarios con acceso': `${grupo.usuariosAcceso} de ${grupo.totalUsuarios}`,
        'Carga de archivos': this.etiquetaEstado(grupo.estadoCarga),
        'Usuarios con carga': `${grupo.usuariosCarga} de ${grupo.totalUsuariosOperativos}`,
        Actualización: this.etiquetaEstado(grupo.estadoModificacion),
        'Usuarios con actualización': `${grupo.usuariosModificacion} de ${grupo.totalUsuariosOperativos}`,
      }));

      const exportado = await exportarFilasExcel(
        filas,
        'configuracion_federal.xlsx',
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

  private ordenarGruposConfiguracion(lista: ConfiguracionGrupo[]): ConfiguracionGrupo[] {
    return ordenarPorEstado(lista, this.ordenGrupos(), (grupo, campo) => grupo[campo] ?? '');
  }

  guardarConfiguracionGlobal(): void {
    if (this.guardandoGlobal() || this.guardandoGrupo() || this.cargando()) return;
    confirmarAccion(
      'Actualizar permisos globales',
      'Esta acción actualizará carga y actualización para todos los usuarios activos con acceso al módulo Federal, excepto usuarios con rol CONSULTA.',
      'Sí, actualizar',
    ).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      if (this.guardandoGlobal() || this.guardandoGrupo()) return;
      this.guardandoGlobal.set(true);

      this.usuariosService
        .actualizarPermisosGlobales({
          habilitaCarga: this.habilitaCargaGlobal(),
          habilitaModificacion: this.habilitaModificacionGlobal(),
        })
        .subscribe({
          next: (response) => {
            this.guardandoGlobal.set(false);

            if (!response.esValido) {
              mostrarAdvertencia('No fue posible actualizar', response.mensaje);
              return;
            }

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

  abrirPermisosGrupo(grupo: ConfiguracionGrupo): void {
    const idUsuarioActual = this.usuarioActual()?.idUsuario ?? null;

    const usuariosGrupo = this.usuarios()
      .filter((usuario) => usuario.activo && this.claveGrupoUsuario(usuario) === grupo.clave)
      .map((usuario) => ({
        idUsuario: usuario.idUsuario,
        usuario: usuario.usuario,
        nombreCompleto: usuario.nombreCompleto,
        rol: usuario.rol,
        alcance: usuario.entidadFederativa || 'Nacional',
        habilitaFederalOriginal: usuario.habilitaFederal,
        habilitaCargaOriginal: usuario.habilitaCarga,
        habilitaModificacionOriginal: usuario.habilitaModificacion,
        habilitaFederal: usuario.habilitaFederal,
        habilitaCarga: usuario.habilitaCarga,
        habilitaModificacion: usuario.habilitaModificacion,
        bloqueaOperacion: usuario.rol === ROLES.CONSULTA,
        esUsuarioActual: usuario.idUsuario === idUsuarioActual,
      }))
      .sort((a, b) =>
        a.nombreCompleto.localeCompare(b.nombreCompleto, 'es', { sensitivity: 'base' }),
      );

    this.grupoSeleccionada.set(grupo);
    this.usuariosGrupo.set(usuariosGrupo);
    this.modalGrupoAbierto.set(true);
  }

  cerrarPermisosGrupo(): void {
    if (this.guardandoGrupo()) {
      return;
    }

    this.modalGrupoAbierto.set(false);
    this.grupoSeleccionada.set(null);
    this.usuariosGrupo.set([]);
  }

  cambiarPermisoUsuarioGrupo(
    idUsuario: number,
    permiso: 'habilitaFederal' | 'habilitaCarga' | 'habilitaModificacion',
    valor: boolean,
  ): void {
    this.usuariosGrupo.update((usuarios) =>
      usuarios.map((usuario) => {
        if (usuario.idUsuario !== idUsuario) {
          return usuario;
        }

        if (permiso === 'habilitaFederal') {
          if (!valor && usuario.esUsuarioActual) {
            return usuario;
          }

          return {
            ...usuario,
            habilitaFederal: valor,
            habilitaCarga: valor ? usuario.habilitaCarga : false,
            habilitaModificacion: valor ? usuario.habilitaModificacion : false,
          };
        }

        if (usuario.bloqueaOperacion) {
          return usuario;
        }

        return {
          ...usuario,
          habilitaFederal: valor ? true : usuario.habilitaFederal,
          [permiso]: valor,
        };
      }),
    );
  }

  hayCambiosGrupo(): boolean {
    return this.usuariosGrupo().some(
      (usuario) =>
        usuario.habilitaFederal !== usuario.habilitaFederalOriginal ||
        usuario.habilitaCarga !== usuario.habilitaCargaOriginal ||
        usuario.habilitaModificacion !== usuario.habilitaModificacionOriginal,
    );
  }

  guardarPermisosGrupo(): void {
    if (this.guardandoGrupo() || this.guardandoGlobal() || this.cargando()) return;
    const usuariosModificados = this.usuariosGrupo().filter(
      (usuario) =>
        usuario.habilitaFederal !== usuario.habilitaFederalOriginal ||
        usuario.habilitaCarga !== usuario.habilitaCargaOriginal ||
        usuario.habilitaModificacion !== usuario.habilitaModificacionOriginal,
    );

    if (usuariosModificados.length === 0) {
      mostrarInfo('Sin cambios', 'No hay cambios por guardar.');

      return;
    }

    confirmarAccion(
      'Guardar permisos Federal',
      `Se actualizarán permisos de ${usuariosModificados.length} usuario(s).`,
      'Sí, guardar',
    ).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      if (this.guardandoGrupo() || this.guardandoGlobal()) return;
      this.guardandoGrupo.set(true);

      const operaciones = usuariosModificados.map((usuarioPermiso) =>
        this.usuariosService.actualizarPermisos(usuarioPermiso.idUsuario, {
          habilitaFederal: usuarioPermiso.habilitaFederal,
          habilitaCarga: usuarioPermiso.habilitaFederal && !usuarioPermiso.bloqueaOperacion && usuarioPermiso.habilitaCarga,
          habilitaModificacion: usuarioPermiso.habilitaFederal && !usuarioPermiso.bloqueaOperacion && usuarioPermiso.habilitaModificacion,
        }).pipe(
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
          this.guardandoGrupo.set(false);

          const errores = resultados.filter((resultado) => !resultado.esValido);

          if (errores.length > 0) {
            const actualizados = new Set(resultados.filter((resultado) => resultado.esValido).map((resultado) => resultado.idUsuario));
            this.usuariosGrupo.update((usuarios) => usuarios.map((usuario) => actualizados.has(usuario.idUsuario) ? {
              ...usuario,
              habilitaFederalOriginal: usuario.habilitaFederal,
              habilitaCargaOriginal: usuario.habilitaCarga,
              habilitaModificacionOriginal: usuario.habilitaModificacion,
            } : usuario));
            mostrarAdvertencia(
              'Algunos usuarios no se actualizaron',
              errores.map((error) => `• ${error.mensaje}`).join('\n'),
            );

            this.cargarUsuarios();
            return;
          }

          mostrarExitoInstitucional(
            'Permisos actualizados',
            `Se actualizaron correctamente los permisos de ${usuariosModificados.length} usuario(s).`,
          );

          this.cerrarPermisosGrupo();
          this.cargarUsuarios();
        },
        error: (error) => {
          this.guardandoGrupo.set(false);

          mostrarError(
            'No fue posible actualizar permisos',
            obtenerMensajeErrorHttp(error, 'Intente nuevamente.'),
          );
        },
      });
    });
  }

  private claveGrupoUsuario(usuario: FederalUsuarioDetalle): string {
    return usuario.idEntidadFederativa?.toString() ?? 'NACIONAL';
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

  private sincronizarSwitchesGlobales(usuarios: FederalUsuarioDetalle[]): void {
    const usuariosOperativosConAcceso = usuarios.filter(
      (usuario) => usuario.activo && usuario.rol !== ROLES.CONSULTA && usuario.habilitaFederal,
    );

    if (usuariosOperativosConAcceso.length === 0) {
      this.habilitaCargaGlobal.set(false);
      this.habilitaModificacionGlobal.set(false);
      return;
    }

    this.habilitaCargaGlobal.set(
      usuariosOperativosConAcceso.every((usuario) => usuario.habilitaCarga),
    );
    this.habilitaModificacionGlobal.set(
      usuariosOperativosConAcceso.every((usuario) => usuario.habilitaModificacion),
    );
  }
}
