import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CatalogosService } from '../../core/services/catalogos.service';
import { EntidadFederativaCatalogoItem } from '../../core/models/catalogos.models';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';

import {
  mostrarAdvertencia,
  mostrarError,
  mostrarExito,
  mostrarExitoInstitucional,
} from '../../core/utils/alert.utils';
import { ROLES } from '../../core/constants/roles.constants';
import { crearSafeBlobUrl, revocarObjectUrl } from '../../core/utils/blob-url.utils';
import { obtenerErrorPayload, obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';
import { catchError, finalize, map, of, switchMap } from 'rxjs';

import {
  ActualizacionAnioDisponibleItem,
  ActualizacionDiferenciasResponse,
  ActualizacionPeriodoResponse,
} from '../../core/models/actualizacion.models';

import {
  CargaValidacionResponse,
  CargaValidacionResumenItem,
} from '../../core/models/carga.models';

import { ArchivoCargaTipo, ArchivosCargaSeleccionados } from '../../core/types/archivo-carga.types';

import {
  actualizarArchivoSeleccionado,
  crearArchivosCargaVacios,
  obtenerArchivoDesdeEvento,
  obtenerResumenPorArchivo,
  tieneTresArchivosSeleccionados,
} from '../../core/utils/archivo-carga.utils';

import { ActualizacionService } from '../../core/services/actualizacion.service';
import { SessionService } from '../../core/services/session.service';

type EstadoPeriodo =
  | 'SIN_CONSULTAR'
  | 'CONSULTANDO'
  | 'DISPONIBLE'
  | 'NO_DISPONIBLE'
  | 'VALIDANDO'
  | 'VALIDADO_ERROR'
  | 'VALIDADO_ADVERTENCIA'
  | 'MOSTRANDO_DIFERENCIAS'
  | 'MOSTRANDO_ACUSE'
  | 'CONFIRMANDO'
  | 'CONFIRMADO'
  | 'RECHAZADO'
  | 'ERROR';

@Component({
  selector: 'app-actualizacion',
  imports: [FormsModule],
  templateUrl: './actualizacion.html',
  styleUrl: './actualizacion.css',
})
export class Actualizacion implements OnInit {
  private readonly actualizacionService = inject(ActualizacionService);
  private readonly sessionService = inject(SessionService);
  private readonly catalogosService = inject(CatalogosService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);

  anioCorte = signal<string>('');
  mesCorte = signal<string>('');
  idEntidadFederativa = signal<string>('');
  entidadesFederativas = signal<EntidadFederativaCatalogoItem[]>([]);
  cargandoEntidades = signal(false);

  periodosDisponibles = signal<ActualizacionAnioDisponibleItem[]>([]);
  cargandoAniosCorte = signal(false);

  aniosCorte = computed(() => {
    return this.periodosDisponibles().map((periodo) => periodo.anioCorte.toString());
  });

  mesesCorte = computed(() => {
    const anio = Number(this.anioCorte());

    if (!anio) {
      return [];
    }

    const periodo = this.periodosDisponibles().find((item) => item.anioCorte === anio);

    return (periodo?.meses ?? []).map((mes) => ({
      valor: mes.mesCorte.toString(),
      nombre: mes.nombreMes,
    }));
  });

  estadoPeriodo = signal<EstadoPeriodo>('SIN_CONSULTAR');
  respuestaPeriodo = signal<ActualizacionPeriodoResponse | null>(null);
  respuestaValidacion = signal<CargaValidacionResponse | null>(null);
  diferencias = signal<ActualizacionDiferenciasResponse | null>(null);

  mensajePeriodo = signal('');
  errorGeneral = signal('');

  archivos = signal<ArchivosCargaSeleccionados>(crearArchivosCargaVacios());

  archivoArrastrado = signal<ArchivoCargaTipo | null>(null);

  private acusePrevioObjectUrl: string | null = null;
  private acuseConfirmadoObjectUrl: string | null = null;

  cargandoDiferencias = signal(false);
  generandoAcusePrevio = signal(false);
  procesandoConfirmacion = signal(false);
  mensajeConfirmacion = signal('');

  acusePrevioUrl = signal<SafeResourceUrl | null>(null);
  acuseConfirmadoUrl = signal<SafeResourceUrl | null>(null);

  usuario = this.sessionService.usuario;

  esSuperUsuario = computed(() => {
    return this.usuario()?.rol === ROLES.SUPER_USUARIO;
  });

  puedeConsultar = computed(() => {
    const tienePeriodo = this.anioCorte() !== '' && this.mesCorte() !== '';

    if (!tienePeriodo) {
      return false;
    }

    if (this.esSuperUsuario()) {
      return this.idEntidadFederativa() !== '';
    }

    return true;
  });

  mostrarSelectorEntidad = computed(() => this.esSuperUsuario());

  mostrarArchivos = computed(() => this.estadoPeriodo() === 'DISPONIBLE');

  puedeValidarActualizacion = computed(() => {
    return tieneTresArchivosSeleccionados(this.archivos()) && this.estadoPeriodo() === 'DISPONIBLE';
  });

  mostrarTablasErrores = computed(() => {
    return (
      (this.estadoPeriodo() === 'VALIDADO_ERROR' ||
        this.estadoPeriodo() === 'VALIDADO_ADVERTENCIA') &&
      !!this.respuestaValidacion()
    );
  });

  resumenCarpetas = computed(() => this.resumenPorArchivo('carpetas'));
  resumenDelitos = computed(() => this.resumenPorArchivo('delitos'));
  resumenVictimas = computed(() => this.resumenPorArchivo('victimas'));

  errores = computed(() => this.respuestaValidacion()?.errores ?? []);
  advertencias = computed(() => this.respuestaValidacion()?.advertencias ?? []);

  hayAdvertenciasDeDecision = computed(() => {
    return this.advertencias().length > 0;
  });

  detallesValidacion = computed(() => [...this.errores(), ...this.advertencias()]);
  codigoReferencia = computed(() => this.respuestaValidacion()?.codigoReferencia ?? '');

  errorActualizacionPendiente = computed(() => {
    return (
      this.errores().find(
        (error) =>
          error.codigo === 'ACTUALIZACION_PENDIENTE_EXISTENTE' ||
          error.codigo === 'ACTUALIZACION_PENDIENTE_APROBACION',
      ) ?? null
    );
  });

  estadoActualizacionPendiente = computed(() => {
    const estadoPeriodo = this.respuestaPeriodo()?.estadoActualizacionPendiente;

    if (estadoPeriodo) {
      return estadoPeriodo;
    }

    const errorPendiente = this.errorActualizacionPendiente();

    if (!errorPendiente) {
      return null;
    }

    return errorPendiente.codigo === 'ACTUALIZACION_PENDIENTE_APROBACION'
      ? 'PENDIENTE_APROBACION'
      : 'VALIDADO_PENDIENTE_ACTUALIZACION';
  });

  codigoReferenciaPendiente = computed(() => {
    const codigoError = this.errorActualizacionPendiente()?.valor?.trim();

    if (codigoError) {
      return codigoError;
    }

    return this.respuestaPeriodo()?.codigoActualizacionPendiente?.trim() ?? '';
  });

  hayActualizacionPendiente = computed(() => this.codigoReferenciaPendiente() !== '');

  actualizacionEnRevisionAdministrativa = computed(() => {
    return this.estadoActualizacionPendiente() === 'PENDIENTE_APROBACION';
  });

  actualizacionPendientePorResolver = computed(() => {
    return this.hayActualizacionPendiente() && !this.actualizacionEnRevisionAdministrativa();
  });

  hayActualizacionPendienteEnPeriodo = computed(() => {
    return this.estadoPeriodo() === 'NO_DISPONIBLE' && this.hayActualizacionPendiente();
  });

  codigoReferenciaOperacion = computed(() => {
    return this.codigoReferenciaPendiente() || this.codigoReferencia();
  });

  totalDiferenciasCarpetas = computed(() => this.diferencias()?.totalCarpetas ?? 0);
  totalDiferenciasDelitos = computed(() => this.diferencias()?.totalDelitos ?? 0);
  totalDiferenciasVictimas = computed(() => this.diferencias()?.totalVictimas ?? 0);
  totalDiferencias = computed(() => this.diferencias()?.totalDiferencias ?? 0);

  mostrarDiferencias = computed(() => {
    return this.estadoPeriodo() === 'MOSTRANDO_DIFERENCIAS' && !!this.diferencias();
  });

  mostrarLoadingProceso = computed(() => {
    return (
      this.estadoPeriodo() === 'VALIDANDO' ||
      this.cargandoDiferencias() ||
      this.generandoAcusePrevio() ||
      this.procesandoConfirmacion()
    );
  });

  mensajeLoadingProceso = computed(() => {
    if (this.cargandoDiferencias()) {
      return 'Cargando diferencias de la actualización...';
    }

    if (this.generandoAcusePrevio()) {
      return 'Generando informe previo...';
    }

    if (this.procesandoConfirmacion()) {
      return this.mensajeConfirmacion() || 'Procesando actualización...';
    }

    if (this.estadoPeriodo() === 'VALIDANDO') {
      return 'Validando archivos de actualización...';
    }

    return 'Procesando...';
  });

  ngOnInit(): void {
    if (this.esSuperUsuario()) {
      this.cargarEntidadesFederativas();
      return;
    }

    this.cargarPeriodosDisponibles();
  }

  onEntidadChange(valor: string): void {
    this.idEntidadFederativa.set(valor);
    this.anioCorte.set('');
    this.mesCorte.set('');
    this.periodosDisponibles.set([]);

    this.onPeriodoChange();

    if (valor) {
      this.cargarPeriodosDisponibles(Number(valor));
    }
  }

  onAnioChange(valor: string): void {
    this.anioCorte.set(valor);
    this.mesCorte.set('');
    this.onPeriodoChange();
  }

  onPeriodoChange(): void {
    this.estadoPeriodo.set('SIN_CONSULTAR');
    this.respuestaPeriodo.set(null);
    this.respuestaValidacion.set(null);
    this.diferencias.set(null);
    this.mensajePeriodo.set('');
    this.errorGeneral.set('');
    this.limpiarArchivos();
    this.limpiarUrlsPdf();
  }

  consultarPeriodo(): void {
    if (!this.puedeConsultar()) {
      return;
    }

    const mes = Number(this.mesCorte());
    const anio = Number(this.anioCorte());

    const idEntidad = this.esSuperUsuario() ? Number(this.idEntidadFederativa()) : null;

    this.estadoPeriodo.set('CONSULTANDO');
    this.respuestaPeriodo.set(null);
    this.respuestaValidacion.set(null);
    this.diferencias.set(null);
    this.mensajePeriodo.set('Consultando periodo seleccionado...');
    this.errorGeneral.set('');

    this.actualizacionService.consultarPeriodo(mes, anio, idEntidad).subscribe({
      next: (response: ActualizacionPeriodoResponse) => {
        this.respuestaPeriodo.set(response);
        this.mensajePeriodo.set(response.mensaje || '');

        if (response.puedeActualizar) {
          this.estadoPeriodo.set('DISPONIBLE');
          return;
        }

        this.estadoPeriodo.set('NO_DISPONIBLE');
      },
      error: (error: unknown) => {
        const response = obtenerErrorPayload<ActualizacionPeriodoResponse>(error);

        if (response?.mensaje) {
          this.respuestaPeriodo.set(response);
          this.mensajePeriodo.set(response.mensaje);
          this.estadoPeriodo.set('NO_DISPONIBLE');
          return;
        }

        this.estadoPeriodo.set('ERROR');
        this.mensajePeriodo.set(
          obtenerMensajeErrorHttp(error, 'No fue posible consultar el periodo seleccionado.'),
        );
      },
    });
  }

  seleccionarArchivo(event: Event, tipo: ArchivoCargaTipo): void {
    const archivo = obtenerArchivoDesdeEvento(event);

    this.archivos.set(actualizarArchivoSeleccionado(this.archivos(), tipo, archivo));

    this.respuestaValidacion.set(null);
    this.diferencias.set(null);
    this.errorGeneral.set('');
  }

  arrastrarArchivo(event: DragEvent, tipo: ArchivoCargaTipo): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    this.archivoArrastrado.set(tipo);
  }

  salirArrastreArchivo(event: DragEvent, tipo: ArchivoCargaTipo): void {
    const tarjeta = event.currentTarget as HTMLElement | null;
    const destino = event.relatedTarget as Node | null;

    if (tarjeta && destino && tarjeta.contains(destino)) return;
    if (this.archivoArrastrado() === tipo) this.archivoArrastrado.set(null);
  }

  soltarArchivo(event: DragEvent, tipo: ArchivoCargaTipo): void {
    event.preventDefault();
    event.stopPropagation();
    this.archivoArrastrado.set(null);

    const archivo = event.dataTransfer?.files.item(0) ?? null;
    if (!archivo) return;

    this.archivos.set(actualizarArchivoSeleccionado(this.archivos(), tipo, archivo));
    this.respuestaValidacion.set(null);
    this.diferencias.set(null);
    this.errorGeneral.set('');
  }

  nombreArchivo(tipo: ArchivoCargaTipo): string {
    return this.archivos()[tipo]?.name ?? 'Ningún archivo seleccionado';
  }

  validarActualizacion(): void {
    const archivos = this.archivos();

    if (!tieneTresArchivosSeleccionados(archivos)) {
      this.errorGeneral.set('Debe seleccionar los tres archivos: carpetas, delitos y víctimas.');
      return;
    }

    const mes = Number(this.mesCorte());
    const anio = Number(this.anioCorte());

    const idEntidad = this.esSuperUsuario() ? Number(this.idEntidadFederativa()) : null;

    this.estadoPeriodo.set('VALIDANDO');
    this.errorGeneral.set('');
    this.respuestaValidacion.set(null);
    this.diferencias.set(null);
    this.limpiarUrlsPdf();

    this.actualizacionService
      .validarActualizacion(
        mes,
        anio,
        archivos.carpetas!,
        archivos.delitos!,
        archivos.victimas!,
        idEntidad,
      )
      .subscribe({
        next: (response: CargaValidacionResponse) => {
          this.respuestaValidacion.set(response);

          if (!response.esValido) {
            this.estadoPeriodo.set('VALIDADO_ERROR');
            return;
          }

          if (this.hayAdvertenciasDeDecision()) {
            this.estadoPeriodo.set('VALIDADO_ADVERTENCIA');
            return;
          }

          this.prepararRevisionDiferencias(response.codigoReferencia);
        },
        error: (error: unknown) => {
          const response = obtenerErrorPayload<CargaValidacionResponse>(error);

          if (response?.resumenValidacion || response?.errores) {
            this.respuestaValidacion.set(response);
            this.estadoPeriodo.set('VALIDADO_ERROR');
            return;
          }

          this.estadoPeriodo.set('DISPONIBLE');
          this.errorGeneral.set(
            obtenerMensajeErrorHttp(error, 'Intente nuevamente.') ||
              'No fue posible validar la actualización.',
          );
        },
      });
  }
  aceptarAdvertenciasActualizacion(): void {
    const codigoReferencia = this.codigoReferenciaOperacion();

    if (!codigoReferencia) {
      return;
    }

    this.prepararRevisionDiferencias(codigoReferencia);
  }

  continuarAAcusePrevio(): void {
    const codigoReferencia = this.codigoReferenciaOperacion();

    if (!codigoReferencia) {
      return;
    }

    this.abrirAcusePrevio(codigoReferencia);
  }

  volverADiferencias(): void {
    if (this.diferencias()) {
      this.estadoPeriodo.set('MOSTRANDO_DIFERENCIAS');
    }
  }

  aceptarActualizacion(): void {
    const codigoReferencia = this.codigoReferenciaOperacion();

    if (!codigoReferencia) {
      return;
    }
    this.mensajeConfirmacion.set('Aceptando actualización y generando el acuse...');

    this.procesandoConfirmacion.set(true);
    this.estadoPeriodo.set('CONFIRMANDO');

    this.actualizacionService
      .confirmarActualizacion({
        codigoReferencia,
        aceptar: true,
      })
      .pipe(
        switchMap((response) => {
          if (response.estado === 'PENDIENTE_APROBACION') {
            return of({
              response,
              acuseDescargado: false,
              blob: null as Blob | null,
            });
          }

          return this.actualizacionService.descargarAcuseConfirmado(codigoReferencia).pipe(
            map((blob: Blob) => ({
              response,
              acuseDescargado: true,
              blob,
            })),
            catchError(() =>
              of({
                response,
                acuseDescargado: false,
                blob: null as Blob | null,
              }),
            ),
          );
        }),
      )
      .subscribe({
        next: (resultado) => {
          this.procesandoConfirmacion.set(false);
          this.mensajeConfirmacion.set('');

          if (resultado.response.estado === 'PENDIENTE_APROBACION') {
            this.limpiarUrlsPdf();

            mostrarExitoInstitucional(
              'Actualizacion enviada a revision',
              resultado.response.mensaje ||
                'La actualizacion quedo pendiente de aprobacion administrativa.',
            ).then(() => {
              this.reiniciarFormulario();
              this.estadoPeriodo.set('SIN_CONSULTAR');
              this.router.navigateByUrl('/');
            });

            return;
          }

          if (resultado.blob) {
            this.reemplazarAcuseConfirmado(resultado.blob);
          }

          this.estadoPeriodo.set('CONFIRMADO');

          mostrarExito(
            'Actualizacion completada',
            resultado.acuseDescargado
              ? undefined
              : 'La actualizacion fue confirmada, pero no fue posible cargar el acuse confirmado.',
          );
        },
        error: (error: unknown) => {
          this.procesandoConfirmacion.set(false);
          this.mensajeConfirmacion.set('');

          this.estadoPeriodo.set('MOSTRANDO_ACUSE');

          mostrarError(
            'No fue posible procesar la actualización',
            obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
          );
        },
      });
  }

  rechazarActualizacion(): void {
    const codigoReferencia = this.codigoReferenciaOperacion();

    if (!codigoReferencia) {
      return;
    }

    this.mensajeConfirmacion.set('Rechazando actualización...');

    this.procesandoConfirmacion.set(true);
    this.estadoPeriodo.set('CONFIRMANDO');

    this.actualizacionService
      .confirmarActualizacion({
        codigoReferencia,
        aceptar: false,
      })
      .subscribe({
        next: () => {
          this.procesandoConfirmacion.set(false);
          this.mensajeConfirmacion.set('');
          this.estadoPeriodo.set('RECHAZADO');
          this.limpiarUrlsPdf();

          mostrarExitoInstitucional(
            'Actualización rechazada',
            'La actualización fue rechazada correctamente.',
          ).then(() => {
            this.router.navigateByUrl('/');
          });
        },
        error: (error: unknown) => {
          this.procesandoConfirmacion.set(false);
          this.mensajeConfirmacion.set('');
          this.estadoPeriodo.set('MOSTRANDO_ACUSE');

          mostrarError(
            'No fue posible rechazar la actualización',
            obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
          );
        },
      });
  }

  resolverActualizacionPendiente(): void {
    if (this.actualizacionEnRevisionAdministrativa()) {
      mostrarAdvertencia(
        'Actualización en revisión administrativa',
        'La actualización ya fue aceptada y está esperando la resolución del administrador.',
      );

      return;
    }

    const codigoReferencia = this.codigoReferenciaPendiente();

    if (!codigoReferencia) {
      mostrarAdvertencia(
        'Sin referencia pendiente',
        'No fue posible identificar el código de referencia pendiente.',
      );

      return;
    }

    this.prepararRevisionDiferencias(codigoReferencia);
  }

  cerrarProcesoConfirmado(): void {
    this.limpiarUrlsPdf();
    this.reiniciarFormulario();
    this.estadoPeriodo.set('SIN_CONSULTAR');
    this.router.navigateByUrl('/');
  }

  obtenerIdentificadoresDesdeBackend(
    campoIdentificador: string,
    identificadorFiscalia: string,
  ): string[] {
    const campos = campoIdentificador
      .split('+')
      .map((x) => x.trim().toUpperCase())
      .filter((x) => x.length > 0);

    const valores = identificadorFiscalia
      .split('|')
      .map((x) => x.trim())
      .filter((x) => x.length > 0);

    if (campos.length === 0) {
      return [identificadorFiscalia];
    }

    return campos.map((campo, index) => `${campo}: ${valores[index] ?? '-'}`);
  }

  normalizarValorDiferencia(valor: string | null): string {
    if (valor === null || valor === undefined || valor === '') {
      return 'Sin información';
    }

    return valor;
  }

  normalizarTipoMovimiento(tipoMovimiento: string): string {
    const valor = tipoMovimiento?.toUpperCase() ?? '';

    if (valor === 'NUEVO') {
      return 'Nuevo';
    }

    if (valor === 'MODIFICADO') {
      return 'Modificado';
    }

    if (valor === 'ELIMINADO' || valor === 'BAJA') {
      return 'Eliminado';
    }

    return tipoMovimiento;
  }

  esMovimientoNuevo(tipoMovimiento: string): boolean {
    return (tipoMovimiento?.toUpperCase() ?? '') === 'NUEVO';
  }

  prepararNuevaValidacion(): void {
    this.limpiarArchivos();
    this.respuestaValidacion.set(null);
    this.diferencias.set(null);
    this.errorGeneral.set('');
    this.limpiarUrlsPdf();
    this.estadoPeriodo.set('DISPONIBLE');
  }
  esMovimientoEliminado(tipoMovimiento: string): boolean {
    const valor = tipoMovimiento?.toUpperCase() ?? '';
    return valor === 'ELIMINADO' || valor === 'BAJA';
  }

  esMovimientoModificado(tipoMovimiento: string): boolean {
    return (tipoMovimiento?.toUpperCase() ?? '') === 'MODIFICADO';
  }

  private prepararRevisionDiferencias(codigoReferencia: string): void {
    if (this.cargandoDiferencias()) {
      return;
    }

    if (!codigoReferencia?.trim()) {
      this.errorGeneral.set(
        'No fue posible identificar el código de referencia de la actualización.',
      );
      return;
    }

    const estadoAnterior = this.estadoPeriodo();

    /*
    Si viene directamente de la validación, no podemos regresar a VALIDANDO
    en caso de error porque el loading permanecería activo.
  */
    const estadoRetorno: EstadoPeriodo =
      estadoAnterior === 'VALIDANDO' ? 'DISPONIBLE' : estadoAnterior;

    this.cargandoDiferencias.set(true);
    this.errorGeneral.set('');
    this.diferencias.set(null);

    this.actualizacionService
      .obtenerDiferencias(codigoReferencia, 100)
      .pipe(
        finalize(() => {
          this.cargandoDiferencias.set(false);
        }),
      )
      .subscribe({
        next: (response: ActualizacionDiferenciasResponse) => {
          if (!response.esValido) {
            this.estadoPeriodo.set(estadoRetorno);

            this.errorGeneral.set(
              response.mensaje || 'No fue posible obtener las diferencias de la actualización.',
            );

            return;
          }

          this.diferencias.set(response);
          this.estadoPeriodo.set('MOSTRANDO_DIFERENCIAS');
        },
        error: (error: unknown) => {
          this.estadoPeriodo.set(estadoRetorno);

          this.errorGeneral.set(
            obtenerMensajeErrorHttp(
              error,
              'La consulta de diferencias tardó demasiado o fue interrumpida.',
            ) || 'No fue posible consultar las diferencias de la actualización.',
          );
        },
      });
  }

  private abrirAcusePrevio(codigoReferencia: string): void {
    if (this.generandoAcusePrevio()) {
      return;
    }

    this.generandoAcusePrevio.set(true);
    this.errorGeneral.set('');

    this.actualizacionService
      .descargarAcusePrevio(codigoReferencia)
      .pipe(
        finalize(() => {
          this.generandoAcusePrevio.set(false);
        }),
      )
      .subscribe({
        next: (blob: Blob) => {
          this.reemplazarAcusePrevio(blob);
          this.estadoPeriodo.set('MOSTRANDO_ACUSE');
        },
        error: (error: unknown) => {
          this.estadoPeriodo.set('MOSTRANDO_DIFERENCIAS');

          this.errorGeneral.set(
            obtenerMensajeErrorHttp(
              error,
              'La validación fue correcta, pero no fue posible generar el informe previo.',
            ),
          );
        },
      });
  }

  private reemplazarAcusePrevio(blob: Blob): void {
    const pdf = crearSafeBlobUrl(blob, this.sanitizer, this.acusePrevioObjectUrl);

    this.acusePrevioObjectUrl = pdf.objectUrl;
    this.acusePrevioUrl.set(pdf.safeUrl);
  }

  private reemplazarAcuseConfirmado(blob: Blob): void {
    const pdf = crearSafeBlobUrl(blob, this.sanitizer, this.acuseConfirmadoObjectUrl);

    this.acuseConfirmadoObjectUrl = pdf.objectUrl;
    this.acuseConfirmadoUrl.set(pdf.safeUrl);
  }

  private limpiarUrlsPdf(): void {
    revocarObjectUrl(this.acusePrevioObjectUrl);
    revocarObjectUrl(this.acuseConfirmadoObjectUrl);

    this.acusePrevioObjectUrl = null;
    this.acuseConfirmadoObjectUrl = null;

    this.acusePrevioUrl.set(null);
    this.acuseConfirmadoUrl.set(null);
  }

  private limpiarArchivos(): void {
    this.archivos.set(crearArchivosCargaVacios());
    this.archivoArrastrado.set(null);
  }

  private reiniciarFormulario(): void {
    this.anioCorte.set('');
    this.mesCorte.set('');
    this.idEntidadFederativa.set('');
    this.limpiarArchivos();
    this.respuestaPeriodo.set(null);
    this.respuestaValidacion.set(null);
    this.diferencias.set(null);
    this.mensajePeriodo.set('');
    this.errorGeneral.set('');
  }

  private resumenPorArchivo(archivo: ArchivoCargaTipo): CargaValidacionResumenItem[] {
    return obtenerResumenPorArchivo(this.respuestaValidacion()?.resumenValidacion ?? [], archivo);
  }

  private cargarEntidadesFederativas(): void {
    this.cargandoEntidades.set(true);

    this.catalogosService.obtenerEntidadesFederativas().subscribe({
      next: (entidades) => {
        this.entidadesFederativas.set(entidades ?? []);
        this.cargandoEntidades.set(false);
      },
      error: (error) => {
        this.cargandoEntidades.set(false);

        mostrarError(
          'No fue posible cargar entidades federativas',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }
  private cargarPeriodosDisponibles(idEntidadFederativa?: number | null): void {
    this.cargandoAniosCorte.set(true);

    this.actualizacionService.obtenerPeriodosDisponibles(idEntidadFederativa).subscribe({
      next: (periodos) => {
        this.periodosDisponibles.set(periodos ?? []);
        this.cargandoAniosCorte.set(false);
      },
      error: (error: unknown) => {
        this.periodosDisponibles.set([]);
        this.cargandoAniosCorte.set(false);

        mostrarError(
          'No fue posible cargar los periodos disponibles',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }
}
