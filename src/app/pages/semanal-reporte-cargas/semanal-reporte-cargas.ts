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

interface SemanaReporte {
  anioSemana: number;
  numeroSemana: number;
  semana: string;
}

type CampoOrden =
  | 'entidadFederativa'
  | 'claveEntidad'
  | 'semana'
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

  semanas = signal<SemanaReporte[]>([]);
  semanaSeleccionada = signal('');

  paginaActual = signal(1);
  tamanioPagina = 10;
  orden = signal<EstadoOrden<CampoOrden> | null>(null);

  cargasFiltradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const semanaSeleccionada = this.semanaSeleccionada();

    const registros = this.cargas().filter((carga) => {
      if (carga.claveEntidad === '00') return false;
      if (!carga.intentos || carga.intentos === 0) return false;

      const keySemana = `${carga.anioSemana}-${carga.numeroSemana.toString().padStart(2, '0')}`;

      if (semanaSeleccionada && keySemana !== semanaSeleccionada) return false;

      if (!texto) return true;

      return (
        carga.entidadFederativa.toLowerCase().includes(texto) ||
        carga.claveEntidad.toLowerCase().includes(texto) ||
        carga.semana.toLowerCase().includes(texto) ||
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
        this.sincronizarSemanas(registros);
        this.paginaActual.set(1);
        this.cargando.set(false);
      },
      error: async (error: unknown) => {
        this.cargando.set(false);

        mostrarError(
          'No fue posible consultar el reporte de cargas semanales',
          await obtenerMensajeErrorHttpAsync(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  buscar(valor: string): void {
    this.busqueda.set(valor);
    this.paginaActual.set(1);
  }

  cambiarSemana(): void {
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

    return (
      valor.includes('RECHAZADO') ||
      valor.includes('ERROR') ||
      valor.includes('EXPIRADO')
    );
  }

  ordenCarga(carga: SemanalReporteCargaItem): string {
    const orden = this.obtenerOrdenCarga(carga);
    return orden ? `${orden}°` : '-';
  }

  async exportarExcel(): Promise<void> {
    this.exportandoExcel.set(true);

    try {
      const filas = this.cargasFiltradas().map((carga) => ({
        'Entidad federativa': carga.entidadFederativa,
        'Cve. entidad': carga.claveEntidad,
        Semana: carga.semana,
        Intentos: carga.intentos,
        Ranking: this.obtenerOrdenCarga(carga) ?? '',
        Estatus: this.etiquetaEstatus(carga),
        'Fecha de carga/actualización': carga.fechaCargaActualizacionTexto || '',
        'Fecha de aprobación': carga.fechaAprobacionTexto || '',
      }));

      const exportado = await exportarFilasExcel(
        filas,
        'reporte_cargas_semanales.xlsx',
        'Cargas semanales',
      );

      if (!exportado) {
        mostrarAdvertencia(
          'Sin registros para exportar',
          'No existen cargas semanales para exportar.',
        );
      }
    } catch {
      mostrarError('No fue posible exportar', 'Intente nuevamente.');
    } finally {
      this.exportandoExcel.set(false);
    }
  }

  private obtenerOrdenCarga(carga: SemanalReporteCargaItem): number | null {
    if (!carga.fechaCargaExitosa) return null;

    const cargasOrdenadas = this.cargas()
      .filter((item) => item.claveEntidad !== '00')
      .filter(
        (item) =>
          item.anioSemana === carga.anioSemana &&
          item.numeroSemana === carga.numeroSemana &&
          !!item.fechaCargaExitosa,
      )
      .sort((a, b) => {
        const fechaA = new Date(a.fechaCargaExitosa!).getTime();
        const fechaB = new Date(b.fechaCargaExitosa!).getTime();

        if (fechaA !== fechaB) return fechaA - fechaB;

        return a.entidadFederativa.localeCompare(b.entidadFederativa, 'es', {
          sensitivity: 'base',
        });
      });

    const indice = cargasOrdenadas.findIndex(
      (item) =>
        item.idEntidadFederativa === carga.idEntidadFederativa &&
        item.anioSemana === carga.anioSemana &&
        item.numeroSemana === carga.numeroSemana,
    );

    return indice >= 0 ? indice + 1 : null;
  }

  private obtenerValorOrden(
    carga: SemanalReporteCargaItem,
    campo: CampoOrden,
  ): ValorOrden {
    switch (campo) {
      case 'entidadFederativa':
        return carga.entidadFederativa;
      case 'claveEntidad':
        return carga.claveEntidad;
      case 'semana':
        return carga.anioSemana * 100 + carga.numeroSemana;
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

  private sincronizarSemanas(registros: SemanalReporteCargaItem[]): void {
    const mapa = new Map<string, SemanaReporte>();

    for (const registro of registros) {
      const key = `${registro.anioSemana}-${registro.numeroSemana.toString().padStart(2, '0')}`;

      if (!mapa.has(key)) {
        mapa.set(key, {
          anioSemana: registro.anioSemana,
          numeroSemana: registro.numeroSemana,
          semana: registro.semana,
        });
      }
    }

    const semanas = Array.from(mapa.values()).sort(
      (a, b) => b.anioSemana * 100 + b.numeroSemana - (a.anioSemana * 100 + a.numeroSemana),
    );

    this.semanas.set(semanas);

    if (semanas.length === 0) {
      this.semanaSeleccionada.set('');
      return;
    }

    const seleccionada = this.semanaSeleccionada();

    const existeSeleccionada = semanas.some(
      (semana) =>
        `${semana.anioSemana}-${semana.numeroSemana.toString().padStart(2, '0')}` ===
        seleccionada,
    );

    if (!existeSeleccionada) {
      const primera = semanas[0];

      this.semanaSeleccionada.set(
        `${primera.anioSemana}-${primera.numeroSemana.toString().padStart(2, '0')}`,
      );
    }
  }

  private normalizarTexto(valor: string | null | undefined): string {
    return (valor ?? '')
      .toString()
      .trim()
      .toUpperCase()
      .replaceAll('-', '_')
      .replace(/\s+/g, '_');
  }
}