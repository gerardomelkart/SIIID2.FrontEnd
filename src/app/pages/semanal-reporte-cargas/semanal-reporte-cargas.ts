import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SemanalReporteCargaItem } from '../../core/models/semanal-reporte-cargas.models';
import { SemanalEnviosService } from '../../core/services/semanal-envios.service';
import { SessionService } from '../../core/services/session.service';
import { mostrarAdvertencia, mostrarError } from '../../core/utils/alert.utils';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';
import { obtenerMensajeErrorHttpAsync } from '../../core/utils/http-error.utils';
import {
  EstadoOrden,
  ValorOrden,
  alternarOrden,
  obtenerIconoOrden,
  ordenarPorEstado,
} from '../../core/utils/sort.utils';

interface PeriodoReporte {
  clave: string;
  anioCorte: number;
  mesCorte: number;
  periodo: string;
}

interface UsuarioReporte {
  idUsuarioCarga: number;
  usuarioCarga: string;
  nombreUsuarioCarga: string;
}

type CampoOrden =
  | 'entidadFederativa'
  | 'claveEntidad'
  | 'usuario'
  | 'periodo'
  | 'intentos'
  | 'ordenCarga'
  | 'estatusUltimoIntento'
  | 'fechaCargaActualizacionTexto'
  | 'fechaAprobacionTexto';

@Component({
  selector: 'app-semanal-reporte-cargas',
  imports: [FormsModule],
  templateUrl: './semanal-reporte-cargas.html',
  styleUrls: ['../informes/informes.css', '../semanal-envios/semanal-envios.css'],
})
export class SemanalReporteCargas implements OnInit {
  private readonly semanalEnviosService = inject(SemanalEnviosService);
  private readonly sessionService = inject(SessionService);

  usuario = this.sessionService.usuario;

  cargas = signal<SemanalReporteCargaItem[]>([]);
  cargando = signal(false);
  exportandoExcel = signal(false);
  busqueda = signal('');

  periodos = signal<PeriodoReporte[]>([]);
  periodoSeleccionado = signal('');
  idUsuarioSeleccionado = signal<number | null>(null);

  paginaActual = signal(1);
  tamanioPagina = 10;
  orden = signal<EstadoOrden<CampoOrden> | null>(null);

  usuariosReporte = computed<UsuarioReporte[]>(() => {
    const mapa = new Map<number, UsuarioReporte>();

    for (const carga of this.cargas()) {
      if (!mapa.has(carga.idUsuarioCarga)) {
        mapa.set(carga.idUsuarioCarga, {
          idUsuarioCarga: carga.idUsuarioCarga,
          usuarioCarga: carga.usuarioCarga,
          nombreUsuarioCarga: carga.nombreUsuarioCarga,
        });
      }
    }

    return Array.from(mapa.values()).sort((a, b) =>
      a.usuarioCarga.localeCompare(b.usuarioCarga, 'es', { sensitivity: 'base' }),
    );
  });

  cargasFiltradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const periodoSeleccionado = this.periodoSeleccionado();
    const idUsuarioSeleccionado = this.idUsuarioSeleccionado();

    const registros = this.cargas().filter((carga) => {
      if (carga.claveEntidad === '00') return false;
      if (!carga.intentos || carga.intentos === 0) return false;

      if (periodoSeleccionado) {
        const [anioTexto, mesTexto] = periodoSeleccionado.split('-');

        if (carga.anioCorte !== Number(anioTexto) || carga.mesCorte !== Number(mesTexto)) {
          return false;
        }
      }

      if (idUsuarioSeleccionado && carga.idUsuarioCarga !== idUsuarioSeleccionado) {
        return false;
      }

      if (!texto) return true;

      return (
        carga.entidadFederativa.toLowerCase().includes(texto) ||
        carga.claveEntidad.toLowerCase().includes(texto) ||
        carga.usuarioCarga.toLowerCase().includes(texto) ||
        this.periodoTexto(carga).toLowerCase().includes(texto) ||
        (carga.tipoCargaUltimoIntento ?? '').toLowerCase().includes(texto) ||
        (carga.estatusUltimoIntento ?? '').toLowerCase().includes(texto) ||
        (carga.ultimoIntento ?? '').toLowerCase().includes(texto)
      );
    });

