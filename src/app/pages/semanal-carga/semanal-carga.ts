import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CargaValidacionError,
  CargaValidacionResumenItem,
  ConfirmarCargaResponse,
} from '../../core/models/carga.models';
import {
  SemanalCargaPeriodoRequest,
  SemanalCargaValidacionResponse,
  TipoCargaSemanal,
  TipoContenidoSemanal,
  SemanalSemanaDisponibilidadResponse,
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
import { mostrarError, mostrarExitoInstitucional, mostrarAdvertencia } from '../../core/utils/alert.utils';
import { obtenerErrorPayload, obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { finalize } from 'rxjs';
import { ActualizacionDiferenciasResponse } from '../../core/models/actualizacion.models';
import { CatalogosService } from '../../core/services/catalogos.service';
import { EntidadFederativaCatalogoItem } from '../../core/models/catalogos.models';
import { SessionService } from '../../core/services/session.service';
import { ROLES } from '../../core/constants/roles.constants';

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
  styleUrls: ['../actualizacion/actualizacion.css', './semanal-carga.css'],
})
export class SemanalCarga implements OnInit {
  private readonly semanalCargaService = inject(SemanalCargaService);
  private readonly sessionService = inject(SessionService);
  private readonly catalogosService = inject(CatalogosService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  get tipoCarga(): TipoCargaSemanal {
    return (
      this.respuesta()?.tipoCarga ?? this.estadoSemana()?.tipoCargaPendiente ?? 'CARGA_INICIAL'
    );
  }

  get esActualizacion(): boolean {
    return this.tipoCarga === 'ACTUALIZACION';
  }

  readonly usuario = this.sessionService.usuario;
  readonly esSuperUsuario = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);
  readonly mostrarSelectorEntidad = computed(() => false);

  idEntidadFederativa = signal('');
  entidadesFederativas = signal<EntidadFederativaCatalogoItem[]>([]);
  cargandoEntidades = signal(false);

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
  resultadoConfirmacion = signal<ConfirmarCargaResponse | null>(null);
  diferencias = signal<ActualizacionDiferenciasResponse | null>(null);
  cargandoDiferencias = signal(false);
  validandoSemana = signal(false);
  estadoSemana = signal<SemanalSemanaDisponibilidadResponse | null>(null);
  errorSemana = signal('');
  private solicitudValidacionSemana = 0;
  errorGeneral = signal('');

  soloConsultaPendiente = signal(false);
  usuarioPendiente = signal('');
  private anioCortePendienteConsulta = signal<number | null>(null);
  private mesCortePendienteConsulta = signal<number | null>(null);

  cargandoAcusePrevio = signal(false);
  acusePrevioUrl = signal<SafeResourceUrl | null>(null);

  archivoArrastrado = signal<ArchivoCargaTipo | null>(null);
  private readonly fechaActual = new Date();
  readonly semanaMinima = this.obtenerSemanaInput(
    new Date(this.fechaActual.getFullYear(), this.fechaActual.getMonth(), 1),
  );
  readonly semanaMaxima = this.obtenerSemanaInput(this.fechaActual);

  tramoPrevisto = computed(() => this.calcularTramo(this.formulario()));
  periodoValido = computed(() => this.tramoPrevisto() !== null);

  periodoListoParaArchivos = computed(() => this.periodoValido());

  codigoReferenciaOperacion = computed(
    () =>
      this.estadoSemana()?.codigoReferenciaPendiente?.trim() ||
      this.respuesta()?.codigoReferencia?.trim() ||
      '',
  );
  puedeResolverPendiente = computed(() => this.estadoSemana()?.puedeResolverPendiente === true);
  debeUsarActualizacion = computed(
    () => !this.esActualizacion && this.estadoSemana()?.debeUsarActualizacion === true,
  );

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

