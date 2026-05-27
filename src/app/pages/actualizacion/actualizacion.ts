import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

import {
  ActualizacionDiferenciasResponse,
  ActualizacionPeriodoResponse
} from '../../core/models/actualizacion.models';

import {
  CargaValidacionResponse,
  CargaValidacionResumenItem
} from '../../core/models/carga.models';

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
  styleUrl: './actualizacion.css'
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

  carpetas = signal<File | null>(null);
  delitos = signal<File | null>(null);
  victimas = signal<File | null>(null);

  private acusePrevioObjectUrl: string | null = null;
  private acuseConfirmadoObjectUrl: string | null = null;

  acusePrevioUrl = signal<SafeResourceUrl | null>(null);
  acuseConfirmadoUrl = signal<SafeResourceUrl | null>(null);

  usuario = this.sessionService.usuario;

  esSuperUsuario = computed(() => {
    const rol = this.usuario()?.rol?.toLowerCase() ?? '';
    return rol.includes('super');
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
    return !!this.carpetas()
      && !!this.delitos()
      && !!this.victimas()
      && this.estadoPeriodo() === 'DISPONIBLE';
  });

  mostrarTablasErrores = computed(() => {
    return this.estadoPeriodo() === 'VALIDADO_ERROR' && !!this.respuestaValidacion();
  });

  resumenCarpetas = computed(() => this.resumenPorArchivo('carpetas'));
  resumenDelitos = computed(() => this.resumenPorArchivo('delitos'));
  resumenVictimas = computed(() => this.resumenPorArchivo('victimas'));

  errores = computed(() => this.respuestaValidacion()?.errores ?? []);
  codigoReferencia = computed(() => this.respuestaValidacion()?.codigoReferencia ?? '');

  totalDiferenciasCarpetas = computed(() => this.diferencias()?.carpetas?.length ?? 0);
  totalDiferenciasDelitos = computed(() => this.diferencias()?.delitos?.length ?? 0);
  totalDiferenciasVictimas = computed(() => this.diferencias()?.victimas?.length ?? 0);

  totalDiferencias = computed(() => {
    return this.totalDiferenciasCarpetas()
      + this.totalDiferenciasDelitos()
      + this.totalDiferenciasVictimas();
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

    const idEntidad = this.esSuperUsuario()
      ? Number(this.idEntidadFederativa())
      : null;

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
      error: (error: any) => {
        const response = error?.error as ActualizacionPeriodoResponse | undefined;

        if (response?.mensaje) {
          this.respuestaPeriodo.set(response);
          this.mensajePeriodo.set(response.mensaje);
          this.estadoPeriodo.set('NO_DISPONIBLE');
          return;
        }

        this.estadoPeriodo.set('ERROR');
        this.mensajePeriodo.set('No fue posible consultar el periodo seleccionado.');
      }
    });
  }

  seleccionarArchivo(event: Event, tipo: 'carpetas' | 'delitos' | 'victimas'): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;

    if (tipo === 'carpetas') {
      this.carpetas.set(archivo);
    }

    if (tipo === 'delitos') {
      this.delitos.set(archivo);
    }

    if (tipo === 'victimas') {
      this.victimas.set(archivo);
    }

    this.respuestaValidacion.set(null);
    this.diferencias.set(null);
    this.errorGeneral.set('');
  }

  validarActualizacion(): void {
    const carpetas = this.carpetas();
    const delitos = this.delitos();
    const victimas = this.victimas();

    if (!carpetas || !delitos || !victimas) {
      this.errorGeneral.set('Debe seleccionar los tres archivos: expedientes, delitos y víctimas.');
      return;
    }

    const mes = Number(this.mesCorte());
    const anio = Number(this.anioCorte());

    const idEntidad = this.esSuperUsuario()
      ? Number(this.idEntidadFederativa())
      : null;

    this.estadoPeriodo.set('VALIDANDO');
    this.errorGeneral.set('');
    this.respuestaValidacion.set(null);
    this.diferencias.set(null);
    this.limpiarUrlsPdf();

    this.actualizacionService.validarActualizacion(
      mes,
      anio,
      carpetas,
      delitos,
      victimas,
      idEntidad
    ).subscribe({
      next: (response: CargaValidacionResponse) => {
        this.respuestaValidacion.set(response);

        if (!response.esValido) {
          this.estadoPeriodo.set('VALIDADO_ERROR');
          return;
        }

        this.prepararRevisionDiferencias(response.codigoReferencia);
      },
      error: (error: any) => {
        const response = error?.error as CargaValidacionResponse | undefined;

        if (response?.resumenValidacion || response?.errores) {
          this.respuestaValidacion.set(response);
          this.estadoPeriodo.set('VALIDADO_ERROR');
          return;
        }

        this.estadoPeriodo.set('DISPONIBLE');
        this.errorGeneral.set(error?.error?.mensaje || 'No fue posible validar la actualización.');
      }
    });
  }

  verAcusePrevio(): void {
    const codigoReferencia = this.codigoReferencia();

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
    const codigoReferencia = this.codigoReferencia();

    if (!codigoReferencia) {
      return;
    }

    this.estadoPeriodo.set('CONFIRMANDO');

    this.actualizacionService.confirmarActualizacion({
      codigoReferencia,
      aceptar: true
    }).subscribe({
      next: () => {
        this.actualizacionService.descargarAcuseConfirmado(codigoReferencia).subscribe({
          next: (blob: Blob) => {
            this.reemplazarAcuseConfirmado(blob);
            this.estadoPeriodo.set('CONFIRMADO');

            Swal.fire({
              icon: 'success',
              title: '¡Actualización completada!',
              confirmButtonText: 'OK',
              confirmButtonColor: '#2f80d0'
            });
          },
          error: () => {
            this.estadoPeriodo.set('CONFIRMADO');

            Swal.fire({
              icon: 'success',
              title: '¡Actualización completada!',
              text: 'La actualización fue confirmada, pero no fue posible cargar el acuse confirmado.',
              confirmButtonText: 'OK',
              confirmButtonColor: '#2f80d0'
            });
          }
        });
      },
      error: (error: any) => {
        this.estadoPeriodo.set('MOSTRANDO_DIFERENCIAS');

        Swal.fire({
          icon: 'error',
          title: 'No fue posible confirmar la actualización',
          text: error?.error?.mensaje || 'Intente nuevamente.',
          confirmButtonColor: '#691C32'
        });
      }
    });
  }

  rechazarActualizacion(): void {
    const codigoReferencia = this.codigoReferencia();

    if (!codigoReferencia) {
      return;
    }

    this.estadoPeriodo.set('CONFIRMANDO');

    this.actualizacionService.confirmarActualizacion({
      codigoReferencia,
      aceptar: false
    }).subscribe({
      next: () => {
        this.estadoPeriodo.set('RECHAZADO');
        this.limpiarUrlsPdf();

        Swal.fire({
          icon: 'success',
          title: 'Actualización rechazada',
          text: 'La actualización fue rechazada correctamente.',
          confirmButtonColor: '#691C32'
        }).then(() => {
          this.router.navigateByUrl('/');
        });
      },
      error: (error: any) => {
        this.estadoPeriodo.set('MOSTRANDO_DIFERENCIAS');

        Swal.fire({
          icon: 'error',
          title: 'No fue posible rechazar la actualización',
          text: error?.error?.mensaje || 'Intente nuevamente.',
          confirmButtonColor: '#691C32'
        });
      }
    });
  }

  cerrarProcesoConfirmado(): void {
    this.limpiarUrlsPdf();
    this.reiniciarFormulario();
    this.estadoPeriodo.set('SIN_CONSULTAR');
    this.router.navigateByUrl('/');
  }

  private prepararRevisionDiferencias(codigoReferencia: string): void {
    this.actualizacionService.obtenerDiferencias(codigoReferencia).subscribe({
      next: (response: ActualizacionDiferenciasResponse) => {
        if (!response.esValido) {
          this.estadoPeriodo.set('DISPONIBLE');
          this.errorGeneral.set(response.mensaje || 'No fue posible obtener las diferencias de la actualización.');
          return;
        }

        this.diferencias.set(response);
        this.estadoPeriodo.set('MOSTRANDO_DIFERENCIAS');
      },
      error: (error: any) => {
        this.estadoPeriodo.set('DISPONIBLE');
        this.errorGeneral.set(error?.error?.mensaje || 'No fue posible consultar las diferencias de la actualización.');
      }
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
        this.errorGeneral.set('La validación fue correcta, pero no fue posible generar el acuse previo.');
      }
    });
  }

  private reemplazarAcusePrevio(blob: Blob): void {
    if (this.acusePrevioObjectUrl) {
      window.URL.revokeObjectURL(this.acusePrevioObjectUrl);
    }

    this.acusePrevioObjectUrl = window.URL.createObjectURL(blob);
    this.acusePrevioUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.acusePrevioObjectUrl));
  }

  private reemplazarAcuseConfirmado(blob: Blob): void {
    if (this.acuseConfirmadoObjectUrl) {
      window.URL.revokeObjectURL(this.acuseConfirmadoObjectUrl);
    }

    this.acuseConfirmadoObjectUrl = window.URL.createObjectURL(blob);
    this.acuseConfirmadoUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.acuseConfirmadoObjectUrl));
  }

  private limpiarUrlsPdf(): void {
    if (this.acusePrevioObjectUrl) {
      window.URL.revokeObjectURL(this.acusePrevioObjectUrl);
    }

    if (this.acuseConfirmadoObjectUrl) {
      window.URL.revokeObjectURL(this.acuseConfirmadoObjectUrl);
    }

    this.acusePrevioObjectUrl = null;
    this.acuseConfirmadoObjectUrl = null;

    this.acusePrevioUrl.set(null);
    this.acuseConfirmadoUrl.set(null);
  }

  private limpiarArchivos(): void {
    this.carpetas.set(null);
    this.delitos.set(null);
    this.victimas.set(null);
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

  private resumenPorArchivo(archivo: string): CargaValidacionResumenItem[] {
    return (this.respuestaValidacion()?.resumenValidacion ?? [])
      .filter((item: CargaValidacionResumenItem) => item.archivo?.toLowerCase() === archivo.toLowerCase());
  }
}