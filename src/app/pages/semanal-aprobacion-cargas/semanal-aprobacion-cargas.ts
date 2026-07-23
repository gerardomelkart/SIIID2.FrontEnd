import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import Swal from 'sweetalert2';
import {
  SemanalCargaPendienteAdministracionDetalle,
  SemanalCargaPendienteAdministracionItem,
} from '../../core/models/semanal-administracion-cargas.models';
import { SemanalAdministracionCargasService } from '../../core/services/semanal-administracion-cargas.service';
import {
  confirmarAccion,
  mostrarError,
  mostrarExitoInstitucional,
} from '../../core/utils/alert.utils';
import { crearSafeBlobUrl, revocarObjectUrl } from '../../core/utils/blob-url.utils';
import {
  obtenerMensajeErrorHttp,
  obtenerMensajeErrorHttpAsync,
} from '../../core/utils/http-error.utils';
import {
  ActualizacionDiferenciaRegistro,
  ActualizacionDiferenciasResponse,
} from '../../core/models/actualizacion.models';
import { SemanalCargaService } from '../../core/services/semanal-carga.service';
import { catchError, forkJoin, map, of } from 'rxjs';

type DireccionOrden = 'asc' | 'desc';
type ColumnaOrdenSemanal =
  | 'entidad'
  | 'semana'
  | 'operacion'
  | 'tramo'
  | 'usuario'
  | 'fecha'
  | 'registros'
  | 'advertencias';

interface SeccionDiferenciasAdmin {
  clave: string;
  titulo: string;
  registros: ActualizacionDiferenciaRegistro[];
}

@Component({
  selector: 'app-semanal-aprobacion-cargas',
  imports: [FormsModule],
  templateUrl: './semanal-aprobacion-cargas.html',
  styleUrls: ['../aprobacion-cargas/aprobacion-cargas.css', './semanal-aprobacion-cargas.css'],
})
export class SemanalAprobacionCargas implements OnInit, OnDestroy {
  private readonly administracionService = inject(SemanalAdministracionCargasService);
  private readonly semanalCargaService = inject(SemanalCargaService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);
  private acuseObjectUrl: string | null = null;

  pendientes = signal<SemanalCargaPendienteAdministracionItem[]>([]);
  detalle = signal<SemanalCargaPendienteAdministracionDetalle | null>(null);
  busqueda = signal('');

  diferenciasPorReferencia = signal<Record<string, ActualizacionDiferenciasResponse>>({});
  diferenciasDetalle = signal<ActualizacionDiferenciasResponse | null>(null);
  cargandoDiferenciasDetalle = signal(false);
  mostrarDiferenciasDetalle = signal(false);
  errorDiferenciasDetalle = signal('');
  private solicitudResumenesDiferencias = 0;
  private codigoDiferenciasDetalle = '';

  columnaOrden = signal<ColumnaOrdenSemanal>('fecha');
  direccionOrden = signal<DireccionOrden>('desc');

  paginaActual = signal(1);
  readonly tamanioPagina = 10;

  cargando = signal(false);
  cargandoDetalle = signal<string | null>(null);
  descargandoArchivos = signal<string | null>(null);
  descargandoAcuse = signal<string | null>(null);
  procesando = signal<string | null>(null);

  acuseUrl = signal<SafeResourceUrl | null>(null);
  acuseTitulo = signal('Informe previo de entrega de información semanal');

  pendientesFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const registros = texto
      ? this.pendientes().filter(
          (carga) =>
            carga.entidadFederativa.toLowerCase().includes(texto) ||
            carga.codigoReferencia.toLowerCase().includes(texto) ||
            carga.usuarioCarga.toLowerCase().includes(texto) ||
            carga.nombreUsuarioCarga.toLowerCase().includes(texto) ||
            this.tipoCargaTexto(carga.tipoCarga).toLowerCase().includes(texto) ||
            this.semanaTexto(carga).toLowerCase().includes(texto) ||
            this.periodoCorteTexto(carga).toLowerCase().includes(texto),
        )
      : [...this.pendientes()];