  ngOnInit(): void {
    const codigoReferencia = this.activatedRoute.snapshot.queryParamMap.get('resolver')?.trim();

    if (!codigoReferencia) return;

    const tipoCargaPendiente: TipoCargaSemanal =
      this.activatedRoute.snapshot.queryParamMap.get('tipoCarga') === 'ACTUALIZACION'
        ? 'ACTUALIZACION'
        : 'CARGA_INICIAL';
    const esActualizacionPendiente = tipoCargaPendiente === 'ACTUALIZACION';
    const soloConsulta = this.esSuperUsuario();
    const usuarioPendiente =
      this.activatedRoute.snapshot.queryParamMap.get('usuario')?.trim() ?? '';
    const anioTexto = this.activatedRoute.snapshot.queryParamMap.get('anioCorte');
    const mesTexto = this.activatedRoute.snapshot.queryParamMap.get('mesCorte');
    const anioCorte = anioTexto ? Number(anioTexto) : NaN;
    const mesCorte = mesTexto ? Number(mesTexto) : NaN;

    this.soloConsultaPendiente.set(soloConsulta);
    this.usuarioPendiente.set(usuarioPendiente);

    if (
      Number.isInteger(anioCorte) &&
      anioCorte >= 2000 &&
      anioCorte <= 2100 &&
      Number.isInteger(mesCorte) &&
      mesCorte >= 1 &&
      mesCorte <= 12
    ) {
      this.anioCortePendienteConsulta.set(anioCorte);
      this.mesCortePendienteConsulta.set(mesCorte);
    }

    this.estadoSemana.set({
      esValido: true,
      disponible: false,
      tieneCargaConfirmada: esActualizacionPendiente,
      existeOperacionPendiente: true,
      codigo: 'SEMANAL_PENDIENTE_DESDE_CONSULTA',
      mensaje: 'Operación preliminar pendiente seleccionada desde la consulta de envíos.',
      codigoReferenciaPendiente: codigoReferencia,
      estadoPendiente: esActualizacionPendiente
        ? 'VALIDADO_PENDIENTE_ACTUALIZACION'
        : 'VALIDADO_PENDIENTE',
      tipoCargaPendiente,
      pendientePropia: !soloConsulta,
      puedeResolverPendiente: !soloConsulta,
      debeUsarActualizacion: false,
    });

    queueMicrotask(() => this.resolverPendiente());
  }

  onEntidadChange(valor: string): void {
    this.idEntidadFederativa.set(valor);
    this.solicitudValidacionSemana++;
    this.validandoSemana.set(false);
    this.estadoSemana.set(null);
    this.errorSemana.set('');
    this.archivos.set(crearArchivosCargaVacios());
    this.formulario.update((actual) => ({ ...actual, semanaSeleccionada: '' }));
    this.limpiarResultado();
  }

  actualizarCampo<K extends keyof SemanalCargaFormulario>(
    campo: K,
    valor: SemanalCargaFormulario[K],
  ): void {
    this.formulario.update((actual) => ({ ...actual, [campo]: valor }));
    this.limpiarResultado();

    if (campo !== 'semanaSeleccionada') return;

    this.solicitudValidacionSemana++;
    this.validandoSemana.set(false);
    this.estadoSemana.set(null);
    this.errorSemana.set('');
    this.archivos.set(crearArchivosCargaVacios());

    const tramo = this.tramoPrevisto();

    if (this.mostrarSelectorEntidad() && !this.idEntidadFederativa()) return;
    if (tramo) this.validarDisponibilidadSemana(tramo, this.solicitudValidacionSemana);
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
      tipoCarga: 'CARGA_INICIAL',
      tipoContenido: formulario.tipoContenido,
      anioSemana: tramo.anioSemana,
      numeroSemana: tramo.numeroSemana,
      fechaInicioSemana: this.formatearFechaApi(tramo.fechaInicioSemana),
      mesCorte: tramo.mesCorte,
      anioCorte: tramo.anioCorte,
      idEntidadFederativa: null,
    };

    this.estado.set('VALIDANDO');
    this.respuesta.set(null);
    this.resultadoConfirmacion.set(null);
    this.errorGeneral.set('');
    this.limpiarAcusePrevio();

