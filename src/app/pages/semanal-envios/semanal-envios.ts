import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ROLES } from '../../core/constants/roles.constants';
import { SemanalEnvioItem } from '../../core/models/semanal-envios.models';
import { SemanalEnviosService } from '../../core/services/semanal-envios.service';
import { SessionService } from '../../core/services/session.service';
import { SemanalCargaService } from '../../core/services/semanal-carga.service';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';
import { obtenerMensajeErrorHttpAsync } from '../../core/utils/http-error.utils';
import { mostrarAdvertencia, mostrarError } from '../../core/utils/alert.utils';
import {
  EstadoOrden,
  ValorOrden,
  alternarOrden,
  obtenerIconoOrden,
  ordenarPorEstado,
} from '../../core/utils/sort.utils';

interface PeriodoEnvio {
  clave: string;
  anioCorte: number;
  mesCorte: number;
  periodo: string;
}

interface UsuarioEnvio {
  idUsuarioCarga: number;
  usuarioCarga: string;
  nombreUsuarioCarga: string;
}

type CampoOrden = 'entidad' | 'clave' | 'fecha' | 'periodo' | 'usuario' | 'estado';

@Component({
  selector: 'app-semanal-envios',
  imports: [FormsModule],
  templateUrl: './semanal-envios.html',
  styleUrls: ['../informes/informes.css', './semanal-envios.css'],
})
export class SemanalEnvios implements OnInit, OnDestroy {
  private readonly semanalEnviosService = inject(SemanalEnviosService);
  private readonly semanalCargaService = inject(SemanalCargaService);
  private readonly sessionService = inject(SessionService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);