    return registros.sort((a, b) => this.compararCargas(a, b));
  });

  totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.pendientesFiltrados().length / this.tamanioPagina)),
  );

  paginas = computed(() => Array.from({ length: this.totalPaginas() }, (_, indice) => indice + 1));

  pendientesPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanioPagina;
    return this.pendientesFiltrados().slice(inicio, inicio + this.tamanioPagina);
  });

  primerRegistroVisible = computed(() => {
    if (this.pendientesFiltrados().length === 0) return 0;
    return (this.paginaActual() - 1) * this.tamanioPagina + 1;
  });

  ultimoRegistroVisible = computed(() =>
    Math.min(this.paginaActual() * this.tamanioPagina, this.pendientesFiltrados().length),
  );

  hayOperacionEnCurso = computed(() => {
    return (
      this.cargandoDetalle() !== null ||
      this.cargandoDiferenciasDetalle() ||
      this.descargandoArchivos() !== null ||
      this.descargandoAcuse() !== null ||
      this.procesando() !== null
    );
  });

  seccionesDiferenciasDetalle = computed<SeccionDiferenciasAdmin[]>(() => {
    const diferencias = this.diferenciasDetalle();

    if (!diferencias) return [];

    return [
      { clave: 'carpetas', titulo: 'Carpetas', registros: diferencias.carpetas },
      { clave: 'delitos', titulo: 'Delitos', registros: diferencias.delitos },
      { clave: 'victimas', titulo: 'Víctimas', registros: diferencias.victimas },
    ];
  });

  ngOnInit(): void {
    this.cargarPendientes();
  }

  ngOnDestroy(): void {
    this.cerrarAcuse();
  }

  cargarPendientes(): void {
    this.solicitudResumenesDiferencias++;
    this.diferenciasPorReferencia.set({});
    this.cargando.set(true);

    this.administracionService.obtenerPendientes().subscribe({
      next: (response) => {
        const registros = response.registros ?? [];

        this.pendientes.set(registros);
        this.cargarResumenesDiferencias(registros);

        if (this.paginaActual() > this.totalPaginas()) {
          this.paginaActual.set(this.totalPaginas());
        }

        const seleccionada = this.detalle();

        if (
          seleccionada &&
          !registros.some((item) => item.idSemanalCarga === seleccionada.idSemanalCarga)
        ) {
          this.detalle.set(null);
          this.cerrarAcuse();
        }

        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);

        mostrarError(
          'No fue posible consultar las cargas semanales pendientes',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  buscar(valor: string): void {
    this.busqueda.set(valor);
    this.paginaActual.set(1);
  }

  ordenarPor(columna: ColumnaOrdenSemanal): void {
    if (this.columnaOrden() === columna)
      this.direccionOrden.update((direccion) => (direccion === 'asc' ? 'desc' : 'asc'));
    else {
      this.columnaOrden.set(columna);
      this.direccionOrden.set('asc');
    }

    this.paginaActual.set(1);
  }

  iconoOrden(columna: ColumnaOrdenSemanal): string {
    if (this.columnaOrden() !== columna) return 'fa-sort';
    return this.direccionOrden() === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  irPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) return;
    this.paginaActual.set(pagina);
  }

  verDetalle(codigoReferencia: string): void {
    this.cargandoDetalle.set(codigoReferencia);

    this.administracionService.obtenerDetalle(codigoReferencia).subscribe({
      next: (response) => {
        this.detalle.set(response.detalle);
        this.codigoDiferenciasDetalle = '';
        this.diferenciasDetalle.set(null);
        this.cargandoDiferenciasDetalle.set(false);
        this.mostrarDiferenciasDetalle.set(false);
        this.errorDiferenciasDetalle.set('');
        this.cargandoDetalle.set(null);
        this.cdr.detectChanges();
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            document
              .getElementById('detalle-carga-semanal')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          ),
        );
      },
      error: (error: unknown) => {
        this.cargandoDetalle.set(null);
        this.detalle.set(null);
        this.cerrarAcuse();

        mostrarError(
          'No fue posible consultar el detalle',
          obtenerMensajeErrorHttp(error, 'La carga pudo haber sido resuelta por otro usuario.'),
        );

        this.cargarPendientes();
      },
    });
  }

  cerrarDetalle(): void {
    this.detalle.set(null);
    this.cerrarAcuse();
    this.diferenciasDetalle.set(null);
    this.cargandoDiferenciasDetalle.set(false);
    this.mostrarDiferenciasDetalle.set(false);
    this.errorDiferenciasDetalle.set('');
    this.codigoDiferenciasDetalle = '';
  }

  descargarArchivos(carga: SemanalCargaPendienteAdministracionItem): void {
    this.descargandoArchivos.set(carga.codigoReferencia);

    this.administracionService.descargarArchivos(carga.codigoReferencia).subscribe({
      next: (response) => {
        this.descargandoArchivos.set(null);

        if (!response.body) {
          mostrarError('Archivo vacío', 'La API no devolvió los archivos de la carga semanal.');
          return;
        }

        const nombreArchivo =
          this.obtenerNombreArchivo(response.headers.get('content-disposition')) ||
          `ARCHIVOS_REVISION_SEMANAL_${carga.codigoReferencia}.zip`;

        this.descargarBlob(response.body, nombreArchivo);
      },
      error: async (error: unknown) => {
        this.descargandoArchivos.set(null);

        mostrarError(
          'No fue posible descargar los archivos',
          await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
        );
      },
    });
  }

  descargarAcuse(carga: SemanalCargaPendienteAdministracionItem): void {
    this.descargandoAcuse.set(carga.codigoReferencia);

    this.administracionService.descargarAcuse(carga.codigoReferencia).subscribe({
      next: (response) => {
        this.descargandoAcuse.set(null);

        if (!response.body) {
          mostrarError('Informe vacío', 'La API no devolvió el informe previo semanal.');
          return;
        }

        this.mostrarAcuse(response.body, carga);
      },
      error: async (error: unknown) => {
        this.descargandoAcuse.set(null);

        mostrarError(
          'No fue posible consultar el informe',
          await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
        );
      },
    });
  }

  async aprobar(carga: SemanalCargaPendienteAdministracionItem): Promise<void> {
    const esActualizacion = this.esActualizacion(carga);
    const confirmacion = await confirmarAccion(
      esActualizacion ? 'Aprobar actualización semanal' : 'Aprobar carga semanal',
      esActualizacion
        ? `Se reemplazará la versión confirmada de ${carga.entidadFederativa}, correspondiente a ${this.semanaTexto(carga)}.`
        : `Se incorporará definitivamente la información de ${carga.entidadFederativa}, correspondiente a ${this.semanaTexto(carga)}.`,
      esActualizacion ? 'Aprobar actualización' : 'Aprobar carga',
    );

    if (!confirmacion.isConfirmed) return;

    this.procesando.set(carga.codigoReferencia);

    Swal.fire({
      title: esActualizacion ? 'Aprobando actualización semanal' : 'Aprobando carga semanal',
      text: esActualizacion
        ? `Se está reemplazando la versión confirmada de ${carga.entidadFederativa}. Espere un momento...`
        : `Se está incorporando definitivamente la información de ${carga.entidadFederativa}. Espere un momento...`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    this.administracionService.aprobar(carga.codigoReferencia).subscribe({
      next: (response) => {
        this.procesando.set(null);
        this.detalle.set(null);
        this.mostrarDiferenciasDetalle.set(false);
        this.diferenciasDetalle.set(null);
        this.cerrarAcuse();
        Swal.close();

        mostrarExitoInstitucional(
          esActualizacion ? 'Actualización semanal aprobada' : 'Carga semanal aprobada',
          response.mensaje ||
            (esActualizacion
              ? 'La información semanal fue actualizada correctamente.'
              : 'La información semanal fue incorporada correctamente.'),
        );

        this.cargarPendientes();
      },
      error: (error: unknown) => {
        this.procesando.set(null);
        Swal.close();

        mostrarError(
          esActualizacion
            ? 'No fue posible aprobar la actualización semanal'
            : 'No fue posible aprobar la carga semanal',
          obtenerMensajeErrorHttp(error, 'La carga pudo haber sido resuelta por otro usuario.'),
        );

        this.cargarPendientes();
      },
    });
  }

  async rechazar(carga: SemanalCargaPendienteAdministracionItem): Promise<void> {
    const esActualizacion = this.esActualizacion(carga);
    const resultado = await Swal.fire({
      icon: 'warning',
      title: esActualizacion ? 'Rechazar actualización semanal' : 'Rechazar carga semanal',
      text: `${carga.entidadFederativa} — ${this.semanaTexto(carga)}`,
      input: 'textarea',
      inputLabel: 'Motivo del rechazo',
      inputPlaceholder: 'Describa las correcciones que debe realizar el enlace estatal...',
      inputAttributes: {
        maxlength: '2000',
        'aria-label': 'Motivo del rechazo',
      },
      showCancelButton: true,
      confirmButtonText: esActualizacion ? 'Rechazar actualización' : 'Rechazar carga',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#235B4E',
      inputValidator: (valor) => {
        const motivo = valor?.trim() ?? '';

        if (motivo.length < 5) return 'Capture un motivo de al menos 5 caracteres.';
        return undefined;
      },
    });

    const motivo = (resultado.value as string | undefined)?.trim() ?? '';

    if (!resultado.isConfirmed || !motivo) return;

    this.procesando.set(carga.codigoReferencia);

    this.administracionService.rechazar(carga.codigoReferencia, motivo).subscribe({
      next: (response) => {
        this.procesando.set(null);
        this.detalle.set(null);
        this.mostrarDiferenciasDetalle.set(false);
        this.diferenciasDetalle.set(null);
        this.cerrarAcuse();

        mostrarExitoInstitucional(
          esActualizacion ? 'Actualización semanal rechazada' : 'Carga semanal rechazada',
          response.mensaje ||
            `La ${esActualizacion ? 'actualización' : 'carga'} semanal fue rechazada correctamente.`,
        );

        this.cargarPendientes();
      },
      error: (error: unknown) => {
        this.procesando.set(null);

        mostrarError(
          esActualizacion
            ? 'No fue posible rechazar la actualización semanal'
            : 'No fue posible rechazar la carga semanal',
          obtenerMensajeErrorHttp(error, 'La carga pudo haber sido resuelta por otro usuario.'),
        );

        this.cargarPendientes();
      },
    });
  }

  tipoContenidoTexto(tipoContenido: string): string {
    return tipoContenido === 'ACUMULADO_MES' ? 'Acumulado mensual' : 'Solo semana';
  }

  tipoCargaTexto(tipoCarga: string): string {
    return tipoCarga === 'ACTUALIZACION' ? 'Actualización' : 'Carga inicial';
  }

  esActualizacion(carga: SemanalCargaPendienteAdministracionItem): boolean {
    return carga.tipoCarga === 'ACTUALIZACION';
  }

  semanaTexto(carga: SemanalCargaPendienteAdministracionItem): string {
    return `Semana ${carga.numeroSemana}/${carga.anioSemana}`;
  }

  rangoSemanaTexto(carga: SemanalCargaPendienteAdministracionItem): string {
    return `${this.fechaCorta(carga.fechaInicioSemana)} al ${this.fechaCorta(carga.fechaFinSemana)}`;
  }

  tramoTexto(carga: SemanalCargaPendienteAdministracionItem): string {
    return `${this.fechaCorta(carga.fechaInicioTramo)} al ${this.fechaCorta(carga.fechaFinTramo)}`;
  }

  periodoCorteTexto(carga: SemanalCargaPendienteAdministracionItem): string {
    const fecha = new Date(carga.anioCorte, carga.mesCorte - 1, 1);
    const texto = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(
      fecha,
    );
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  fechaCorta(fecha: string | null | undefined): string {
    if (!fecha) return '-';

    const valor = new Date(fecha);
    if (Number.isNaN(valor.getTime())) return '-';

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(valor);
  }

  fechaHoraTexto(fecha: string | null | undefined): string {
    if (!fecha) return '-';

    const valor = new Date(fecha);
    if (Number.isNaN(valor.getTime())) return '-';

    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(valor);
  }

  usuarioTexto(carga: SemanalCargaPendienteAdministracionItem): string {
    return carga.nombreUsuarioCarga || carga.usuarioCarga || '-';
  }

  archivoTexto(archivo: string): string {
    const texto = archivo.replaceAll('_', ' ').trim().toLowerCase();
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  tieneExcluidos(carga: SemanalCargaPendienteAdministracionItem): boolean {
    return (
      carga.totalCarpetasExcluidas > 0 ||
      carga.totalDelitosExcluidos > 0 ||
      carga.totalVictimasExcluidas > 0
    );
  }

  cerrarAcuse(): void {
    revocarObjectUrl(this.acuseObjectUrl);
    this.acuseObjectUrl = null;
    this.acuseUrl.set(null);
  }

  private mostrarAcuse(blob: Blob, carga: SemanalCargaPendienteAdministracionItem): void {
    const pdf = crearSafeBlobUrl(blob, this.sanitizer, this.acuseObjectUrl);

    this.acuseObjectUrl = pdf.objectUrl;
    this.acuseUrl.set(pdf.safeUrl);
    this.acuseTitulo.set(
      `Informe previo de ${this.esActualizacion(carga) ? 'actualización' : 'carga'} semanal — ${carga.entidadFederativa} — ${this.semanaTexto(carga)}`,
    );
  }

  private descargarBlob(blob: Blob, nombreArchivo: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = nombreArchivo;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  private obtenerNombreArchivo(contentDisposition: string | null): string {
    if (!contentDisposition) return '';

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

    const normalMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    return normalMatch?.[1] ?? '';
  }

  private compararCargas(
    a: SemanalCargaPendienteAdministracionItem,
    b: SemanalCargaPendienteAdministracionItem,
  ): number {
    let resultado = 0;

    switch (this.columnaOrden()) {
      case 'entidad':
        resultado = this.compararTexto(a.entidadFederativa, b.entidadFederativa);
        break;
      case 'semana':
        resultado = a.anioSemana * 100 + a.numeroSemana - (b.anioSemana * 100 + b.numeroSemana);
        break;
      case 'operacion':
        resultado = this.compararTexto(
          this.tipoCargaTexto(a.tipoCarga),
          this.tipoCargaTexto(b.tipoCarga),
        );
        break;
      case 'tramo':
        resultado = this.fechaOrden(a.fechaInicioTramo) - this.fechaOrden(b.fechaInicioTramo);
        break;
      case 'usuario':
        resultado = this.compararTexto(this.usuarioTexto(a), this.usuarioTexto(b));
        break;
      case 'fecha':
        resultado = this.fechaOrden(a.fechaValidacion) - this.fechaOrden(b.fechaValidacion);
        break;
      case 'registros':
        resultado =
          a.totalCarpetasIncluidas +
          a.totalDelitosIncluidos +
          a.totalVictimasIncluidas -
          (b.totalCarpetasIncluidas + b.totalDelitosIncluidos + b.totalVictimasIncluidas);
        break;
      case 'advertencias':
        resultado = a.totalAdvertencias - b.totalAdvertencias;
        break;
    }

    if (resultado === 0) resultado = a.idSemanalCarga - b.idSemanalCarga;
    return this.direccionOrden() === 'asc' ? resultado : -resultado;
  }

  private compararTexto(a: string, b: string): number {
    return (a ?? '').localeCompare(b ?? '', 'es', { sensitivity: 'base', numeric: true });
  }

  private fechaOrden(fecha: string): number {
    const valor = new Date(fecha).getTime();
    return Number.isNaN(valor) ? 0 : valor;
  }
  diferenciasResumen(codigoReferencia: string): ActualizacionDiferenciasResponse | null {
    return this.diferenciasPorReferencia()[codigoReferencia] ?? null;
  }

  diferenciasParaDetalle(codigoReferencia: string): ActualizacionDiferenciasResponse | null {
    return this.diferenciasDetalle() ?? this.diferenciasResumen(codigoReferencia);
  }

  alternarDiferenciasDetalle(codigoReferencia: string): void {
    if (this.mostrarDiferenciasDetalle()) {
      this.mostrarDiferenciasDetalle.set(false);
      return;
    }

    this.mostrarDiferenciasDetalle.set(true);

    if (this.diferenciasDetalle() || this.cargandoDiferenciasDetalle()) return;

    this.cargarDiferenciasDetalle(codigoReferencia);
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

  private cargarResumenesDiferencias(registros: SemanalCargaPendienteAdministracionItem[]): void {
    const solicitud = ++this.solicitudResumenesDiferencias;
    const actualizaciones = registros.filter((carga) => this.esActualizacion(carga));

    if (actualizaciones.length === 0) {
      this.diferenciasPorReferencia.set({});
      return;
    }

    forkJoin(
      actualizaciones.map((carga) =>
        this.semanalCargaService.obtenerDiferencias(carga.codigoReferencia, 1).pipe(
          map((response) => ({ codigoReferencia: carga.codigoReferencia, response })),
          catchError(() =>
            of({
              codigoReferencia: carga.codigoReferencia,
              response: null as ActualizacionDiferenciasResponse | null,
            }),
          ),
        ),
      ),
    ).subscribe((resultados) => {
      if (solicitud !== this.solicitudResumenesDiferencias) return;

      const mapa: Record<string, ActualizacionDiferenciasResponse> = {};

      for (const resultado of resultados) {
        if (resultado.response?.esValido) mapa[resultado.codigoReferencia] = resultado.response;
      }

      this.diferenciasPorReferencia.set(mapa);
    });
  }

  private cargarDiferenciasDetalle(codigoReferencia: string): void {
    this.codigoDiferenciasDetalle = codigoReferencia;
    this.cargandoDiferenciasDetalle.set(true);
    this.errorDiferenciasDetalle.set('');

    this.semanalCargaService.obtenerDiferencias(codigoReferencia, 100).subscribe({
      next: (response) => {
        if (this.codigoDiferenciasDetalle !== codigoReferencia) return;

        this.cargandoDiferenciasDetalle.set(false);

        if (!response.esValido) {
          this.errorDiferenciasDetalle.set(
            response.mensaje || 'No fue posible consultar las diferencias.',
          );
          return;
        }

        this.diferenciasDetalle.set(response);
      },
      error: (error: unknown) => {
        if (this.codigoDiferenciasDetalle !== codigoReferencia) return;

        this.cargandoDiferenciasDetalle.set(false);
        this.errorDiferenciasDetalle.set(
          obtenerMensajeErrorHttp(
            error,
            'No fue posible consultar las diferencias de la actualización semanal.',
          ),
        );
      },
    });
  }
}