    return ordenarPorEstado(registros, this.orden(), (carga, campo) =>
      this.obtenerValorOrden(carga, campo),
    );
  });

  cargasPaginadas = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanioPagina;
    return this.cargasFiltradas().slice(inicio, inicio + this.tamanioPagina);
  });

  totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.cargasFiltradas().length / this.tamanioPagina)),
  );

  ngOnInit(): void {
    this.cargarReporte();
  }

  cargarReporte(): void {
    this.cargando.set(true);

    this.semanalEnviosService.obtenerReporteCargas().subscribe({
      next: (response) => {
        const registros = response.registros ?? [];

        this.cargas.set(registros);
        this.sincronizarPeriodos(registros);

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
          'No fue posible consultar el reporte de cargas preliminares',
          await obtenerMensajeErrorHttpAsync(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  buscar(valor: string): void {
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

  periodoTexto(carga: SemanalReporteCargaItem): string {
    return carga.periodo || this.crearPeriodoTexto(carga.anioCorte, carga.mesCorte);
  }

  etiquetaEstatus(carga: SemanalReporteCargaItem): string {
    const estatus = this.normalizarTexto(carga.estatusUltimoIntento);
    const tipoCarga = this.normalizarTexto(carga.tipoCargaUltimoIntento);
    const sufijo = tipoCarga.includes('ACTUALIZACION') ? 'actualización' : 'carga';

    if (!estatus) return 'Sin carga';
    if (estatus.includes('CONFIRMADO')) return `Confirmado ${sufijo}`;
    if (estatus === 'PENDIENTE_APROBACION') return 'Pendiente de aprobación';
    if (estatus.includes('PENDIENTE')) return `Pendiente ${sufijo}`;
    if (estatus.includes('RECHAZADO')) return `Rechazado ${sufijo}`;
    if (estatus.includes('ERROR')) return `Con errores ${sufijo}`;
    if (estatus.includes('EXPIRADO')) return `Expirado ${sufijo}`;

    return estatus.replaceAll('_', ' ');
  }

  esEstatusConfirmado(estatus: string | null): boolean {
    return this.normalizarTexto(estatus).includes('CONFIRMADO');
  }

  esEstatusPendiente(estatus: string | null): boolean {
    return this.normalizarTexto(estatus).includes('PENDIENTE');
  }

  esEstatusError(estatus: string | null): boolean {
    const valor = this.normalizarTexto(estatus);

    return valor.includes('RECHAZADO') || valor.includes('ERROR') || valor.includes('EXPIRADO');
  }

  ordenCarga(carga: SemanalReporteCargaItem): string {
    const orden = this.obtenerOrdenCarga(carga);
    return orden ? `${orden}°` : '-';
  }

  async exportarExcel(): Promise<void> {
    this.exportandoExcel.set(true);

    try {
      const filas = this.obtenerCargasExportacion().map((carga) => ({
        Ranking: this.obtenerOrdenCarga(carga) ?? '',
        Usuario: carga.usuarioCarga,
        'Entidad federativa': carga.entidadFederativa,
        'Cve. entidad': carga.claveEntidad,
        Periodo: this.periodoTexto(carga),
        Intentos: carga.intentos,
        Estatus: this.etiquetaEstatus(carga),
        'Fecha de carga/actualización': carga.fechaCargaActualizacionTexto || '',
        'Fecha de aprobación': carga.fechaAprobacionTexto || '',
      }));

      const exportado = await exportarFilasExcel(
        filas,
        'reporte_cargas_preliminares.xlsx',
        'Cargas preliminares',
      );

      if (!exportado) {
        mostrarAdvertencia(
          'Sin registros para exportar',
          'No existen cargas preliminares para exportar.',
        );
      }
    } catch {
      mostrarError('No fue posible exportar', 'Intente nuevamente.');
    } finally {
      this.exportandoExcel.set(false);
    }
  }

  private obtenerCargasExportacion(): SemanalReporteCargaItem[] {
    const texto = this.busqueda().trim().toLowerCase();
    const periodoSeleccionado = this.periodoSeleccionado();
    const idUsuarioSeleccionado = this.idUsuarioSeleccionado();

    return this.cargas()
      .filter((carga) => {
        if (carga.claveEntidad === '00') return false;

        if (periodoSeleccionado) {
          const [anioTexto, mesTexto] = periodoSeleccionado.split('-');

          if (carga.anioCorte !== Number(anioTexto) || carga.mesCorte !== Number(mesTexto)) {
            return false;
          }
        }

        if (idUsuarioSeleccionado && carga.idUsuarioCarga !== idUsuarioSeleccionado) {
          return false;
        }

        if (!texto) return true;

        return (
          carga.entidadFederativa.toLowerCase().includes(texto) ||
          carga.claveEntidad.toLowerCase().includes(texto) ||
          carga.usuarioCarga.toLowerCase().includes(texto) ||
          this.periodoTexto(carga).toLowerCase().includes(texto) ||
          (carga.tipoCargaUltimoIntento ?? '').toLowerCase().includes(texto) ||
          (carga.estatusUltimoIntento ?? '').toLowerCase().includes(texto) ||
          (carga.ultimoIntento ?? '').toLowerCase().includes(texto)
        );
      })
      .sort((a, b) => {
        const rankingA = this.obtenerOrdenCarga(a) ?? Number.MAX_SAFE_INTEGER;
        const rankingB = this.obtenerOrdenCarga(b) ?? Number.MAX_SAFE_INTEGER;

        if (rankingA !== rankingB) return rankingA - rankingB;

        const entidad = a.entidadFederativa.localeCompare(b.entidadFederativa, 'es', {
          sensitivity: 'base',
        });

        if (entidad !== 0) return entidad;

        return a.usuarioCarga.localeCompare(b.usuarioCarga, 'es', {
          sensitivity: 'base',
        });
      });
  }

  private obtenerOrdenCarga(carga: SemanalReporteCargaItem): number | null {
    if (!carga.fechaCargaExitosa) return null;

    const cargasOrdenadas = this.cargas()
      .filter((item) => item.claveEntidad !== '00')
      .filter(
        (item) =>
          item.anioCorte === carga.anioCorte &&
          item.mesCorte === carga.mesCorte &&
          !!item.fechaCargaExitosa,
      )
      .sort((a, b) => {
        const fechaA = new Date(a.fechaCargaExitosa!).getTime();
        const fechaB = new Date(b.fechaCargaExitosa!).getTime();

        if (fechaA !== fechaB) return fechaA - fechaB;

        const entidad = a.entidadFederativa.localeCompare(b.entidadFederativa, 'es', {
          sensitivity: 'base',
        });

        if (entidad !== 0) return entidad;

        return a.usuarioCarga.localeCompare(b.usuarioCarga, 'es', { sensitivity: 'base' });
      });

    const indice = cargasOrdenadas.findIndex(
      (item) =>
        item.idEntidadFederativa === carga.idEntidadFederativa &&
        item.idUsuarioCarga === carga.idUsuarioCarga &&
        item.anioCorte === carga.anioCorte &&
        item.mesCorte === carga.mesCorte,
    );

    return indice >= 0 ? indice + 1 : null;
  }

  private obtenerValorOrden(carga: SemanalReporteCargaItem, campo: CampoOrden): ValorOrden {
    switch (campo) {
      case 'entidadFederativa':
        return carga.entidadFederativa;
      case 'claveEntidad':
        return carga.claveEntidad;
      case 'usuario':
        return carga.usuarioCarga;
      case 'periodo':
        return carga.anioCorte * 100 + carga.mesCorte;
      case 'intentos':
        return carga.intentos;
      case 'ordenCarga':
        return this.obtenerOrdenCarga(carga) ?? Number.MAX_SAFE_INTEGER;
      case 'estatusUltimoIntento':
        return this.etiquetaEstatus(carga);
      case 'fechaCargaActualizacionTexto':
        return carga.fechaCargaActualizacion;
      case 'fechaAprobacionTexto':
        return carga.fechaAprobacion;
    }
  }

  private sincronizarPeriodos(registros: SemanalReporteCargaItem[]): void {
    const mapa = new Map<string, PeriodoReporte>();

    for (const registro of registros) {
      const clave = `${registro.anioCorte}-${registro.mesCorte.toString().padStart(2, '0')}`;

      if (!mapa.has(clave)) {
        mapa.set(clave, {
          clave,
          anioCorte: registro.anioCorte,
          mesCorte: registro.mesCorte,
          periodo: this.periodoTexto(registro),
        });
      }
    }

    const periodos = Array.from(mapa.values()).sort(
      (a, b) => b.anioCorte * 100 + b.mesCorte - (a.anioCorte * 100 + a.mesCorte),
    );

    this.periodos.set(periodos);

    if (periodos.length === 0) {
      this.periodoSeleccionado.set('');
      return;
    }

    const seleccionada = this.periodoSeleccionado();

    if (!periodos.some((periodo) => periodo.clave === seleccionada)) {
      this.periodoSeleccionado.set(periodos[0].clave);
    }
  }

  private crearPeriodoTexto(anioCorte: number, mesCorte: number): string {
    const fecha = new Date(anioCorte, mesCorte - 1, 1);
    const periodo = new Intl.DateTimeFormat('es-MX', {
      month: 'long',
      year: 'numeric',
    }).format(fecha);

    return periodo.charAt(0).toUpperCase() + periodo.slice(1);
  }

  private normalizarTexto(valor: string | null | undefined): string {
    return (valor ?? '').toString().trim().toUpperCase().replaceAll('-', '_').replace(/\s+/g, '_');
  }
}
