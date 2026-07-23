import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CargaValidacionError, CargaValidacionResumenItem } from '../../core/models/carga.models';
import {
  SemanalCargaPeriodoRequest,
  SemanalCargaValidacionResponse,
  TipoCargaSemanal,
  TipoContenidoSemanal,
  SemanalSemanaActualizacionResponse,
} from '../../core/models/semanal-carga.models';
import { SemanalCargaService } from '../../core/services/semanal-carga.service';
import { ArchivoCargaTipo, ArchivosCargaSeleccionados } from '../../core/types/archivo-carga.types';
import {
  actualizarArchivoSeleccionado,
  crearArchivosCargaVacios,
  obtenerArchivoDesdeEvento,
  obtenerResumenPorArchivo,
  tieneTresArchivosSeleccionados,
} from '../../core/utils/archivo-carga.utils';
import {
  mostrarError,
  mostrarExito,
  mostrarExitoInstitucional,
} from '../../core/utils/alert.utils';
import { obtenerErrorPayload, obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { crearSafeBlobUrl, revocarObjectUrl } from '../../core/utils/blob-url.utils';
import { catchError, finalize, map, of, switchMap } from 'rxjs';
import { ActualizacionDiferenciasResponse } from '../../core/models/actualizacion.models';

type EstadoCargaSemanal =
  | 'CAPTURA'
  | 'VALIDANDO'
  | 'RESULTADO'
  | 'MOSTRANDO_DIFERENCIAS'
  | 'MOSTRANDO_ACUSE'
  | 'CONFIRMANDO'
  | 'CONFIRMADO';

interface SemanalCargaFormulario {
  tipoContenido: TipoContenidoSemanal | '';
  semanaSeleccionada: string;
}

interface VistaTramoSemanal {
  anioSemana: number;
  numeroSemana: number;
  fechaInicioSemana: Date;
  fechaFinSemana: Date;
  fechaInicioTramo: Date;
  fechaFinTramo: Date;
  fechaInicioMesCorte: Date;
  mesCorte: number;
  anioCorte: number;
  semanaCortada: boolean;
}

@Component({
  selector: 'app-semanal-carga',
  imports: [FormsModule],
  templateUrl: './semanal-carga.html',
  styleUrls: [
    '../semanal-usuarios/semanal-usuarios.css',
    '../actualizacion/actualizacion.css',
    './semanal-carga.css',
  ],
})
export class SemanalCarga {
  private readonly semanalCargaService = inject(SemanalCargaService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  readonly tipoCarga =
    (this.activatedRoute.snapshot.data['tipoCarga'] as TipoCargaSemanal | undefined) ??
    'CARGA_INICIAL';
  readonly esActualizacion = this.tipoCarga === 'ACTUALIZACION';

  readonly meses = [
    { valor: 1, nombre: 'Enero' },
    { valor: 2, nombre: 'Febrero' },
    { valor: 3, nombre: 'Marzo' },
    { valor: 4, nombre: 'Abril' },
    { valor: 5, nombre: 'Mayo' },
    { valor: 6, nombre: 'Junio' },
    { valor: 7, nombre: 'Julio' },
    { valor: 8, nombre: 'Agosto' },
    { valor: 9, nombre: 'Septiembre' },
    { valor: 10, nombre: 'Octubre' },
    { valor: 11, nombre: 'Noviembre' },
    { valor: 12, nombre: 'Diciembre' },
  ];

  readonly tiposArchivo: ReadonlyArray<{
    tipo: ArchivoCargaTipo;
    nombre: string;
    icono: string;
    plantilla: string;
    recibidos: string;
    incluidos: string;
    excluidos: string;
  }> = [
    {
      tipo: 'carpetas',
      nombre: 'Carpetas',
      icono: 'fa-folder-open',
      plantilla: 'plantillas/carpetas.xlsx',
      recibidos: 'Recibidas',
      incluidos: 'Incluidas',
      excluidos: 'Excluidas',
    },
    {
      tipo: 'delitos',
      nombre: 'Delitos',
      icono: 'fa-scale-balanced',
      plantilla: 'plantillas/delitos.xlsx',
      recibidos: 'Recibidos',
      incluidos: 'Incluidos',
      excluidos: 'Excluidos',
    },
    {
      tipo: 'victimas',
      nombre: 'Víctimas',
      icono: 'fa-users',
      plantilla: 'plantillas/victimas.xlsx',
      recibidos: 'Recibidas',
      incluidos: 'Incluidas',
      excluidos: 'Excluidas',
    },
  ];

  archivos = signal<ArchivosCargaSeleccionados>(crearArchivosCargaVacios());
  formulario = signal<SemanalCargaFormulario>(this.crearFormularioInicial());
  estado = signal<EstadoCargaSemanal>('CAPTURA');
  respuesta = signal<SemanalCargaValidacionResponse | null>(null);
  diferencias = signal<ActualizacionDiferenciasResponse | null>(null);
  cargandoDiferencias = signal(false);
validandoSemanaActualizacion = signal(false);
semanaDisponibleActualizacion = signal(false);
errorSemanaActualizacion = signal('');
private solicitudValidacionSemana = 0;
  errorGeneral = signal('');

  cargandoAcusePrevio = signal(false);
  acusePrevioUrl = signal<SafeResourceUrl | null>(null);
  acuseConfirmadoUrl = signal<SafeResourceUrl | null>(null);

  private acusePrevioObjectUrl: string | null = null;
  private acuseConfirmadoObjectUrl: string | null = null;

  archivoArrastrado = signal<ArchivoCargaTipo | null>(null);
  private readonly fechaActual = new Date();
  readonly semanaMinima = this.obtenerSemanaInput(
    new Date(this.fechaActual.getFullYear(), this.fechaActual.getMonth(), 1),
  );
  readonly semanaMaxima = this.obtenerSemanaInput(this.fechaActual);

  tramoPrevisto = computed(() => this.calcularTramo(this.formulario()));
  periodoValido = computed(() => this.tramoPrevisto() !== null);

  periodoListoParaArchivos = computed(() => this.periodoValido() && (!this.esActualizacion || this.semanaDisponibleActualizacion()));

  puedeValidar = computed(
    () =>
      tieneTresArchivosSeleccionados(this.archivos()) &&
      this.periodoListoParaArchivos() &&
      this.estado() !== 'VALIDANDO' &&
      this.estado() !== 'CONFIRMANDO',
  );

  mostrandoResultado = computed(
    () =>
      this.estado() === 'RESULTADO' ||
      this.estado() === 'MOSTRANDO_DIFERENCIAS' ||
      this.estado() === 'MOSTRANDO_ACUSE' ||
      this.estado() === 'CONFIRMANDO' ||
      this.estado() === 'CONFIRMADO',
  );

  totalDiferenciasCarpetas = computed(() => this.diferencias()?.totalCarpetas ?? 0);
  totalDiferenciasDelitos = computed(() => this.diferencias()?.totalDelitos ?? 0);
  totalDiferenciasVictimas = computed(() => this.diferencias()?.totalVictimas ?? 0);
  totalDiferencias = computed(() => this.diferencias()?.totalDiferencias ?? 0);
  mostrarDiferencias = computed(
    () => this.estado() === 'MOSTRANDO_DIFERENCIAS' && !!this.diferencias(),
  );

  respuestaValida = computed(() => this.respuesta()?.esValido === true);

  errores = computed(() => this.respuesta()?.errores ?? []);
  advertencias = computed(() => this.respuesta()?.advertencias ?? []);

  detallesValidacion = computed<CargaValidacionError[]>(() => [
    ...this.errores(),
    ...this.advertencias(),
  ]);

actualizarCampo<K extends keyof SemanalCargaFormulario>(campo: K, valor: SemanalCargaFormulario[K]): void {
  this.formulario.update((actual) => ({ ...actual, [campo]: valor }));
  this.limpiarResultado();

  if (campo !== 'semanaSeleccionada') return;

  this.solicitudValidacionSemana++;
  this.archivos.set(crearArchivosCargaVacios());
  this.semanaDisponibleActualizacion.set(false);
  this.errorSemanaActualizacion.set('');

  const tramo = this.tramoPrevisto();

  if (this.esActualizacion && tramo) this.validarDisponibilidadSemana(tramo, this.solicitudValidacionSemana);
}

  seleccionarArchivo(event: Event, tipo: ArchivoCargaTipo): void {
    const archivo = obtenerArchivoDesdeEvento(event);

    this.archivos.set(actualizarArchivoSeleccionado(this.archivos(), tipo, archivo));

    this.limpiarResultado();
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
    this.limpiarResultado();
  }

  nombreArchivo(tipo: ArchivoCargaTipo): string {
    return this.archivos()[tipo]?.name ?? 'Ningún archivo seleccionado';
  }

  tamanioArchivo(tipo: ArchivoCargaTipo): string {
    const bytes = this.archivos()[tipo]?.size;

    if (bytes === undefined) return '';

    if (bytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  validarArchivos(): void {
    const archivos = this.archivos();
    const formulario = this.formulario();
    const tramo = this.tramoPrevisto();

    if (!tieneTresArchivosSeleccionados(archivos)) {
      this.errorGeneral.set('Debe seleccionar los archivos de carpetas, delitos y víctimas.');
      return;
    }

    if (!tramo || !formulario.tipoContenido) {
      this.errorGeneral.set('Seleccione el tipo de carga y un periodo válido antes de continuar.');
      return;
    }

    const periodo: SemanalCargaPeriodoRequest = {
      tipoCarga: this.tipoCarga,
      tipoContenido: formulario.tipoContenido,
      anioSemana: tramo.anioSemana,
      numeroSemana: tramo.numeroSemana,
      fechaInicioSemana: this.formatearFechaApi(tramo.fechaInicioSemana),
      mesCorte: tramo.mesCorte,
      anioCorte: tramo.anioCorte,
    };

    this.estado.set('VALIDANDO');
    this.respuesta.set(null);
    this.errorGeneral.set('');
    this.limpiarAcusePrevio();

    this.semanalCargaService.validarArchivos(archivos, periodo).subscribe({
      next: (response) => {
        this.respuesta.set(response);

        if (!response.esValido || !this.esActualizacion || response.advertencias.length > 0) {
          this.estado.set('RESULTADO');
          return;
        }

        this.prepararRevisionDiferencias(response.codigoReferencia);
      },
      error: (error: unknown) => {
        const response = obtenerErrorPayload<SemanalCargaValidacionResponse>(error);

        if (response?.errores || response?.resumenValidacion) {
          this.respuesta.set(response);
          this.estado.set('RESULTADO');
          return;
        }

        this.estado.set('CAPTURA');
        this.errorGeneral.set(
          obtenerMensajeErrorHttp(
            error,
            this.esActualizacion
              ? 'No fue posible validar la actualización semanal.'
              : 'No fue posible validar la carga semanal.',
          ),
        );
      },
    });
  }

  revisarDiferencias(): void {
    const codigoReferencia = this.respuesta()?.codigoReferencia?.trim();

    if (!this.esActualizacion || !this.respuestaValida() || !codigoReferencia) return;

    this.prepararRevisionDiferencias(codigoReferencia);
  }

  continuarAAcusePrevio(): void {
    const codigoReferencia = this.respuesta()?.codigoReferencia?.trim();

    if (!codigoReferencia) return;

    this.abrirAcusePrevio();
  }

  volverADiferencias(): void {
    if (this.diferencias()) this.estado.set('MOSTRANDO_DIFERENCIAS');
  }

  obtenerIdentificadoresDesdeBackend(
    campoIdentificador: string,
    identificadorFiscalia: string,
  ): string[] {
    const campos = campoIdentificador
      .split('+')
      .map((x) => x.trim().toUpperCase())
      .filter((x) => x.length > 0);
    const valores = identificadorFiscalia.split('|').map((x) => x.trim());

    if (campos.length === 0) return [identificadorFiscalia];

    return campos.map((campo, index) => `${campo}: ${valores[index] || '-'}`);
  }

  normalizarValorDiferencia(valor: string | null): string {
    return valor === null || valor === undefined || valor === '' ? 'Sin información' : valor;
  }

  normalizarTipoMovimiento(tipoMovimiento: string): string {
    const valor = tipoMovimiento?.toUpperCase() ?? '';

    if (valor === 'NUEVO') return 'Nuevo';
    if (valor === 'MODIFICADO') return 'Modificado';
    if (valor === 'ELIMINADO' || valor === 'BAJA') return 'Eliminado';

    return tipoMovimiento;
  }

  esMovimientoNuevo(tipoMovimiento: string): boolean {
    return (tipoMovimiento?.toUpperCase() ?? '') === 'NUEVO';
  }

  esMovimientoModificado(tipoMovimiento: string): boolean {
    return (tipoMovimiento?.toUpperCase() ?? '') === 'MODIFICADO';
  }

  esMovimientoEliminado(tipoMovimiento: string): boolean {
    const valor = tipoMovimiento?.toUpperCase() ?? '';
    return valor === 'ELIMINADO' || valor === 'BAJA';
  }

  abrirAcusePrevio(): void {
    const codigoReferencia = this.respuesta()?.codigoReferencia?.trim();

    if (
      !this.respuestaValida() ||
      !codigoReferencia ||
      this.cargandoAcusePrevio() ||
      this.estado() === 'CONFIRMANDO'
    ) {
      return;
    }

    this.cargandoAcusePrevio.set(true);

    this.semanalCargaService.descargarAcusePrevio(codigoReferencia).subscribe({
      next: (blob) => {
        this.reemplazarAcusePrevio(blob);
        this.estado.set('MOSTRANDO_ACUSE');
        this.cargandoAcusePrevio.set(false);
      },
      error: (error: unknown) => {
        this.estado.set('RESULTADO');
        this.cargandoAcusePrevio.set(false);

        mostrarError(
          'No fue posible generar el informe previo',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  confirmarCarga(aceptar: boolean): void {
    const response = this.respuesta();

    if (!response?.esValido || !response.codigoReferencia || this.estado() === 'CONFIRMANDO')
      return;

    const codigoReferencia = response.codigoReferencia;

    this.estado.set('CONFIRMANDO');

    this.semanalCargaService
      .confirmarCarga({
        codigoReferencia,
        aceptar,
      })
      .pipe(
        switchMap((resultado) => {
          if (!aceptar || resultado.estado === 'PENDIENTE_APROBACION') {
            return of({
              resultado,
              acuseDescargado: false,
              blob: null as Blob | null,
            });
          }

          return this.semanalCargaService.descargarAcuseConfirmado(codigoReferencia).pipe(
            map((blob: Blob) => ({
              resultado,
              acuseDescargado: true,
              blob,
            })),
            catchError(() =>
              of({
                resultado,
                acuseDescargado: false,
                blob: null as Blob | null,
              }),
            ),
          );
        }),
      )
      .subscribe({
        next: (confirmacion) => {
          if (!aceptar) {
            this.limpiarAcusePrevio();

            mostrarExitoInstitucional(
              this.esActualizacion ? 'Actualización semanal rechazada' : 'Carga semanal rechazada',
              confirmacion.resultado.mensaje,
            ).then(() => {
              this.reiniciarFormulario();
              void this.router.navigateByUrl('/semanal');
            });

            return;
          }

          if (confirmacion.resultado.estado === 'PENDIENTE_APROBACION') {
            this.limpiarAcusePrevio();

            mostrarExitoInstitucional(
              this.esActualizacion
                ? 'Actualización enviada a revisión'
                : 'Carga enviada a revisión',
              confirmacion.resultado.mensaje,
            ).then(() => {
              this.reiniciarFormulario();
              void this.router.navigateByUrl('/semanal');
            });

            return;
          }

          if (confirmacion.blob) this.reemplazarAcuseConfirmado(confirmacion.blob);

          this.estado.set('CONFIRMADO');

          mostrarExito(
            this.esActualizacion ? 'Actualización semanal confirmada' : 'Carga semanal confirmada',
            confirmacion.acuseDescargado
              ? undefined
              : `La ${this.esActualizacion ? 'actualización' : 'carga'} fue confirmada, pero no fue posible cargar el acuse confirmado.`,
          );
        },
        error: (error: unknown) => {
          this.estado.set('MOSTRANDO_ACUSE');

          mostrarError(
            aceptar
              ? `No fue posible confirmar la ${this.esActualizacion ? 'actualización' : 'carga'}`
              : `No fue posible rechazar la ${this.esActualizacion ? 'actualización' : 'carga'}`,
            obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
          );
        },
      });
  }

  cerrarProcesoConfirmado(): void {
    this.reiniciarFormulario();
    void this.router.navigateByUrl('/semanal');
  }

  volverACaptura(): void {
    if (this.estado() === 'CONFIRMANDO') return;

    this.archivos.set(crearArchivosCargaVacios());
    this.formulario.update((actual) => ({
      ...actual,
      semanaSeleccionada: '',
    }));
    this.respuesta.set(null);
    this.diferencias.set(null);
    this.errorGeneral.set('');
    this.archivoArrastrado.set(null);
    this.limpiarAcusePrevio();
    this.estado.set('CAPTURA');
    this.solicitudValidacionSemana++;
this.validandoSemanaActualizacion.set(false);
this.semanaDisponibleActualizacion.set(false);
this.errorSemanaActualizacion.set('');
  }

  reiniciarFormulario(): void {
    this.archivos.set(crearArchivosCargaVacios());
    this.formulario.set(this.crearFormularioInicial());
    this.respuesta.set(null);
    this.diferencias.set(null);
    this.errorGeneral.set('');
    this.archivoArrastrado.set(null);
    this.limpiarAcusePrevio();
    this.estado.set('CAPTURA');
    this.solicitudValidacionSemana++;
this.validandoSemanaActualizacion.set(false);
this.semanaDisponibleActualizacion.set(false);
this.errorSemanaActualizacion.set('');
  }

  totalRecibido(tipo: ArchivoCargaTipo): number {
    const response = this.respuesta();

    if (!response) return 0;

    if (tipo === 'carpetas') {
      return response.totalCarpetasIncluidas + response.totalCarpetasExcluidas;
    }

    if (tipo === 'delitos') {
      return response.totalDelitosIncluidos + response.totalDelitosExcluidos;
    }

    return response.totalVictimasIncluidas + response.totalVictimasExcluidas;
  }

  totalIncluido(tipo: ArchivoCargaTipo): number {
    const response = this.respuesta();

    if (!response) return 0;

    if (tipo === 'carpetas') {
      return response.totalCarpetasIncluidas;
    }

    if (tipo === 'delitos') {
      return response.totalDelitosIncluidos;
    }

    return response.totalVictimasIncluidas;
  }

  totalExcluido(tipo: ArchivoCargaTipo): number {
    const response = this.respuesta();

    if (!response) return 0;

    if (tipo === 'carpetas') {
      return response.totalCarpetasExcluidas;
    }

    if (tipo === 'delitos') {
      return response.totalDelitosExcluidos;
    }

    return response.totalVictimasExcluidas;
  }

  formatearFecha(valor: string | Date | null | undefined): string {
    if (!valor) return '-';

    const fecha = valor instanceof Date ? valor : this.convertirFecha(valor);

    return fecha
      ? new Intl.DateTimeFormat('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(fecha)
      : '-';
  }

  etiquetaTipoContenido(tipo: TipoContenidoSemanal | undefined): string {
    return tipo === 'SOLO_SEMANA' ? 'Solo semana' : '-';
  }

  nombreMes(numero: number | undefined): string {
    return this.meses.find((mes) => mes.valor === numero)?.nombre ?? '-';
  }

  esErrorDetalle(detalle: CargaValidacionError): boolean {
    return this.errores().includes(detalle);
  }

  resumenPorArchivo(tipo: ArchivoCargaTipo): CargaValidacionResumenItem[] {
    return obtenerResumenPorArchivo(this.respuesta()?.resumenValidacion ?? [], tipo);
  }

  private validarDisponibilidadSemana(tramo: VistaTramoSemanal, solicitud: number): void {
  this.validandoSemanaActualizacion.set(true);

  this.semanalCargaService
    .validarSemanaActualizacion(tramo.anioSemana, tramo.numeroSemana)
    .pipe(finalize(() => {
      if (solicitud === this.solicitudValidacionSemana) this.validandoSemanaActualizacion.set(false);
    }))
    .subscribe({
      next: (response: SemanalSemanaActualizacionResponse) => {
        if (solicitud !== this.solicitudValidacionSemana) return;

        this.semanaDisponibleActualizacion.set(response.disponible);

        if (response.disponible) return;

        const referencia = response.codigoReferenciaPendiente ? ` Referencia: ${response.codigoReferenciaPendiente}.` : '';
        this.errorSemanaActualizacion.set(`${response.mensaje}${referencia}`);
      },
      error: (error: unknown) => {
        if (solicitud !== this.solicitudValidacionSemana) return;

        this.semanaDisponibleActualizacion.set(false);
        this.errorSemanaActualizacion.set(obtenerMensajeErrorHttp(error, 'No fue posible comprobar si la semana está disponible para actualización.'));
      },
    });
}

  private prepararRevisionDiferencias(codigoReferencia: string): void {
    if (this.cargandoDiferencias() || !codigoReferencia?.trim()) return;

    this.cargandoDiferencias.set(true);
    this.errorGeneral.set('');
    this.diferencias.set(null);

    this.semanalCargaService
      .obtenerDiferencias(codigoReferencia, 100)
      .pipe(finalize(() => this.cargandoDiferencias.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.esValido) {
            this.estado.set('RESULTADO');
            this.errorGeneral.set(
              response.mensaje ||
                'No fue posible obtener las diferencias de la actualización semanal.',
            );
            return;
          }

          this.diferencias.set(response);
          this.estado.set('MOSTRANDO_DIFERENCIAS');
        },
        error: (error: unknown) => {
          this.estado.set('RESULTADO');
          this.errorGeneral.set(
            obtenerMensajeErrorHttp(
              error,
              'La consulta de diferencias tardó demasiado o fue interrumpida.',
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

  private limpiarAcusePrevio(): void {
    revocarObjectUrl(this.acusePrevioObjectUrl);
    revocarObjectUrl(this.acuseConfirmadoObjectUrl);

    this.acusePrevioObjectUrl = null;
    this.acuseConfirmadoObjectUrl = null;
    this.acusePrevioUrl.set(null);
    this.acuseConfirmadoUrl.set(null);
    this.cargandoAcusePrevio.set(false);
  }

  private limpiarResultado(): void {
    if (
      this.estado() === 'VALIDANDO' ||
      this.estado() === 'MOSTRANDO_ACUSE' ||
      this.estado() === 'CONFIRMANDO' ||
      this.estado() === 'CONFIRMADO'
    ) {
      return;
    }

    this.respuesta.set(null);
    this.diferencias.set(null);
    this.errorGeneral.set('');
    this.limpiarAcusePrevio();
    this.estado.set('CAPTURA');
  }

  private crearFormularioInicial(): SemanalCargaFormulario {
    return {
      tipoContenido: 'SOLO_SEMANA',
      semanaSeleccionada: '',
    };
  }

  private calcularTramo(formulario: SemanalCargaFormulario): VistaTramoSemanal | null {
    if (!formulario.tipoContenido) {
      return null;
    }
    const coincidencia = /^(\d{4})-W(\d{2})$/.exec(formulario.semanaSeleccionada);

    if (
      !coincidencia ||
      formulario.semanaSeleccionada < this.semanaMinima ||
      formulario.semanaSeleccionada > this.semanaMaxima
    )
      return null;

    const anioSemana = Number(coincidencia[1]);
    const numeroSemana = Number(coincidencia[2]);

    if (anioSemana < 2000 || anioSemana > 2100 || numeroSemana < 1 || numeroSemana > 53) {
      return null;
    }

    const fechaInicioSemana = this.obtenerInicioSemanaIso(anioSemana, numeroSemana);

    if (
      !fechaInicioSemana ||
      fechaInicioSemana < new Date(2000, 0, 1) ||
      fechaInicioSemana > new Date(2100, 11, 25)
    ) {
      return null;
    }

    const fechaFinSemana = this.sumarDias(fechaInicioSemana, 6);
    const mesCorte = fechaFinSemana.getMonth() + 1;
    const anioCorte = fechaFinSemana.getFullYear();

    const fechaInicioMes = new Date(anioCorte, mesCorte - 1, 1);
    const fechaFinMes = new Date(anioCorte, mesCorte, 0);

    const fechaInicioTramo =
      fechaInicioSemana > fechaInicioMes ? fechaInicioSemana : fechaInicioMes;

    const fechaFinTramo = fechaFinSemana < fechaFinMes ? fechaFinSemana : fechaFinMes;

    return {
      anioSemana,
      numeroSemana,
      fechaInicioSemana,
      fechaFinSemana,
      fechaInicioTramo,
      fechaFinTramo,
      fechaInicioMesCorte: fechaInicioMes,
      mesCorte,
      anioCorte,
      semanaCortada:
        fechaInicioSemana.getMonth() !== fechaFinSemana.getMonth() ||
        fechaInicioSemana.getFullYear() !== fechaFinSemana.getFullYear(),
    };
  }

  private obtenerInicioSemanaIso(anioSemana: number, numeroSemana: number): Date | null {
    const cuatroDeEnero = new Date(Date.UTC(anioSemana, 0, 4));

    const diaSemana = cuatroDeEnero.getUTCDay() || 7;

    cuatroDeEnero.setUTCDate(cuatroDeEnero.getUTCDate() - diaSemana + 1 + (numeroSemana - 1) * 7);

    const fechaInicio = new Date(
      cuatroDeEnero.getUTCFullYear(),
      cuatroDeEnero.getUTCMonth(),
      cuatroDeEnero.getUTCDate(),
    );

    const semanaCalculada = this.obtenerSemanaIso(fechaInicio);

    return semanaCalculada.anio === anioSemana && semanaCalculada.numero === numeroSemana
      ? fechaInicio
      : null;
  }

  private obtenerSemanaIso(fecha: Date): { anio: number; numero: number } {
    const fechaUtc = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));

    const diaSemana = fechaUtc.getUTCDay() || 7;

    fechaUtc.setUTCDate(fechaUtc.getUTCDate() + 4 - diaSemana);

    const anio = fechaUtc.getUTCFullYear();
    const inicioAnio = new Date(Date.UTC(anio, 0, 1));

    const numero = Math.ceil(((fechaUtc.getTime() - inicioAnio.getTime()) / 86400000 + 1) / 7);

    return { anio, numero };
  }

  private obtenerSemanaInput(fecha: Date): string {
    const semana = this.obtenerSemanaIso(fecha);

    return `${semana.anio}-W${String(semana.numero).padStart(2, '0')}`;
  }

  private formatearFechaApi(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
  }

  private convertirFecha(valor: string): Date | null {
    const fechaBase = valor.slice(0, 10);
    const partes = fechaBase.split('-').map((parte) => Number(parte));

    if (partes.length !== 3 || partes.some((parte) => !Number.isInteger(parte))) {
      return null;
    }

    const [anio, mes, dia] = partes;
    const fecha = new Date(anio, mes - 1, dia);

    if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
      return null;
    }

    return fecha;
  }

  private sumarDias(fecha: Date, dias: number): Date {
    const resultado = new Date(fecha);
    resultado.setDate(resultado.getDate() + dias);
    return resultado;
  }
}
