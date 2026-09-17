import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { BanciConsultaService } from '../../core/services/banci-consulta.service';
import { BanciCampoConsulta, BanciConsultaCarpeta, BanciConsultaDetalle, BanciConsultaFiltro,
  BanciConsultaOpciones, BanciConsultaResultado } from '../../core/models/banci-consulta.models';

@Component({
  selector: 'app-banci-consulta',
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './banci-consulta.html',
  styleUrl: './banci-consulta.css',
})
export class BanciConsulta implements OnInit {
  private readonly service = inject(BanciConsultaService);
  private readonly destroyRef = inject(DestroyRef);
  private peticionDetalle?: Subscription;
  private peticionConsulta?: Subscription;
  private temporizadorBusqueda?: ReturnType<typeof setTimeout>;
  private aplicado: BanciConsultaFiltro | null = null;

  opciones = signal<BanciConsultaOpciones | null>(null);
  resultado = signal<BanciConsultaResultado | null>(null);
  detalle = signal<BanciConsultaDetalle | null>(null);
  carpetaSeleccionada = signal<BanciConsultaCarpeta | null>(null);
  cargando = signal(false);
  cargandoDetalle = signal(false);
  exportando = signal(false);
  errorDescarga = signal('');
  tipoDescarga = signal('año');
  error = signal('');
  errorDetalle = signal('');
  anio = new Date().getFullYear();
  mes: number | null = null;
  entidad: number | null = null;
  busqueda = '';
  periodoConsultado = signal('');
  readonly meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => clearTimeout(this.temporizadorBusqueda));
    this.cargarOpciones();
  }

  cambiarFiltros(): void { this.consultar(); }

  cambiarBusqueda(valor: string): void {
    this.busqueda = valor;
    clearTimeout(this.temporizadorBusqueda);
    this.peticionConsulta?.unsubscribe();
    this.resultado.set(null);
    this.cerrarDetalle();
    this.cargando.set(false);
    this.temporizadorBusqueda = setTimeout(() => this.consultar(), 350);
  }

  cargarOpciones(): void {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set('');
    this.service.obtenerOpciones().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (opciones) => {
        const anios = [...new Set([...opciones.anios, new Date().getFullYear()])].sort((a, b) => b - a);
        this.opciones.set({ ...opciones, anios });
        this.anio = opciones.anios[0] ?? new Date().getFullYear();
        this.entidad = opciones.alcanceNacional ? null : opciones.entidades[0]?.idEntidadFederativa ?? null;
        this.cargando.set(false);
        this.consultar();
      },
      error: (e) => {
        this.cargando.set(false);
        this.error.set(e?.error?.mensaje || 'No fue posible cargar las opciones de consulta.');
      },
    });
  }

  consultar(): void {
    if (!this.opciones() || this.exportando()) return;
    clearTimeout(this.temporizadorBusqueda);
    this.aplicado = { anio: this.anio, mes: this.mes, idEntidadFederativa: this.entidad,
      busqueda: this.busqueda.trim(), pagina: 1, tamanoPagina: 25 };
    this.cargarPagina(1);
  }

  cambiarPagina(pagina: number): void {
    const r = this.resultado();
    if (!r || pagina < 1 || pagina > r.totalPaginas || this.cargando()) return;
    this.cargarPagina(pagina);
  }

  private cargarPagina(pagina: number): void {
    if (!this.aplicado) return;
    this.peticionConsulta?.unsubscribe();
    this.cerrarDetalle();
    const filtro = { ...this.aplicado, pagina };
    this.cargando.set(true);
    this.error.set('');
    this.errorDescarga.set('');
    this.resultado.set(null);
    this.peticionConsulta = this.service.consultar(filtro).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (respuesta) => {
        this.resultado.set(respuesta);
        this.periodoConsultado.set(`${filtro.mes ? this.meses[filtro.mes - 1] : 'Todo el año'} ${filtro.anio}`);
        this.tipoDescarga.set(filtro.mes ? 'mes' : 'año');
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.error.set(e?.error?.mensaje || 'No fue posible consultar los datos BANCI.');
      },
    });
  }

  descargarExcel(): void {
    if (!this.aplicado || !this.resultado() || this.cargando() || this.exportando()) return;
    const filtro = { ...this.aplicado };
    this.exportando.set(true);
    this.errorDescarga.set('');
    this.service.descargarExcel(filtro).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (respuesta) => {
        try {
          if (!respuesta.body || respuesta.body.size === 0) throw new Error();
          const periodo = filtro.mes ? `${filtro.anio}_${String(filtro.mes).padStart(2, '0')}` : `${filtro.anio}`;
          const alcance = filtro.idEntidadFederativa ? `ENTIDAD_${String(filtro.idEntidadFederativa).padStart(2, '0')}` : 'NACIONAL';
          const disposicion = respuesta.headers.get('Content-Disposition') ?? '';
          const nombre = /filename\*=UTF-8''([^;]+)/i.exec(disposicion)?.[1];
          const nombreSimple = /filename="?([^";]+)"?/i.exec(disposicion)?.[1];
          const archivo = nombre ? decodeURIComponent(nombre) : nombreSimple || `BANCI_${periodo}_${alcance}.xlsx`;
          const url = URL.createObjectURL(respuesta.body);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = archivo;
          document.body.appendChild(enlace);
          enlace.click();
          enlace.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
          this.errorDescarga.set('No fue posible descargar el Excel. Intente nuevamente.');
        } finally { this.exportando.set(false); }
      },
      error: async (e) => {
        let mensaje = e?.error?.mensaje;
        if (e?.error instanceof Blob) {
          try { mensaje = JSON.parse(await e.error.text()).mensaje; } catch { /* Respuesta sin JSON. */ }
        }
        if (this.destroyRef.destroyed) return;
        this.errorDescarga.set(mensaje || 'No fue posible descargar el Excel. Intente nuevamente.');
        this.exportando.set(false);
      },
    });
  }

  abrirDetalle(carpeta: BanciConsultaCarpeta): void {
    this.cerrarDetalle();
    this.carpetaSeleccionada.set(carpeta);
    this.cargandoDetalle.set(true);
    this.peticionDetalle = this.service.obtenerDetalle(carpeta.idBanciCarpetaInvestigacion)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (detalle) => { this.detalle.set(detalle); this.cargandoDetalle.set(false); },
        error: (e) => {
          this.cargandoDetalle.set(false);
          this.errorDetalle.set(e?.error?.mensaje || 'No fue posible consultar el detalle de la carpeta.');
        },
      });
    setTimeout(() => document.getElementById('detalle-banci')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  cerrarDetalle(): void {
    this.peticionDetalle?.unsubscribe();
    this.carpetaSeleccionada.set(null);
    this.detalle.set(null);
    this.errorDetalle.set('');
    this.cargandoDetalle.set(false);
  }

  valor(campos: BanciCampoConsulta[], nombre: string): string {
    return campos.find((campo) => campo.nombre === nombre)?.valor || '—';
  }
}
