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
  SemanalCargaBloqueAdministracionItem,
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

type DireccionOrden = 'asc' | 'desc';
type ColumnaOrdenSemanal =
  | 'entidad'
  | 'usuario'
  | 'periodo'
  | 'operacion'
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
  idDelitoSeleccionado = signal<number | null>(null);

  diferenciasPorReferencia = signal<Record<string, ActualizacionDiferenciasResponse>>({});
  diferenciasDetalle = signal<ActualizacionDiferenciasResponse | null>(null);
  cargandoDiferenciasDetalle = signal(false);
  mostrarDiferenciasDetalle = signal(false);
  errorDiferenciasDetalle = signal('');
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
  acuseTitulo = signal('Informe previo de entrega de información preliminar');

  delitosPendientes = computed(() => {
    const delitos = new Map<number, string>();

    for (const carga of this.pendientes()) {
      if (carga.idDelito && carga.delito?.trim()) delitos.set(carga.idDelito, carga.delito.trim());
    }

    return Array.from(delitos, ([idDelito, delito]) => ({ idDelito, delito })).sort((a, b) =>
      a.delito.localeCompare(b.delito, 'es', { sensitivity: 'base' }),
    );
  });

  pendientesFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const idDelitoSeleccionado = this.idDelitoSeleccionado();
    const registros = this.pendientes().filter((carga) => {
      if (idDelitoSeleccionado && carga.idDelito !== idDelitoSeleccionado) return false;
      if (!texto) return true;

      return (
        carga.entidadFederativa.toLowerCase().includes(texto) ||
        carga.codigoReferencia.toLowerCase().includes(texto) ||
        carga.usuarioCarga.toLowerCase().includes(texto) ||
        (carga.delito ?? '').toLowerCase().includes(texto) ||
        this.tipoCargaTexto(carga.tipoCarga).toLowerCase().includes(texto) ||
        this.periodoTexto(carga).toLowerCase().includes(texto) ||
        this.coberturaTexto(carga).toLowerCase().includes(texto)
      );
    });

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
    this.diferenciasPorReferencia.set({});
    this.cargando.set(true);

    this.administracionService.obtenerPendientes().subscribe({
      next: (response) => {
        const registros = response.registros ?? [];

        this.pendientes.set(registros);

        const idDelitoSeleccionado = this.idDelitoSeleccionado();

        if (
          idDelitoSeleccionado &&
          !registros.some((registro) => registro.idDelito === idDelitoSeleccionado)
        ) {
          this.idDelitoSeleccionado.set(null);
        }

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
          'No fue posible consultar las operaciones preliminares pendientes',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  buscar(valor: string): void {
    this.busqueda.set(valor);
    this.paginaActual.set(1);
  }

  cambiarDelito(idDelito: number | null): void {
    this.idDelitoSeleccionado.set(idDelito);
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
        if (this.esActualizacion(response.detalle)) this.cargarResumenDiferencias(codigoReferencia);
        this.cdr.detectChanges();
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            document
              .getElementById('resolucion-carga-semanal')
              ?.scrollIntoView({ behavior: 'smooth', block: 'end' }),
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
          mostrarError(
            'Archivo vacío',
            'La API no devolvió los archivos de la operación preliminar.',
          );
          return;
        }

        const nombreArchivo =
          this.obtenerNombreArchivo(response.headers.get('content-disposition')) ||
          `ARCHIVOS_REVISION_PRELIMINAR_${carga.codigoReferencia}.zip`;

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
          mostrarError(
            'Informe vacío',
            'La API no devolvió el informe previo de la operación preliminar.',
          );
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
    const usuario = this.usuarioTexto(carga);
    const periodo = this.periodoTexto(carga);

    const confirmacion = await confirmarAccion(
      esActualizacion ? 'Aprobar actualización preliminar' : 'Aprobar carga preliminar',
      esActualizacion
        ? `Se reemplazará únicamente la información confirmada del usuario ${usuario} en ${carga.entidadFederativa}, correspondiente a ${periodo}.`
        : `Se incorporará la información del usuario ${usuario} en ${carga.entidadFederativa}, correspondiente a ${periodo}.`,
      esActualizacion ? 'Aprobar actualización' : 'Aprobar carga',
    );

    if (!confirmacion.isConfirmed) return;

    this.procesando.set(carga.codigoReferencia);

    Swal.fire({
      title: esActualizacion ? 'Aprobando actualización preliminar' : 'Aprobando carga preliminar',
      text: esActualizacion
        ? `Se está reemplazando únicamente la información confirmada del usuario ${usuario}. Espere un momento...`
        : `Se está incorporando la información del usuario ${usuario}. Espere un momento...`,
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
          esActualizacion ? 'Actualización preliminar aprobada' : 'Carga preliminar aprobada',
          response.mensaje ||
            (esActualizacion
              ? 'La información preliminar del usuario fue actualizada correctamente.'
              : 'La información preliminar del usuario fue incorporada correctamente.'),
        );

        this.cargarPendientes();
      },
      error: (error: unknown) => {
        this.procesando.set(null);
        Swal.close();

        mostrarError(
          esActualizacion
            ? 'No fue posible aprobar la actualización preliminar'
            : 'No fue posible aprobar la carga preliminar',
          obtenerMensajeErrorHttp(error, 'La operación pudo haber sido resuelta por otro usuario.'),
        );

        this.cargarPendientes();
      },
    });
  }

  async rechazar(carga: SemanalCargaPendienteAdministracionItem): Promise<void> {
    const esActualizacion = this.esActualizacion(carga);
    const resultado = await Swal.fire({
      icon: 'warning',
      title: esActualizacion ? 'Rechazar actualización preliminar' : 'Rechazar carga preliminar',
      text: `${carga.entidadFederativa} — ${this.usuarioTexto(carga)} — ${this.periodoTexto(carga)}`,
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
          esActualizacion ? 'Actualización preliminar rechazada' : 'Carga preliminar rechazada',
          response.mensaje ||
            `La ${esActualizacion ? 'actualización' : 'carga'} preliminar fue rechazada correctamente.`,
        );

        this.cargarPendientes();
      },
      error: (error: unknown) => {
        this.procesando.set(null);

        mostrarError(
          esActualizacion
            ? 'No fue posible rechazar la actualización preliminar'
            : 'No fue posible rechazar la carga preliminar',
          obtenerMensajeErrorHttp(error, 'La operación pudo haber sido resuelta por otro usuario.'),
        );

        this.cargarPendientes();
      },
    });
  }

  tipoContenidoTexto(tipoContenido: string): string {
    return tipoContenido === 'ACUMULADO_MES' ? 'Acumulado del mes' : 'Solo semana';
  }

  tipoCargaTexto(tipoCarga: string): string {
    return tipoCarga === 'ACTUALIZACION' ? 'Actualización' : 'Carga inicial';
  }

  esActualizacion(carga: SemanalCargaPendienteAdministracionItem): boolean {
    return carga.tipoCarga === 'ACTUALIZACION';
  }

  periodoTexto(carga: SemanalCargaPendienteAdministracionItem): string {
    return Array.from(
      new Map(
        this.bloquesCarga(carga).map((bloque) => {
          const fecha = new Date(bloque.anioCorte, bloque.mesCorte - 1, 1);

          const texto = new Intl.DateTimeFormat('es-MX', {
            month: 'long',
            year: 'numeric',
          }).format(fecha);

          return [
            `${bloque.anioCorte}-${bloque.mesCorte.toString().padStart(2, '0')}`,
            texto.charAt(0).toUpperCase() + texto.slice(1),
          ];
        }),
      ).values(),
    ).join(', ');
  }

  coberturaTexto(carga: SemanalCargaPendienteAdministracionItem): string {
    const bloques = this.bloquesCarga(carga);

    return `${this.fechaCorta(bloques[0].fechaInicioTramo)} al ${this.fechaCorta(
      bloques[bloques.length - 1].fechaFinTramo,
    )}`;
  }

  bloquesCarga(
    carga: SemanalCargaPendienteAdministracionItem,
  ): SemanalCargaBloqueAdministracionItem[] {
    const bloques = carga.bloques?.length
      ? [...carga.bloques]
      : [
          {
            idSemanalCarga: carga.idSemanalCarga,
            anioSemana: carga.anioSemana,
            numeroSemana: carga.numeroSemana,
            fechaInicioSemana: carga.fechaInicioSemana,
            fechaFinSemana: carga.fechaFinSemana,
            anioCorte: carga.anioCorte,
            mesCorte: carga.mesCorte,
            fechaInicioTramo: carga.fechaInicioTramo,
            fechaFinTramo: carga.fechaFinTramo,
            totalCarpetas: carga.totalCarpetasIncluidas,
            totalDelitos: carga.totalDelitosIncluidos,
            totalVictimas: carga.totalVictimasIncluidas,
            reemplazaInformacion: carga.tipoCarga === 'ACTUALIZACION',
          },
        ];

    return bloques.sort(
      (a, b) =>
        this.fechaOrden(a.fechaInicioSemana) - this.fechaOrden(b.fechaInicioSemana) ||
        a.anioCorte * 100 + a.mesCorte - (b.anioCorte * 100 + b.mesCorte),
    );
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
    return carga.usuarioCarga || '-';
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
      `Informe previo de ${this.esActualizacion(carga) ? 'actualización' : 'carga'} preliminar — ${carga.entidadFederativa} — ${this.usuarioTexto(carga)} — ${this.periodoTexto(carga)}`,
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
      case 'operacion':
        resultado = this.compararTexto(
          this.tipoCargaTexto(a.tipoCarga),
          this.tipoCargaTexto(b.tipoCarga),
        );
        break;
      case 'usuario':
        resultado = this.compararTexto(this.usuarioTexto(a), this.usuarioTexto(b));
        break;
      case 'periodo':
        resultado =
          Math.max(
            ...this.bloquesCarga(a).map((bloque) => bloque.anioCorte * 100 + bloque.mesCorte),
          ) -
          Math.max(
            ...this.bloquesCarga(b).map((bloque) => bloque.anioCorte * 100 + bloque.mesCorte),
          );
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

    private cargarResumenDiferencias(codigoReferencia: string): void {
    this.codigoDiferenciasDetalle = codigoReferencia;
    this.cargandoDiferenciasDetalle.set(true);
    this.errorDiferenciasDetalle.set('');

    this.semanalCargaService.obtenerDiferencias(codigoReferencia, 0).subscribe({
      next: (response) => {
        if (this.codigoDiferenciasDetalle !== codigoReferencia) return;

        this.cargandoDiferenciasDetalle.set(false);

        if (!response.esValido) {
          this.errorDiferenciasDetalle.set(
            response.mensaje || 'No fue posible consultar el resumen de diferencias.',
          );
          return;
        }

        this.diferenciasPorReferencia.update((actual) => ({
          ...actual,
          [codigoReferencia]: response,
        }));
      },
      error: (error: unknown) => {
        if (this.codigoDiferenciasDetalle !== codigoReferencia) return;

        this.cargandoDiferenciasDetalle.set(false);
        this.errorDiferenciasDetalle.set(
          obtenerMensajeErrorHttp(
            error,
            'No fue posible consultar el resumen de diferencias de la actualización preliminar.',
          ),
        );
      },
    });
  }

private cargarDiferenciasDetalle(codigoReferencia: string): void {
  this.codigoDiferenciasDetalle = codigoReferencia;
  this.cargandoDiferenciasDetalle.set(true);
  this.errorDiferenciasDetalle.set('');

  this.semanalCargaService.obtenerDiferencias(codigoReferencia, 100, true).subscribe({
    next: (response) => {
      if (this.codigoDiferenciasDetalle !== codigoReferencia) return;

      this.cargandoDiferenciasDetalle.set(false);

      if (!response.esValido) {
        this.errorDiferenciasDetalle.set(
          response.mensaje || 'No fue posible consultar las diferencias.',
        );
        return;
      }

      const resumen = this.diferenciasResumen(codigoReferencia);

      this.diferenciasDetalle.set({
        ...response,
        totalCarpetas: resumen?.totalCarpetas ?? response.totalCarpetas,
        totalDelitos: resumen?.totalDelitos ?? response.totalDelitos,
        totalVictimas: resumen?.totalVictimas ?? response.totalVictimas,
        totalDiferencias: resumen?.totalDiferencias ?? response.totalDiferencias,
        detalleLimitado: resumen?.detalleLimitado ?? response.detalleLimitado,
        resumenCarpetas: resumen?.resumenCarpetas ?? response.resumenCarpetas,
        resumenDelitos: resumen?.resumenDelitos ?? response.resumenDelitos,
        resumenVictimas: resumen?.resumenVictimas ?? response.resumenVictimas,
        resumenTotal: resumen?.resumenTotal ?? response.resumenTotal,
      });
    },
    error: (error: unknown) => {
      if (this.codigoDiferenciasDetalle !== codigoReferencia) return;

      this.cargandoDiferenciasDetalle.set(false);
      this.errorDiferenciasDetalle.set(
        obtenerMensajeErrorHttp(
          error,
          'No fue posible consultar las diferencias de la actualización preliminar.',
        ),
      );
    },
  });
}
}
