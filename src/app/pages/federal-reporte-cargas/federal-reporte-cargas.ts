import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ROLES } from '../../core/constants/roles.constants';
import { SessionService } from '../../core/services/session.service';
import { FederalInformesService } from '../../core/services/federal-informes.service';
import { CorteOperativo, InformeReporteCargaItem, PeriodoCorteInforme } from '../../core/models/informes.models';
import { mostrarAdvertencia, mostrarError } from '../../core/utils/alert.utils';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';
import { EstadoOrden, ValorOrden, alternarOrden, obtenerIconoOrden, ordenarPorEstado } from '../../core/utils/sort.utils';

type CampoOrdenCargas = 'corte' | 'intentos' | 'estatusUltimoIntento' | 'fechaCargaActualizacionTexto' | 'fechaAprobacionTexto';

@Component({
  selector: 'app-federal-reporte-cargas',
  imports: [FormsModule],
  templateUrl: './federal-reporte-cargas.html',
  styleUrl: '../informes/informes.css',
})
export class FederalReporteCargas implements OnInit {
  private readonly sessionService = inject(SessionService);
  private readonly informesService = inject(FederalInformesService);
  private readonly destroyRef = inject(DestroyRef);

  usuario = this.sessionService.usuario;
  puedeVerCargas = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);
  readonly tamanioPagina = 10;
  cargas = signal<InformeReporteCargaItem[]>([]);
  cargandoCargas = signal(false);
  exportandoExcel = signal(false);
  busquedaCargas = signal('');
  paginaCargas = signal(1);
  periodosCorte = signal<PeriodoCorteInforme[]>([]);
  periodoCorteSeleccionado = signal('');
  corteOperativo = signal<CorteOperativo>(this.obtenerCorteOperativoActual());
  ordenCargas = signal<EstadoOrden<CampoOrdenCargas> | null>({ campo: 'fechaCargaActualizacionTexto', direccion: 'desc' });

  cargasFiltradas = computed(() => {
    const texto = this.busquedaCargas().trim().toLocaleLowerCase('es');
    const corte = this.corteOperativo();
    const filtradas = this.cargas().filter((carga) => {
      if (carga.mesCorte !== corte.mesCorte || carga.anioCorte !== corte.anioCorte || !carga.intentos) return false;
      return !texto || [carga.corte, carga.intentos,
        carga.tipoCargaUltimoIntento, carga.estatusUltimoIntento, this.etiquetaEstatusCarga(carga),
        carga.fechaCargaActualizacionTexto, carga.fechaAprobacionTexto]
        .some((valor) => String(valor ?? '').toLocaleLowerCase('es').includes(texto));
    });
    return ordenarPorEstado(filtradas, this.ordenCargas(), (carga, campo) => this.obtenerValorOrdenCarga(carga, campo));
  });

  cargasPaginadas = computed(() => {
    const inicio = (this.paginaCargas() - 1) * this.tamanioPagina;
    return this.cargasFiltradas().slice(inicio, inicio + this.tamanioPagina);
  });
  totalPaginasCargas = computed(() => Math.max(1, Math.ceil(this.cargasFiltradas().length / this.tamanioPagina)));

  ngOnInit(): void {
    this.cargarReporteCargas();
  }

  cargarReporteCargas(): void {
    if (!this.puedeVerCargas() || this.cargandoCargas()) return;
    this.cargandoCargas.set(true);
    this.informesService.obtenerReporteCargas().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.cargandoCargas.set(false)),
    ).subscribe({
      next: (response) => {
        if (!response?.esValido || !Array.isArray(response.registros)) {
          mostrarError('No fue posible consultar el reporte de cargas', 'La API no devolvió un reporte válido.');
          return;
        }
        this.cargas.set(response.registros);
        this.sincronizarPeriodosCorte(response.registros);
        this.paginaCargas.set(1);
      },
      error: (error: unknown) => mostrarError('No fue posible consultar el reporte de cargas', obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.')),
    });
  }

  async exportarExcel(): Promise<void> {
    if (!this.puedeVerCargas() || this.cargandoCargas() || this.exportandoExcel()) return;
    this.exportandoExcel.set(true);
    try {
      const filas = this.cargasFiltradas().map((carga) => ({
        Periodo: carga.corte,
        Intentos: carga.intentos,
        Estatus: this.etiquetaEstatusCarga(carga),
        'Fecha de carga/actualización': carga.fechaCargaActualizacionTexto || '',
        'Fecha de aprobación': carga.fechaAprobacionTexto || '',
      }));
      const exportado = await exportarFilasExcel(filas, 'reporte_cargas_federal.xlsx', 'Cargas');
      if (!exportado) mostrarAdvertencia('Sin registros para exportar', 'No hay registros que coincidan con el corte y la búsqueda.');
    } catch {
      mostrarError('No fue posible exportar', 'Intente nuevamente.');
    } finally {
      this.exportandoExcel.set(false);
    }
  }

  private obtenerValorOrdenCarga(carga: InformeReporteCargaItem, campo: CampoOrdenCargas): ValorOrden {
    if (campo === 'fechaCargaActualizacionTexto') return carga.fechaCargaActualizacion;
    if (campo === 'fechaAprobacionTexto') return carga.fechaAprobacion;
    if (campo === 'corte') return carga.anioCorte * 100 + carga.mesCorte;
    return carga[campo] ?? '';
  }

  cambiarCorteReporte(): void {
    this.sincronizarCorteSeleccionado();
    this.paginaCargas.set(1);
  }

  buscarCargas(valor: string): void {
    this.busquedaCargas.set(valor);
    this.paginaCargas.set(1);
  }

  cambiarPaginaCargas(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginasCargas()) {
      return;
    }

    this.paginaCargas.set(pagina);
  }

  etiquetaEstatusCarga(carga: InformeReporteCargaItem): string {
    const estatus = this.normalizarTexto(carga.estatusUltimoIntento);
    const tipoCarga = this.normalizarTexto(carga.tipoCargaUltimoIntento);

    const sufijo = tipoCarga.includes('ACTUALIZACION') ? 'actualización' : 'carga';

    if (!estatus) {
      return 'Sin carga';
    }

    if (estatus.includes('CONFIRMADO')) {
      return `Confirmado ${sufijo}`;
    }

    if (estatus === 'PENDIENTE_APROBACION') {
      return 'Pendiente de aprobación';
    }

    if (estatus.includes('PENDIENTE')) {
      return `Pendiente ${sufijo}`;
    }

    if (estatus.includes('RECHAZADO')) {
      return `Rechazado ${sufijo}`;
    }

    if (estatus.includes('ERROR')) {
      return `Con errores ${sufijo}`;
    }

    if (estatus.includes('EXPIRADO')) {
      return `Expirado ${sufijo}`;
    }

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

  private normalizarTexto(valor: string | null | undefined): string {
    return (valor ?? '').toString().trim().toUpperCase().replaceAll('-', '_').replace(/\s+/g, '_');
  }

  ordenarCargasPor(campo: CampoOrdenCargas): void {
    this.ordenCargas.set(alternarOrden(this.ordenCargas(), campo));
  }

  iconoOrdenCargas(campo: CampoOrdenCargas): string {
    return obtenerIconoOrden(this.ordenCargas(), campo);
  }

  private sincronizarPeriodosCorte(registros: InformeReporteCargaItem[]): void {
    const periodos = this.obtenerPeriodosDesdeCargas(registros);
    const corteActual = this.obtenerCorteOperativoActual();
    const keyActual = this.obtenerKeyPeriodo(corteActual.mesCorte, corteActual.anioCorte);

    const existeCorteActual = periodos.some(
      (periodo) => this.obtenerKeyPeriodo(periodo.mesCorte, periodo.anioCorte) === keyActual,
    );

    if (!existeCorteActual) {
      periodos.unshift({
        mesCorte: corteActual.mesCorte,
        anioCorte: corteActual.anioCorte,
        corte: corteActual.corte,
      });
    }

    this.periodosCorte.set(periodos);

    if (!periodos.some((periodo) => this.obtenerKeyPeriodo(periodo.mesCorte, periodo.anioCorte) === this.periodoCorteSeleccionado())) {
      this.periodoCorteSeleccionado.set(keyActual);
      this.corteOperativo.set(corteActual);
      return;
    }

    this.sincronizarCorteSeleccionado();
  }

  private obtenerPeriodosDesdeCargas(registros: InformeReporteCargaItem[]): PeriodoCorteInforme[] {
    const mapa = new Map<string, PeriodoCorteInforme>();

    for (const registro of registros) {
      if (!registro.mesCorte || !registro.anioCorte) {
        continue;
      }

      const key = this.obtenerKeyPeriodo(registro.mesCorte, registro.anioCorte);

      if (!mapa.has(key)) {
        mapa.set(key, {
          mesCorte: registro.mesCorte,
          anioCorte: registro.anioCorte,
          corte: registro.corte,
        });
      }
    }

    return Array.from(mapa.values()).sort((a, b) => {
      const valorA = a.anioCorte * 100 + a.mesCorte;
      const valorB = b.anioCorte * 100 + b.mesCorte;

      return valorB - valorA;
    });
  }

  private obtenerKeyPeriodo(mesCorte: number, anioCorte: number): string {
    return `${anioCorte}-${mesCorte.toString().padStart(2, '0')}`;
  }

  private sincronizarCorteSeleccionado(): void {
    const key = this.periodoCorteSeleccionado();

    if (!key) {
      return;
    }

    const periodo = this.periodosCorte().find(
      (x) => this.obtenerKeyPeriodo(x.mesCorte, x.anioCorte) === key,
    );

    if (!periodo) {
      return;
    }

    this.corteOperativo.set({
      mesCorte: periodo.mesCorte,
      anioCorte: periodo.anioCorte,
      corte: periodo.corte,
    });
  }

  private obtenerCorteOperativoActual(): CorteOperativo {
    const fecha = new Date();
    let mesCorte = fecha.getMonth();
    let anioCorte = fecha.getFullYear();

    if (mesCorte === 0) {
      mesCorte = 12;
      anioCorte--;
    }

    return {
      mesCorte,
      anioCorte,
      corte: this.obtenerNombreCorte(mesCorte, anioCorte),
    };
  }

  private obtenerNombreCorte(mesCorte: number, anioCorte: number): string {
    const fecha = new Date(anioCorte, mesCorte - 1, 1);
    const texto = new Intl.DateTimeFormat('es-MX', {
      month: 'long',
      year: 'numeric',
    }).format(fecha);

    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
}
