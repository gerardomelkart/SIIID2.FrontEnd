import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ROLES } from '../../core/constants/roles.constants';
import { SessionService } from '../../core/services/session.service';
import { FormsModule } from '@angular/forms';
import { FederalInformesService } from '../../core/services/federal-informes.service';
import { FederalArchivosOriginalesResumen } from '../../core/models/federal-archivos-originales.models';
import { mostrarAdvertencia, mostrarError } from '../../core/utils/alert.utils';
import {
  obtenerMensajeErrorHttp,
  obtenerMensajeErrorHttpAsync,
} from '../../core/utils/http-error.utils';

import {
  EstadoOrden,
  ValorOrden,
  alternarOrden,
  obtenerIconoOrden,
  ordenarPorEstado,
} from '../../core/utils/sort.utils';

type CampoOrdenOriginales =
  | 'movimiento'
  | 'periodo'
  | 'codigoReferencia'
  | 'fechaGuardado'
  | 'archivos';

@Component({
  selector: 'app-federal-originales',
  imports: [FormsModule],
  templateUrl: './federal-originales.html',
  styleUrl: '../originales/originales.css',
})
export class FederalOriginales implements OnInit {
  private readonly informesService = inject(FederalInformesService);

  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionService = inject(SessionService);
  puedeConsultar = computed(() => this.sessionService.usuario()?.rol === ROLES.SUPER_USUARIO);

  archivos = signal<FederalArchivosOriginalesResumen[]>([]);

  busqueda = signal('');
  cargando = signal(false);
  descargando = signal(false);

  paginaActual = signal(1);
  orden = signal<EstadoOrden<CampoOrdenOriginales> | null>(null);
  readonly tamanioPagina = 5;

  archivosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();

    if (!texto) {
      return this.archivos();
    }

