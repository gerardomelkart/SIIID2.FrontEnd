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
  private aplicado: BanciConsultaFiltro | null = null;

  opciones = signal<BanciConsultaOpciones | null>(null);
  resultado = signal<BanciConsultaResultado | null>(null);
  detalle = signal<BanciConsultaDetalle | null>(null);
  carpetaSeleccionada = signal<BanciConsultaCarpeta | null>(null);
  cargando = signal(false);
  cargandoDetalle = signal(false);
  error = signal('');
  errorDetalle = signal('');
  anio = new Date().getFullYear();
  mes: number | null = null;
  entidad: number | null = null;
  busqueda = '';
  periodoConsultado = signal('');
  readonly meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  ngOnInit(): void { this.cargarOpciones(); }

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
    if (this.cargando() || !this.opciones()) return;
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
    this.cerrarDetalle();
    const filtro = { ...this.aplicado, pagina };
    this.cargando.set(true);
    this.error.set('');
    this.resultado.set(null);
    this.service.consultar(filtro).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (respuesta) => {
        this.resultado.set(respuesta);
        this.periodoConsultado.set(`${filtro.mes ? this.meses[filtro.mes - 1] : 'Todo el año'} ${filtro.anio}`);
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.error.set(e?.error?.mensaje || 'No fue posible consultar los datos BANCI.');
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
