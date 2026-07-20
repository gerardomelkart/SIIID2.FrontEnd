import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActualizarConfiguracionDelitosSemanalesRequest, ConfiguracionDelitoSemanalItem } from '../../core/models/semanal-delitos.models';
import { SemanalDelitosService } from '../../core/services/semanal-delitos.service';
import { mostrarAdvertencia, mostrarError, mostrarExitoInstitucional } from '../../core/utils/alert.utils';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';
import { EstadoOrden, alternarOrden, obtenerIconoOrden, ordenarPorEstado } from '../../core/utils/sort.utils';

type CampoOrdenDelitos = 'clave' | 'delito' | 'bienJuridico' | 'seleccionado';

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
  ordenDelitos = signal<EstadoOrden<CampoOrdenDelitos>>({ campo: 'clave', direccion: 'asc' });

  delitosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const filtrados = !texto ? this.delitos() : this.delitos().filter((delito) => delito.clave.toLowerCase().includes(texto) || delito.delito.toLowerCase().includes(texto) || delito.bienJuridico.toLowerCase().includes(texto));

    return ordenarPorEstado(filtrados, this.ordenDelitos(), (delito, campo) => delito[campo]);
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

  ordenarDelitosPor(campo: CampoOrdenDelitos): void {
    this.ordenDelitos.set(alternarOrden(this.ordenDelitos(), campo));
  }

  iconoOrdenDelitos(campo: CampoOrdenDelitos): string {
    return obtenerIconoOrden(this.ordenDelitos(), campo);
  }

  cambiarSeleccion(idDelito: number, seleccionado: boolean): void {
    const delito = this.delitos().find((item) => item.idDelito === idDelito);

    if (!delito || delito.esObligatorio) return;

    this.delitos.update((actuales) => this.normalizarConfiguracion(actuales.map((item) => item.idDelito === idDelito ? { ...item, seleccionado } : item)));
  }

  guardarConfiguracion(): void {
    if (!this.hayCambios() || this.guardando()) return;

    const request: ActualizarConfiguracionDelitosSemanalesRequest = {
      delitos: this.delitos().map((delito) => ({ idDelito: delito.idDelito, seleccionado: delito.seleccionado })),
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
    const normalizados = this.normalizarConfiguracion(delitos);

    this.firmaOriginal.set(this.firmaConfiguracion(normalizados));
    this.delitos.set(normalizados);
  }

  private normalizarConfiguracion(delitos: ConfiguracionDelitoSemanalItem[]): ConfiguracionDelitoSemanalItem[] {
    return delitos.map((delito) => ({ ...delito, seleccionado: delito.esObligatorio || delito.seleccionado }));
  }

  private firmaConfiguracion(delitos: ConfiguracionDelitoSemanalItem[]): string {
    return [...delitos].sort((a, b) => a.idDelito - b.idDelito).map((delito) => `${delito.idDelito}:${delito.seleccionado ? 1 : 0}`).join('|');
  }
}