  usuario = this.sessionService.usuario;
  esSuperUsuario = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);

  envios = signal<SemanalEnvioItem[]>([]);
  cargando = signal(false);
  busqueda = signal('');

  periodosEnvio = signal<PeriodoEnvio[]>([]);
  periodoEnvioSeleccionado = signal('');
  idUsuarioSeleccionado = signal<number | null>(null);
  descargandoAcuses = signal(false);

  paginaActual = signal(1);
  tamanioPagina = 10;
  orden = signal<EstadoOrden<CampoOrden> | null>(null);

  descargandoAcuse = signal<string | null>(null);
  descargandoArchivos = signal<string | null>(null);
  exportandoExcel = signal(false);

  acuseUrl = signal<SafeResourceUrl | null>(null);
  acuseTitulo = signal('Informe preliminar');

  usuariosEnvio = computed<UsuarioEnvio[]>(() => {
    const mapa = new Map<number, UsuarioEnvio>();

    for (const envio of this.envios()) {
      if (!mapa.has(envio.idUsuarioCarga)) {
        mapa.set(envio.idUsuarioCarga, {
          idUsuarioCarga: envio.idUsuarioCarga,
          usuarioCarga: envio.usuarioCarga,
          nombreUsuarioCarga: envio.nombreUsuarioCarga,
        });
      }
    }

    return Array.from(mapa.values()).sort((a, b) =>
      a.usuarioCarga.localeCompare(b.usuarioCarga, 'es', { sensitivity: 'base' }),
    );
  });

  operacionEnCurso = computed(
    () =>
      this.descargandoAcuse() !== null ||
      this.descargandoArchivos() !== null ||
      this.descargandoAcuses() ||
      this.exportandoExcel(),
  );

  enviosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const periodoSeleccionado = this.periodoEnvioSeleccionado();
    const idUsuarioSeleccionado = this.idUsuarioSeleccionado();

    const registros = this.envios().filter((envio) => {
      if (periodoSeleccionado && !this.contienePeriodo(envio, periodoSeleccionado)) {
        return false;
      }

      if (idUsuarioSeleccionado && envio.idUsuarioCarga !== idUsuarioSeleccionado) {
        return false;
      }

      if (!texto) return true;

      return (
        envio.entidadFederativa.toLowerCase().includes(texto) ||
        envio.claveEntidad.toLowerCase().includes(texto) ||
        envio.fechaEnvioTexto.toLowerCase().includes(texto) ||
        this.periodoTexto(envio).toLowerCase().includes(texto) ||
        envio.usuarioCarga.toLowerCase().includes(texto) ||
        envio.codigoReferencia.toLowerCase().includes(texto) ||
        envio.tipoCarga.toLowerCase().includes(texto) ||
        envio.estado.toLowerCase().includes(texto) ||
        envio.estadoTexto.toLowerCase().includes(texto)
      );
    });

    return ordenarPorEstado(registros, this.orden(), (envio, campo) =>
      this.obtenerValorOrden(envio, campo),
    );
  });

  enviosPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanioPagina;
    return this.enviosFiltrados().slice(inicio, inicio + this.tamanioPagina);
  });

  totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.enviosFiltrados().length / this.tamanioPagina)),
  );

  ngOnInit(): void {
    this.cargarEnvios();
  }

  ngOnDestroy(): void {
    this.cerrarAcuse();
  }

  cargarEnvios(): void {
    this.cargando.set(true);

    this.semanalEnviosService.obtenerEnvios().subscribe({
      next: (response) => {
        const registros = response.registros ?? [];

        this.envios.set(registros);
        this.sincronizarPeriodosEnvio(registros);

        const usuarioSeleccionado = this.idUsuarioSeleccionado();

        if (
          usuarioSeleccionado &&
          !registros.some((registro) => registro.idUsuarioCarga === usuarioSeleccionado)
        ) {
          this.idUsuarioSeleccionado.set(null);
        }

        this.paginaActual.set(1);
        this.cargando.set(false);
      },
      error: async (error: unknown) => {
        this.cargando.set(false);

        mostrarError(
          'No fue posible consultar los envíos preliminares',
          await obtenerMensajeErrorHttpAsync(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  descargarAcusesPeriodo(): void {
    const periodo = this.periodoEnvioSeleccionado();
    const [anioTexto, mesTexto] = periodo.split('-');
    const anioCorte = Number(anioTexto);
    const mesCorte = Number(mesTexto);

    if (
      !Number.isInteger(anioCorte) ||
      !Number.isInteger(mesCorte) ||
      mesCorte < 1 ||
      mesCorte > 12
    ) {
      mostrarAdvertencia('Periodo inválido', 'Seleccione un periodo mensual válido.');
      return;
    }

    this.descargandoAcuses.set(true);

    this.semanalEnviosService
      .crearTicketDescargaAcuses(
        anioCorte,
        mesCorte,
        null,
        this.esSuperUsuario() ? this.idUsuarioSeleccionado() : null,
      )
      .subscribe({
        next: (response) => {
          if (!response.ticket) {
            this.descargandoAcuses.set(false);
            mostrarAdvertencia(
              'Descarga no disponible',
              'La API no devolvió un ticket de descarga.',
            );
            return;
          }

          const url = this.semanalEnviosService.obtenerUrlDescargaAcuses(response.ticket);
          const iframe = document.createElement('iframe');

          iframe.src = url;
          iframe.style.display = 'none';

          document.body.appendChild(iframe);
          this.descargandoAcuses.set(false);

          setTimeout(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
          }, 60000);
        },
        error: async (error: unknown) => {
          this.descargandoAcuses.set(false);

          mostrarError(
            'No fue posible descargar los acuses',
            await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
          );
        },
      });
  }

  buscarEnvios(valor: string): void {
    this.busqueda.set(valor);
    this.paginaActual.set(1);
  }

  cambiarFiltros(): void {
    this.paginaActual.set(1);
  }

  ordenarPor(campo: CampoOrden): void {
    this.orden.set(alternarOrden(this.orden(), campo));
    this.paginaActual.set(1);
  }

  iconoOrden(campo: CampoOrden): string {
    return obtenerIconoOrden(this.orden(), campo);
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) return;
    this.paginaActual.set(pagina);
  }

  verMotivoRechazo(envio: SemanalEnvioItem): void {
    const detalles = [
      envio.motivoRechazo?.trim() || 'Sin motivo registrado.',
      envio.usuarioResolucion ? `Rechazado por: ${envio.usuarioResolucion}.` : '',
      envio.fechaRechazoTexto ? `Fecha: ${envio.fechaRechazoTexto}.` : '',
    ]
      .filter((detalle) => detalle.length > 0)
      .join(' ');

    void mostrarAdvertencia('Motivo del rechazo', detalles);
  }

  verAcuse(envio: SemanalEnvioItem): void {
    if (!envio.endpointAcuse) return;

    const periodo = this.obtenerPeriodoSeleccionado();
    const anioCorte = periodo?.anioCorte ?? envio.anioCorte;
    const mesCorte = periodo?.mesCorte ?? envio.mesCorte;

    this.descargandoAcuse.set(envio.codigoReferencia);

    this.semanalCargaService
      .crearTicketAcuse(envio.codigoReferencia, envio.esConfirmado, anioCorte, mesCorte)
      .subscribe({
        next: (response) => {
          this.descargandoAcuse.set(null);

          if (!response.ticket) {
            mostrarError(
              'Informe no disponible',
              'La API no devolvió un ticket para consultar el informe.',
            );
            return;
          }

          const url = this.semanalCargaService.obtenerUrlAcuseTicket(response.ticket);

          this.acuseUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
          this.acuseTitulo.set(
            `${envio.esConfirmado ? 'Acuse' : 'Informe previo'} — ${envio.entidadFederativa} — ${envio.usuarioCarga} — ${this.periodoTexto(envio)}`,
          );
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

  descargarArchivos(envio: SemanalEnvioItem): void {
    this.descargandoArchivos.set(envio.codigoReferencia);

    this.semanalEnviosService.descargarArchivos(envio.codigoReferencia).subscribe({
      next: (response) => {
        this.descargandoArchivos.set(null);

        if (!response.body) {
          mostrarError('Archivo vacío', 'La API no devolvió archivos preliminares.');
          return;
        }

        const nombre =
          this.obtenerNombreArchivo(response.headers.get('content-disposition')) ||
          `ARCHIVOS_PRELIMINARES_${envio.codigoReferencia}.zip`;

        this.descargarBlob(response.body, nombre);
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

  esPendienteConfirmacionUsuario(envio: SemanalEnvioItem): boolean {
    const estado = envio.estado.trim().toUpperCase();

    return estado === 'VALIDADO_PENDIENTE' || estado === 'VALIDADO_PENDIENTE_ACTUALIZACION';
  }

  resolverPendiente(envio: SemanalEnvioItem): void {
    const soloConsulta = this.esSuperUsuario() && this.esPendienteConfirmacionUsuario(envio);

    if (!envio.puedeResolverPendiente && !soloConsulta) return;

    const periodo = this.obtenerPeriodoSeleccionado();

    void this.router.navigate(['/semanal/carga'], {
      queryParams: {
        resolver: envio.codigoReferencia,
        tipoCarga: envio.tipoCarga,
        usuario: envio.usuarioCarga,
        anioCorte: periodo?.anioCorte ?? envio.anioCorte,
        mesCorte: periodo?.mesCorte ?? envio.mesCorte,
      },
    });
  }

  async exportarExcel(): Promise<void> {
    this.exportandoExcel.set(true);

    try {
      const filas = this.enviosFiltrados().map((envio) => ({
        'Entidad federativa': envio.entidadFederativa,
        'Cve. entidad': envio.claveEntidad,
        Usuario: envio.usuarioCarga,
        Periodo: this.periodoTexto(envio),
        'Fecha de envío': envio.fechaEnvioTexto,
        Estatus: envio.estadoTexto,
      }));

      const exportado = await exportarFilasExcel(
        filas,
        'consulta_envios_preliminares.xlsx',
        'Envíos preliminares',
      );

      if (!exportado) {
        mostrarError('Sin registros', 'No existen envíos para exportar.');
      }
    } catch {
      mostrarError('No fue posible exportar', 'Intente nuevamente.');
    } finally {
      this.exportandoExcel.set(false);
    }
  }

  cerrarAcuse(): void {
    this.acuseUrl.set(null);
  }

  periodoTexto(envio: SemanalEnvioItem): string {
    const periodoSeleccionado = this.obtenerPeriodoSeleccionado();

    if (periodoSeleccionado && this.contienePeriodo(envio, periodoSeleccionado.clave)) {
      return periodoSeleccionado.periodo;
    }

    const periodos = this.obtenerPeriodosEnvio(envio);

    if (periodos.length === 0) {
      return envio.periodo || this.crearPeriodoTexto(envio.anioCorte, envio.mesCorte);
    }

    return periodos
      .map((periodo) => this.crearPeriodoTexto(periodo.anioCorte, periodo.mesCorte))
      .join(', ');
  }

  usuarioTexto(envio: SemanalEnvioItem): string {
    return envio.usuarioCarga;
  }

  private obtenerValorOrden(envio: SemanalEnvioItem, campo: CampoOrden): ValorOrden {
    switch (campo) {
      case 'entidad':
        return envio.entidadFederativa;
      case 'clave':
        return envio.claveEntidad;
      case 'fecha':
        return envio.fechaMovimiento;
      case 'periodo':
        return envio.anioCorte * 100 + envio.mesCorte;
      case 'usuario':
        return envio.usuarioCarga;
      case 'estado':
        return envio.estadoTexto;
    }
  }

  private obtenerPeriodoSeleccionado(): PeriodoEnvio | null {
    const clave = this.periodoEnvioSeleccionado();

    if (!clave) return null;

    return this.periodosEnvio().find((periodo) => periodo.clave === clave) ?? null;
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

  private sincronizarPeriodosEnvio(registros: SemanalEnvioItem[]): void {
    const mapa = new Map<string, PeriodoEnvio>();

    for (const registro of registros) {
      for (const periodoRegistro of this.obtenerPeriodosEnvio(registro)) {
        const clave = `${periodoRegistro.anioCorte}-${periodoRegistro.mesCorte.toString().padStart(2, '0')}`;

        if (!mapa.has(clave)) {
          mapa.set(clave, {
            clave,
            anioCorte: periodoRegistro.anioCorte,
            mesCorte: periodoRegistro.mesCorte,
            periodo: this.crearPeriodoTexto(periodoRegistro.anioCorte, periodoRegistro.mesCorte),
          });
        }
      }
    }

    const periodos = Array.from(mapa.values()).sort(
      (a, b) => b.anioCorte * 100 + b.mesCorte - (a.anioCorte * 100 + a.mesCorte),
    );

    this.periodosEnvio.set(periodos);

    if (periodos.length === 0) {
      this.periodoEnvioSeleccionado.set('');
      return;
    }

    const seleccionada = this.periodoEnvioSeleccionado();

    if (!periodos.some((periodo) => periodo.clave === seleccionada)) {
      this.periodoEnvioSeleccionado.set(periodos[0].clave);
    }
  }
  private contienePeriodo(envio: SemanalEnvioItem, periodoSeleccionado: string): boolean {
    const [anioTexto, mesTexto] = periodoSeleccionado.split('-');
    const anioCorte = Number(anioTexto);
    const mesCorte = Number(mesTexto);

    return this.obtenerPeriodosEnvio(envio).some(
      (periodo) => periodo.anioCorte === anioCorte && periodo.mesCorte === mesCorte,
    );
  }

  private obtenerPeriodosEnvio(
    envio: SemanalEnvioItem,
  ): Array<{ anioCorte: number; mesCorte: number }> {
    const fuente =
      envio.periodos?.length > 0
        ? envio.periodos
        : [
            {
              anioCorte: envio.anioCorte,
              mesCorte: envio.mesCorte,
            },
          ];

    const mapa = new Map<string, { anioCorte: number; mesCorte: number }>();

    for (const periodo of fuente) {
      const clave = `${periodo.anioCorte}-${periodo.mesCorte.toString().padStart(2, '0')}`;

      if (!mapa.has(clave)) {
        mapa.set(clave, {
          anioCorte: periodo.anioCorte,
          mesCorte: periodo.mesCorte,
        });
      }
    }

    return Array.from(mapa.values()).sort(
      (a, b) => a.anioCorte * 100 + a.mesCorte - (b.anioCorte * 100 + b.mesCorte),
    );
  }
  private crearPeriodoTexto(anioCorte: number, mesCorte: number): string {
    const fecha = new Date(anioCorte, mesCorte - 1, 1);
    const periodo = new Intl.DateTimeFormat('es-MX', {
      month: 'long',
      year: 'numeric',
    }).format(fecha);

    return periodo.charAt(0).toUpperCase() + periodo.slice(1);
  }
}
