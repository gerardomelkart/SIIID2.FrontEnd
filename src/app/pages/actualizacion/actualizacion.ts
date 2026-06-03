import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ROLES } from '../../core/constants/roles.constants';
import { crearSafeBlobUrl, revocarObjectUrl } from '../../core/utils/blob-url.utils';
import { obtenerErrorPayload, obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';
import { catchError, map, of, switchMap } from 'rxjs';

import {
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
export class Actualizacion {
  private readonly actualizacionService = inject(ActualizacionService);
  private readonly sessionService = inject(SessionService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);

  anioCorte = signal<string>('');
  mesCorte = signal<string>('');
  idEntidadFederativa = signal<string>('');

  estadoPeriodo = signal<EstadoPeriodo>('SIN_CONSULTAR');
  respuestaPeriodo = signal<ActualizacionPeriodoResponse | null>(null);
  respuestaValidacion = signal<CargaValidacionResponse | null>(null);
  diferencias = signal<ActualizacionDiferenciasResponse | null>(null);

  mensajePeriodo = signal('');
  errorGeneral = signal('');

  archivos = signal<ArchivosCargaSeleccionados>(crearArchivosCargaVacios());

  private acusePrevioObjectUrl: string | null = null;
  private acuseConfirmadoObjectUrl: string | null = null;

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
    return this.estadoPeriodo() === 'VALIDADO_ERROR' && !!this.respuestaValidacion();
  });

  resumenCarpetas = computed(() => this.resumenPorArchivo('carpetas'));
  resumenDelitos = computed(() => this.resumenPorArchivo('delitos'));
  resumenVictimas = computed(() => this.resumenPorArchivo('victimas'));

  errores = computed(() => this.respuestaValidacion()?.errores ?? []);
  codigoReferencia = computed(() => this.respuestaValidacion()?.codigoReferencia ?? '');

  codigoReferenciaPendiente = computed(() => {
    const textoErrores = this.errores()
      .map((error) => `${error.valor ?? ''} ${error.mensaje ?? ''}`)
      .join(' ');

    const textoPeriodo = this.mensajePeriodo() ?? '';

    const textoCompleto = `${textoPeriodo} ${textoErrores}`;

    const match = textoCompleto.match(/Código de referencia pendiente:\s*([a-zA-Z0-9-]+)/i);

    return match?.[1] ?? '';
  });

  hayActualizacionPendiente = computed(() => {
    return this.codigoReferenciaPendiente() !== '';
  });

  hayActualizacionPendienteEnPeriodo = computed(() => {
    return this.estadoPeriodo() === 'NO_DISPONIBLE' && this.codigoReferenciaPendiente() !== '';
  });

  codigoReferenciaOperacion = computed(() => {
    return this.codigoReferenciaPendiente() || this.codigoReferencia();
  });

  totalDiferenciasCarpetas = computed(() => this.diferencias()?.carpetas?.length ?? 0);
  totalDiferenciasDelitos = computed(() => this.diferencias()?.delitos?.length ?? 0);
  totalDiferenciasVictimas = computed(() => this.diferencias()?.victimas?.length ?? 0);

  totalDiferencias = computed(() => {
    return (
      this.totalDiferenciasCarpetas() +
      this.totalDiferenciasDelitos() +
      this.totalDiferenciasVictimas()
    );
  });

  mostrarDiferencias = computed(() => {
    return this.estadoPeriodo() === 'MOSTRANDO_DIFERENCIAS' && !!this.diferencias();
  });

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

  validarActualizacion(): void {
    const archivos = this.archivos();

    if (!tieneTresArchivosSeleccionados(archivos)) {
      this.errorGeneral.set('Debe seleccionar los tres archivos: expedientes, delitos y víctimas.');
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

  this.estadoPeriodo.set('CONFIRMANDO');

  this.actualizacionService
    .confirmarActualizacion({
      codigoReferencia,
      aceptar: true,
    })
    .pipe(
      switchMap(() =>
        this.actualizacionService.descargarAcuseConfirmado(codigoReferencia).pipe(
          map((blob: Blob) => ({ acuseDescargado: true, blob })),
          catchError(() => of({ acuseDescargado: false, blob: null as Blob | null }))
        )
      )
    )
    .subscribe({
      next: (resultado) => {
        if (resultado.blob) {
          this.reemplazarAcuseConfirmado(resultado.blob);
        }

        this.estadoPeriodo.set('CONFIRMADO');

        Swal.fire({
          icon: 'success',
          title: '¡Actualización completada!',
          text: resultado.acuseDescargado
            ? undefined
            : 'La actualización fue confirmada, pero no fue posible cargar el acuse confirmado.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#2f80d0',
        });
      },
      error: (error: unknown) => {
        this.estadoPeriodo.set('MOSTRANDO_DIFERENCIAS');

        Swal.fire({
          icon: 'error',
          title: 'No fue posible confirmar la actualización',
          text: obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
          confirmButtonColor: '#691C32',
        });
      },
    });
}

  rechazarActualizacion(): void {
    const codigoReferencia = this.codigoReferenciaOperacion();

    if (!codigoReferencia) {
      return;
    }

    this.estadoPeriodo.set('CONFIRMANDO');

    this.actualizacionService
      .confirmarActualizacion({
        codigoReferencia,
        aceptar: false,
      })
      .subscribe({
        next: () => {
          this.estadoPeriodo.set('RECHAZADO');
          this.limpiarUrlsPdf();

          Swal.fire({
            icon: 'success',
            title: 'Actualización rechazada',
            text: 'La actualización fue rechazada correctamente.',
            confirmButtonColor: '#691C32',
          }).then(() => {
            this.router.navigateByUrl('/');
          });
        },
        error: (error: unknown) => {
          this.estadoPeriodo.set('MOSTRANDO_DIFERENCIAS');

          Swal.fire({
            icon: 'error',
            title: 'No fue posible rechazar la actualización',
            text: obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
            confirmButtonColor: '#691C32',
          });
        },
      });
  }

  resolverActualizacionPendiente(): void {
    const codigoReferencia = this.codigoReferenciaPendiente();

    if (!codigoReferencia) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin referencia pendiente',
        text: 'No fue posible identificar el código de referencia pendiente.',
        confirmButtonColor: '#691C32',
      });

      return;
    }

    this.abrirAcusePrevio(codigoReferencia);
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
    this.actualizacionService.obtenerDiferencias(codigoReferencia).subscribe({
      next: (response: ActualizacionDiferenciasResponse) => {
        if (!response.esValido) {
          this.estadoPeriodo.set('DISPONIBLE');
          this.errorGeneral.set(
            response.mensaje || 'No fue posible obtener las diferencias de la actualización.',
          );
          return;
        }

        this.diferencias.set(response);
        this.estadoPeriodo.set('MOSTRANDO_DIFERENCIAS');
      },
      error: (error: unknown) => {
        this.estadoPeriodo.set('DISPONIBLE');
        this.errorGeneral.set(
          obtenerMensajeErrorHttp(error, 'Intente nuevamente.') ||
            'No fue posible consultar las diferencias de la actualización.',
        );
      },
    });
  }

  private abrirAcusePrevio(codigoReferencia: string): void {
    this.actualizacionService.descargarAcusePrevio(codigoReferencia).subscribe({
      next: (blob: Blob) => {
        this.reemplazarAcusePrevio(blob);
        this.estadoPeriodo.set('MOSTRANDO_ACUSE');
      },
      error: () => {
        this.estadoPeriodo.set('MOSTRANDO_DIFERENCIAS');
        this.errorGeneral.set(
          'La validación fue correcta, pero no fue posible generar el acuse previo.',
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
}