    this.semanalCargaService.validarArchivos(archivos, periodo).subscribe({
      next: async (response) => {
        this.respuesta.set(response);

        if (!response.esValido) {
          this.estado.set('RESULTADO');
          return;
        }

        if ((response.advertencias?.length ?? 0) > 0) {
          this.estado.set('RESULTADO');

          await mostrarAdvertencia(
            'Advertencias detectadas',
            'La validación terminó correctamente, pero contiene advertencias que no bloquean la carga. Revise el detalle y después elija Cancelar operación o Aceptar con advertencias.',
          );

          return;
        }

        if (response.tipoCarga === 'ACTUALIZACION') {
          this.prepararRevisionDiferencias(response.codigoReferencia);
          return;
        }

        this.abrirAcusePrevio(response.codigoReferencia);
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

  resolverPendiente(): void {
    const disponibilidad = this.estadoSemana();
    const codigoReferencia = this.codigoReferenciaOperacion();

    if (!disponibilidad?.existeOperacionPendiente || !codigoReferencia) return;

    if (this.soloConsultaPendiente()) {
      this.abrirAcusePrevio(codigoReferencia);
      return;
    }

    if (!disponibilidad.puedeResolverPendiente) return;

    if (disponibilidad.tipoCargaPendiente === 'ACTUALIZACION') {
      this.prepararRevisionDiferencias(codigoReferencia);
      return;
    }

    this.abrirAcusePrevio(codigoReferencia);
  }

  irAActualizacionSemanal(): void {
    void this.router.navigateByUrl('/semanal/carga');
  }

  revisarDiferencias(): void {
    const codigoReferencia = this.codigoReferenciaOperacion();

    if (!this.esActualizacion || !codigoReferencia) return;

    this.prepararRevisionDiferencias(codigoReferencia);
  }

  reintentarRevision(): void {
    if (this.esActualizacion) {
      this.revisarDiferencias();
      return;
    }

    this.abrirAcusePrevio();
  }

  continuarAAcusePrevio(): void {
    const codigoReferencia = this.codigoReferenciaOperacion();

    if (!codigoReferencia) return;

    this.abrirAcusePrevio(codigoReferencia);
  }

    continuarConAdvertencias(): void {
    const response = this.respuesta();
    const codigoReferencia = response?.codigoReferencia?.trim();

    if (!response?.esValido || (response.advertencias?.length ?? 0) === 0 || !codigoReferencia) return;

    if (response.tipoCarga === 'ACTUALIZACION') {
      this.prepararRevisionDiferencias(codigoReferencia);
      return;
    }

    this.abrirAcusePrevio(codigoReferencia);
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

  abrirAcusePrevio(codigoReferencia = this.codigoReferenciaOperacion()): void {
    if (!codigoReferencia || this.cargandoAcusePrevio() || this.estado() === 'CONFIRMANDO') return;

    const periodo = this.obtenerPeriodoAcuse();

    this.cargandoAcusePrevio.set(true);

    this.semanalCargaService
      .crearTicketAcuse(
        codigoReferencia,
        false,
        periodo?.anioCorte ?? null,
        periodo?.mesCorte ?? null,
      )
      .subscribe({
        next: (response) => {
          if (!response.ticket) {
            this.estado.set(this.respuesta() ? 'RESULTADO' : 'CAPTURA');
            this.cargandoAcusePrevio.set(false);

            mostrarError(
              'No fue posible generar el informe previo',
              'La API no devolvió un ticket para consultar el informe.',
            );

            return;
          }

          const url = this.semanalCargaService.obtenerUrlAcuseTicket(response.ticket);

          this.acusePrevioUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
          this.estado.set('MOSTRANDO_ACUSE');
          this.cargandoAcusePrevio.set(false);
        },
        error: (error: unknown) => {
          this.estado.set(this.respuesta() ? 'RESULTADO' : 'CAPTURA');
          this.cargandoAcusePrevio.set(false);

          mostrarError(
            'No fue posible generar el informe previo',
            obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
          );
        },
      });
  }

  confirmarCarga(aceptar: boolean): void {
    const codigoReferencia = this.codigoReferenciaOperacion();

    if (this.soloConsultaPendiente() || !codigoReferencia || this.estado() === 'CONFIRMANDO')
      return;

    const estadoAnterior = this.estado();

    this.estado.set('CONFIRMANDO');

    this.semanalCargaService.confirmarCarga({ codigoReferencia, aceptar }).subscribe({
      next: (resultado) => {
        if (!aceptar) {
          this.limpiarAcusePrevio();

          mostrarExitoInstitucional(
            this.esActualizacion ? 'Actualización semanal rechazada' : 'Carga semanal rechazada',
            resultado.mensaje,
          ).then(() => {
            this.reiniciarFormulario();
            void this.router.navigateByUrl('/semanal/carga');
          });

          return;
        }

        this.resultadoConfirmacion.set(resultado);
        this.limpiarAcusePrevio();
        this.estado.set('CONFIRMADO');
      },
      error: (error: unknown) => {
        this.estado.set(estadoAnterior);

        mostrarError(
          aceptar
            ? `No fue posible confirmar la ${this.esActualizacion ? 'actualización' : 'carga'}`
            : `No fue posible rechazar la ${this.esActualizacion ? 'actualización' : 'carga'}`,
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  salirConsultaPendiente(): void {
    if (!this.soloConsultaPendiente() || this.estado() === 'CONFIRMANDO') return;

    this.limpiarAcusePrevio();
    void this.router.navigateByUrl('/semanal/informes/envios');
  }

  cerrarProcesoConfirmado(): void {
    this.reiniciarFormulario();
    void this.router.navigateByUrl('/semanal');
  }

  volverACaptura(): void {
    if (this.estado() === 'CONFIRMANDO') return;

    this.archivos.set(crearArchivosCargaVacios());
    this.formulario.set(this.crearFormularioInicial());
    this.respuesta.set(null);
    this.resultadoConfirmacion.set(null);
    this.diferencias.set(null);
    this.errorGeneral.set('');
    this.archivoArrastrado.set(null);
    this.limpiarAcusePrevio();
    this.estado.set('CAPTURA');
    this.solicitudValidacionSemana++;
    this.validandoSemana.set(false);
    this.estadoSemana.set(null);
    this.errorSemana.set('');
  }

  reiniciarFormulario(): void {
    this.archivos.set(crearArchivosCargaVacios());
    this.formulario.set(this.crearFormularioInicial());
    this.respuesta.set(null);
    this.resultadoConfirmacion.set(null);
    this.diferencias.set(null);
    this.errorGeneral.set('');
    this.archivoArrastrado.set(null);
    this.limpiarAcusePrevio();
    this.estado.set('CAPTURA');
    this.solicitudValidacionSemana++;
    this.validandoSemana.set(false);
    this.estadoSemana.set(null);
    this.errorSemana.set('');
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
    if (tipo === 'ACUMULADO_MES') return 'Acumulado mensual';
    if (tipo === 'SOLO_SEMANA') return 'Solo semana';
    return '-';
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
    this.validandoSemana.set(true);

    this.semanalCargaService
      .validarSemana(
        this.tipoCarga,
        tramo.anioSemana,
        tramo.numeroSemana,
        this.mostrarSelectorEntidad() ? Number(this.idEntidadFederativa()) : null,
      )
      .pipe(
        finalize(() => {
          if (solicitud === this.solicitudValidacionSemana) this.validandoSemana.set(false);
        }),
      )
      .subscribe({
        next: (response: SemanalSemanaDisponibilidadResponse) => {
          if (solicitud !== this.solicitudValidacionSemana) return;

          this.estadoSemana.set(response);
          this.errorSemana.set('');
        },
        error: (error: unknown) => {
          if (solicitud !== this.solicitudValidacionSemana) return;

          const response = obtenerErrorPayload<SemanalSemanaDisponibilidadResponse>(error);

          this.estadoSemana.set(response ?? null);
          this.errorSemana.set(
            response?.mensaje ||
              obtenerMensajeErrorHttp(
                error,
                'No fue posible comprobar la disponibilidad de la semana.',
              ),
          );
        },
      });
  }

  private cargarEntidadesFederativas(): void {
    this.cargandoEntidades.set(true);
    this.errorSemana.set('');

    this.catalogosService
      .obtenerEntidadesFederativas()
      .pipe(finalize(() => this.cargandoEntidades.set(false)))
      .subscribe({
        next: (response) => this.entidadesFederativas.set(response),
        error: (error: unknown) =>
          this.errorSemana.set(
            obtenerMensajeErrorHttp(error, 'No fue posible cargar las entidades federativas.'),
          ),
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

  private limpiarAcusePrevio(): void {
    this.acusePrevioUrl.set(null);
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
    this.resultadoConfirmacion.set(null);
    this.diferencias.set(null);
    this.errorGeneral.set('');
    this.limpiarAcusePrevio();
    this.estado.set('CAPTURA');
  }

  private obtenerPeriodoAcuse(): { anioCorte: number; mesCorte: number } | null {
    const anioCorte = this.anioCortePendienteConsulta();
    const mesCorte = this.mesCortePendienteConsulta();

    if (anioCorte === null || mesCorte === null) return null;

    return {
      anioCorte,
      mesCorte,
    };
  }

  private crearFormularioInicial(): SemanalCargaFormulario {
    return {
      tipoContenido: 'ACUMULADO_MES',
      semanaSeleccionada: this.obtenerSemanaInput(new Date()),
    };
  }

  private calcularTramo(formulario: SemanalCargaFormulario): VistaTramoSemanal | null {
    if (formulario.tipoContenido !== 'ACUMULADO_MES') return null;

    const fechaActual = new Date();
    const semanaActual = this.obtenerSemanaIso(fechaActual);
    const fechaInicioSemana = this.obtenerInicioSemanaIso(semanaActual.anio, semanaActual.numero);

    if (!fechaInicioSemana) return null;

    const fechaFinSemana = this.sumarDias(fechaInicioSemana, 6);
    const fechaInicioMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);

    return {
      anioSemana: semanaActual.anio,
      numeroSemana: semanaActual.numero,
      fechaInicioSemana,
      fechaFinSemana,
      fechaInicioTramo: fechaInicioMes,
      fechaFinTramo: fechaActual,
      fechaInicioMesCorte: fechaInicioMes,
      mesCorte: fechaActual.getMonth() + 1,
      anioCorte: fechaActual.getFullYear(),
      semanaCortada:
        fechaInicioSemana.getMonth() !== fechaActual.getMonth() ||
        fechaInicioSemana.getFullYear() !== fechaActual.getFullYear(),
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