    return this.archivos().filter((item) => {
      return (
        item.codigoReferencia.toLowerCase().includes(texto) ||
        this.tipoMovimientoTexto(item.tipoMovimiento).toLowerCase().includes(texto) ||
        item.archivos.some((archivo) => archivo.nombreOriginal.toLowerCase().includes(texto))
      );
    });
  });

  archivosOrdenados = computed(() =>
    ordenarPorEstado(this.archivosFiltrados(), this.orden(), (item, campo) =>
      this.obtenerValorOrden(item, campo),
    ),
  );

  totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.archivosFiltrados().length / this.tamanioPagina)),
  );

  paginas = computed(() => Array.from({ length: this.totalPaginas() }, (_, indice) => indice + 1));

  archivosPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanioPagina;
    return this.archivosOrdenados().slice(inicio, inicio + this.tamanioPagina);
  });

  primerRegistroVisible = computed(() => {
    if (this.archivosFiltrados().length === 0) {
      return 0;
    }

    return (this.paginaActual() - 1) * this.tamanioPagina + 1;
  });

  ultimoRegistroVisible = computed(() =>
    Math.min(this.paginaActual() * this.tamanioPagina, this.archivosFiltrados().length),
  );

  ngOnInit(): void {
    this.cargarArchivos();
  }

  cargarArchivos(): void {
    if (!this.puedeConsultar() || this.cargando() || this.descargando()) return;
    this.cargando.set(true);

    this.informesService.obtenerArchivosOriginales().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.cargando.set(false))).subscribe({
      next: (response) => {
        if (!response?.esValido || !Array.isArray(response.registros)) {
          mostrarError('No fue posible consultar los archivos originales', 'La API no devolvió una respuesta válida.');
          return;
        }
        this.archivos.set(response.registros);
        this.paginaActual.set(1);
        this.cargando.set(false);
      },
      error: (error) => {
        this.cargando.set(false);

        mostrarError(
          'No fue posible consultar los archivos originales',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  cambiarBusqueda(valor: string): void {
    this.busqueda.set(valor);
    this.paginaActual.set(1);
  }

  ordenarPor(campo: CampoOrdenOriginales): void {
    this.orden.set(alternarOrden(this.orden(), campo));
    this.paginaActual.set(1);
  }

  iconoOrden(campo: CampoOrdenOriginales): string {
    return obtenerIconoOrden(this.orden(), campo);
  }

  irPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) {
      return;
    }

    this.paginaActual.set(pagina);
  }

  descargar(item: FederalArchivosOriginalesResumen): void {
    if (!this.puedeConsultar() || this.cargando() || this.descargando()) return;
    this.descargando.set(true);

    this.informesService.descargarArchivosOriginales().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.descargando.set(false))).subscribe({
      next: (response) => {
        const blob = response.body;

        if (!blob || blob.size === 0) {
          this.descargando.set(false);
          mostrarAdvertencia('Archivo vacío', 'La descarga no devolvió contenido.');
          return;
        }

        const nombreArchivo =
          this.obtenerNombreArchivo(response.headers.get('content-disposition')) ||
          `ARCHIVOS_ORIGINALES_FEDERAL_FGR_${item.anioCorte}_${item.mesCorte.toString().padStart(2, '0')}.zip`;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = nombreArchivo;
        link.click();

        URL.revokeObjectURL(url);
        this.descargando.set(false);
      },
      error: async (error) => {
        this.descargando.set(false);

        mostrarError(
          'No fue posible descargar los archivos originales',
          await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
        );
      },
    });
  }

  tipoMovimientoTexto(tipoMovimiento: string | null): string {
    if (!tipoMovimiento) {
      return '-';
    }

    if (tipoMovimiento === 'CARGA_INICIAL') {
      return 'Carga inicial';
    }

    if (tipoMovimiento === 'ACTUALIZACION') {
      return 'Actualización';
    }

    return tipoMovimiento.replaceAll('_', ' ');
  }

  periodoTexto(item: FederalArchivosOriginalesResumen): string {
    const fecha = new Date(item.anioCorte, item.mesCorte - 1, 1);
    const texto = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(
      fecha,
    );

    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  fechaTexto(fecha: string): string {
    if (!fecha) {
      return '-';
    }

    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(fecha));
  }

  tamanioTexto(bytes: number): string {
    if (!bytes) {
      return '0 B';
    }

    const unidades = ['B', 'KB', 'MB', 'GB'];
    let valor = bytes;
    let indice = 0;

    while (valor >= 1024 && indice < unidades.length - 1) {
      valor = valor / 1024;
      indice++;
    }

    return `${valor.toFixed(indice === 0 ? 0 : 2)} ${unidades[indice]}`;
  }

  shaCorto(sha256: string): string {
    if (!sha256) {
      return '-';
    }

    return `${sha256.substring(0, 12)}...`;
  }

  private obtenerValorOrden(
    item: FederalArchivosOriginalesResumen,
    campo: CampoOrdenOriginales,
  ): ValorOrden {
    if (campo === 'movimiento') return this.tipoMovimientoTexto(item.tipoMovimiento);
    if (campo === 'periodo') return item.anioCorte * 100 + item.mesCorte;
    if (campo === 'codigoReferencia') return item.codigoReferencia;
    if (campo === 'archivos')
      return item.archivos
        .map((archivo) => archivo.nombreOriginal)
        .sort()
        .join(' ');

    const fecha = Date.parse(item.fechaGuardado);
    return Number.isNaN(fecha) ? null : fecha;
  }

  private obtenerNombreArchivo(contentDisposition: string | null): string {
    if (!contentDisposition) {
      return '';
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);

    if (utf8Match?.[1]) {
      try { return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, '')); } catch { return ''; }
    }

    const normalMatch = contentDisposition.match(/filename=(?:"([^"]+)"|([^;]+))/i);

    return (normalMatch?.[1] ?? normalMatch?.[2] ?? '').trim();
  }
}
