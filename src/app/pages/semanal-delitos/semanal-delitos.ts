import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActualizarConfiguracionDelitosSemanalesRequest, ConfiguracionDelitoSemanalItem } from '../../core/models/semanal-delitos.models';
import { SemanalDelitosService } from '../../core/services/semanal-delitos.service';
import { mostrarAdvertencia, mostrarError, mostrarExitoInstitucional } from '../../core/utils/alert.utils';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';

@Component({
  selector: 'app-semanal-delitos',
  imports: [FormsModule],
  templateUrl: './semanal-delitos.html',
  styleUrls: ['../semanal-usuarios/semanal-usuarios.css', './semanal-delitos.css'],
})
export class SemanalDelitos implements OnInit {
  private readonly semanalDelitosService = inject(SemanalDelitosService);

  delitos = signal<ConfiguracionDelitoSemanalItem[]>([]);
  busqueda = signal('');
  cargando = signal(false);
  guardando = signal(false);
  firmaOriginal = signal('');

  delitosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();

    if (!texto) return this.delitos();

    return this.delitos().filter((delito) => delito.clave.toLowerCase().includes(texto) || delito.delito.toLowerCase().includes(texto) || delito.bienJuridico.toLowerCase().includes(texto));
  });

  totalDisponibles = computed(() => this.delitos().length);
  totalSeleccionados = computed(() => this.delitos().filter((delito) => delito.seleccionado).length);
  totalOpcionales = computed(() => this.delitos().filter((delito) => delito.seleccionado && !delito.esObligatorio).length);
  hayCambios = computed(() => this.firmaConfiguracion(this.delitos()) !== this.firmaOriginal());

  ngOnInit(): void {
    this.cargarConfiguracion();
  }

  cargarConfiguracion(): void {
    this.cargando.set(true);

    this.semanalDelitosService.obtenerConfiguracion().subscribe({
      next: (response) => {
        this.cargando.set(false);

        if (!response.esValido) {
          mostrarAdvertencia('No fue posible cargar la configuración', response.mensaje || 'La API rechazó la solicitud.');
          return;
        }

        this.establecerConfiguracion(response.delitos ?? []);
      },
      error: (error) => {
        this.cargando.set(false);
        mostrarError('No fue posible cargar los delitos', obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'));
      },
    });
  }

  buscar(valor: string): void {
    this.busqueda.set(valor);
  }

  cambiarSeleccion(idDelito: number, seleccionado: boolean): void {
    const delito = this.delitos().find((item) => item.idDelito === idDelito);

    if (!delito || delito.esObligatorio) return;

    this.delitos.update((actuales) => this.normalizarOrden(actuales.map((item) => item.idDelito === idDelito ? { ...item, seleccionado } : item)));
  }

  mover(idDelito: number, direccion: -1 | 1): void {
    const seleccionados = this.delitos().filter((delito) => delito.seleccionado).sort((a, b) => a.orden - b.orden).map((delito) => ({ ...delito }));
    const indice = seleccionados.findIndex((delito) => delito.idDelito === idDelito);
    const destino = indice + direccion;

    if (indice < 0 || destino < 0 || destino >= seleccionados.length || seleccionados[indice].esObligatorio || seleccionados[destino].esObligatorio) return;

    [seleccionados[indice], seleccionados[destino]] = [seleccionados[destino], seleccionados[indice]];

    seleccionados.forEach((delito, posicion) => delito.orden = posicion + 1);

    const ordenPorId = new Map(seleccionados.map((delito) => [delito.idDelito, delito.orden]));

    this.delitos.update((actuales) => this.normalizarOrden(actuales.map((delito) => ({ ...delito, orden: ordenPorId.get(delito.idDelito) ?? 0 }))));
  }

  puedeSubir(delito: ConfiguracionDelitoSemanalItem): boolean {
    if (!delito.seleccionado || delito.esObligatorio) return false;

    const seleccionados = this.delitos().filter((item) => item.seleccionado).sort((a, b) => a.orden - b.orden);
    const indice = seleccionados.findIndex((item) => item.idDelito === delito.idDelito);

    return indice > 0 && !seleccionados[indice - 1].esObligatorio;
  }

  puedeBajar(delito: ConfiguracionDelitoSemanalItem): boolean {
    if (!delito.seleccionado || delito.esObligatorio) return false;

    const seleccionados = this.delitos().filter((item) => item.seleccionado).sort((a, b) => a.orden - b.orden);
    const indice = seleccionados.findIndex((item) => item.idDelito === delito.idDelito);

    return indice >= 0 && indice < seleccionados.length - 1;
  }

  guardarConfiguracion(): void {
    if (!this.hayCambios() || this.guardando()) return;

    const request: ActualizarConfiguracionDelitosSemanalesRequest = {
      delitos: this.delitos().map((delito) => ({
        idDelito: delito.idDelito,
        seleccionado: delito.seleccionado,
        orden: delito.orden,
      })),
    };

    this.guardando.set(true);

    this.semanalDelitosService.guardarConfiguracion(request).subscribe({
      next: (response) => {
        this.guardando.set(false);

        if (!response.esValido) {
          mostrarAdvertencia('No fue posible guardar la configuración', response.mensaje || 'La API rechazó la solicitud.');
          return;
        }

        this.establecerConfiguracion(response.delitos ?? []);
        mostrarExitoInstitucional(response.mensaje || 'Configuración semanal guardada correctamente.');
      },
      error: (error) => {
        this.guardando.set(false);
        mostrarError('No fue posible guardar la configuración', obtenerMensajeErrorHttp(error, 'Intente nuevamente.'));
      },
    });
  }

  private establecerConfiguracion(delitos: ConfiguracionDelitoSemanalItem[]): void {
    const normalizados = this.normalizarOrden(delitos);

    this.firmaOriginal.set(this.firmaConfiguracion(normalizados));
    this.delitos.set(normalizados);
  }

  private normalizarOrden(delitos: ConfiguracionDelitoSemanalItem[]): ConfiguracionDelitoSemanalItem[] {
    const seleccionados = delitos.filter((delito) => delito.esObligatorio || delito.seleccionado).map((delito) => ({ ...delito, seleccionado: true })).sort((a, b) => Number(b.esObligatorio) - Number(a.esObligatorio) || this.ordenComparable(a) - this.ordenComparable(b) || a.clave.localeCompare(b.clave, 'es', { numeric: true }));
    const noSeleccionados = delitos.filter((delito) => !delito.esObligatorio && !delito.seleccionado).map((delito) => ({ ...delito, orden: 0 })).sort((a, b) => a.clave.localeCompare(b.clave, 'es', { numeric: true }));

    seleccionados.forEach((delito, indice) => delito.orden = indice + 1);

    return [...seleccionados, ...noSeleccionados];
  }

  private ordenComparable(delito: ConfiguracionDelitoSemanalItem): number {
    return delito.orden > 0 ? delito.orden : Number.MAX_SAFE_INTEGER;
  }

  private firmaConfiguracion(delitos: ConfiguracionDelitoSemanalItem[]): string {
    return [...delitos].sort((a, b) => a.idDelito - b.idDelito).map((delito) => `${delito.idDelito}:${delito.seleccionado ? 1 : 0}:${delito.orden}`).join('|');
  }
}