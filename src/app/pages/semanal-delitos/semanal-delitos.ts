import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActualizarConfiguracionDelitosSemanalesRequest, ConfiguracionModalidadSemanalItem } from '../../core/models/semanal-delitos.models';
import { SemanalDelitosService } from '../../core/services/semanal-delitos.service';
import { mostrarAdvertencia, mostrarError, mostrarExitoInstitucional } from '../../core/utils/alert.utils';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';

interface DelitoSemanalAgrupado {
  idDelito: number;
  claveDelito: string;
  delito: string;
  modalidades: ConfiguracionModalidadSemanalItem[];
}

interface BienJuridicoSemanalAgrupado {
  idBienJuridico: number;
  claveBienJuridico: string;
  bienJuridico: string;
  delitos: DelitoSemanalAgrupado[];
}

@Component({
  selector: 'app-semanal-delitos',
  imports: [FormsModule],
  templateUrl: './semanal-delitos.html',
  styleUrls: ['../semanal-usuarios/semanal-usuarios.css', './semanal-delitos.css'],
})
export class SemanalDelitos implements OnInit {
  private readonly semanalDelitosService = inject(SemanalDelitosService);

  modalidades = signal<ConfiguracionModalidadSemanalItem[]>([]);
  busqueda = signal('');
  cargando = signal(false);
  guardando = signal(false);
  firmaOriginal = signal('');
  bienesContraidos = signal<Set<number>>(new Set<number>());
  delitosContraidos = signal<Set<number>>(new Set<number>());

  jerarquiaFiltrada = computed(() => this.construirJerarquia(this.modalidades(), this.busqueda()));
  totalDisponibles = computed(() => this.modalidades().length);
  totalSeleccionados = computed(() => this.modalidades().filter((modalidad) => modalidad.seleccionado).length);
  totalOpcionales = computed(() => this.modalidades().filter((modalidad) => modalidad.seleccionado && !modalidad.esObligatorio).length);
  hayCambios = computed(() => this.firmaConfiguracion(this.modalidades()) !== this.firmaOriginal());
  hayBusqueda = computed(() => this.busqueda().trim().length > 0);

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

        this.establecerConfiguracion(response.modalidades ?? []);
      },
      error: (error) => {
        this.cargando.set(false);
        mostrarError('No fue posible cargar las modalidades', obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'));
      },
    });
  }

  buscar(valor: string): void {
    this.busqueda.set(valor);
  }

  alternarBien(idBienJuridico: number): void {
    if (this.hayBusqueda()) return;

    this.bienesContraidos.update((actuales) => {
      const nuevos = new Set(actuales);

      if (nuevos.has(idBienJuridico)) {
        nuevos.delete(idBienJuridico);
      } else {
        nuevos.add(idBienJuridico);
      }

      return nuevos;
    });
  }

  alternarDelito(idDelito: number): void {
    if (this.hayBusqueda()) return;

    this.delitosContraidos.update((actuales) => {
      const nuevos = new Set(actuales);

      if (nuevos.has(idDelito)) {
        nuevos.delete(idDelito);
      } else {
        nuevos.add(idDelito);
      }

      return nuevos;
    });
  }

  expandirTodo(): void {
    if (this.hayBusqueda()) return;

    this.bienesContraidos.set(new Set<number>());
    this.delitosContraidos.set(new Set<number>());
  }

  contraerTodo(): void {
    if (this.hayBusqueda()) return;

    this.bienesContraidos.set(new Set(this.modalidades().map((modalidad) => modalidad.idBienJuridico)));
    this.delitosContraidos.set(new Set(this.modalidades().map((modalidad) => modalidad.idDelito)));
  }

  bienContraido(idBienJuridico: number): boolean {
    return !this.hayBusqueda() && this.bienesContraidos().has(idBienJuridico);
  }

  delitoContraido(idDelito: number): boolean {
    return !this.hayBusqueda() && this.delitosContraidos().has(idDelito);
  }

  cambiarSeleccionModalidad(idModalidadDelito: number, seleccionado: boolean): void {
    const modalidad = this.modalidades().find((item) => item.idModalidadDelito === idModalidadDelito);

    if (!modalidad || modalidad.esObligatorio) return;

    this.modalidades.update((actuales) => this.normalizarConfiguracion(actuales.map((item) => item.idModalidadDelito === idModalidadDelito ? { ...item, seleccionado } : item)));
  }

  cambiarSeleccionDelito(idDelito: number, seleccionado: boolean): void {
    this.modalidades.update((actuales) => this.normalizarConfiguracion(actuales.map((modalidad) => modalidad.idDelito === idDelito && !modalidad.esObligatorio ? { ...modalidad, seleccionado } : modalidad)));
  }

  cambiarSeleccionBienJuridico(idBienJuridico: number, seleccionado: boolean): void {
    this.modalidades.update((actuales) => this.normalizarConfiguracion(actuales.map((modalidad) => modalidad.idBienJuridico === idBienJuridico && !modalidad.esObligatorio ? { ...modalidad, seleccionado } : modalidad)));
  }

  delitoSeleccionadoCompleto(idDelito: number): boolean {
    const modalidades = this.modalidades().filter((modalidad) => modalidad.idDelito === idDelito);
    return modalidades.length > 0 && modalidades.every((modalidad) => modalidad.seleccionado);
  }

  delitoSeleccionParcial(idDelito: number): boolean {
    const modalidades = this.modalidades().filter((modalidad) => modalidad.idDelito === idDelito);
    const seleccionadas = modalidades.filter((modalidad) => modalidad.seleccionado).length;
    return seleccionadas > 0 && seleccionadas < modalidades.length;
  }

  delitoTieneOpcionales(idDelito: number): boolean {
    return this.modalidades().some((modalidad) => modalidad.idDelito === idDelito && !modalidad.esObligatorio);
  }

  bienSeleccionadoCompleto(idBienJuridico: number): boolean {
    const modalidades = this.modalidades().filter((modalidad) => modalidad.idBienJuridico === idBienJuridico);
    return modalidades.length > 0 && modalidades.every((modalidad) => modalidad.seleccionado);
  }

  bienSeleccionParcial(idBienJuridico: number): boolean {
    const modalidades = this.modalidades().filter((modalidad) => modalidad.idBienJuridico === idBienJuridico);
    const seleccionadas = modalidades.filter((modalidad) => modalidad.seleccionado).length;
    return seleccionadas > 0 && seleccionadas < modalidades.length;
  }

  bienTieneOpcionales(idBienJuridico: number): boolean {
    return this.modalidades().some((modalidad) => modalidad.idBienJuridico === idBienJuridico && !modalidad.esObligatorio);
  }

  totalModalidadesDelito(idDelito: number): number {
    return this.modalidades().filter((modalidad) => modalidad.idDelito === idDelito).length;
  }

  totalModalidadesBien(idBienJuridico: number): number {
    return this.modalidades().filter((modalidad) => modalidad.idBienJuridico === idBienJuridico).length;
  }

  guardarConfiguracion(): void {
    if (!this.hayCambios() || this.guardando()) return;

    const request: ActualizarConfiguracionDelitosSemanalesRequest = {
      modalidades: this.modalidades().map((modalidad) => ({ idModalidadDelito: modalidad.idModalidadDelito, seleccionado: modalidad.seleccionado })),
    };

    this.guardando.set(true);

    this.semanalDelitosService.guardarConfiguracion(request).subscribe({
      next: (response) => {
        this.guardando.set(false);

        if (!response.esValido) {
          mostrarAdvertencia('No fue posible guardar la configuración', response.mensaje || 'La API rechazó la solicitud.');
          return;
        }

        this.establecerConfiguracion(response.modalidades ?? []);
        mostrarExitoInstitucional(response.mensaje || 'Configuración semanal guardada correctamente.');
      },
      error: (error) => {
        this.guardando.set(false);
        mostrarError('No fue posible guardar la configuración', obtenerMensajeErrorHttp(error, 'Intente nuevamente.'));
      },
    });
  }

  private establecerConfiguracion(modalidades: ConfiguracionModalidadSemanalItem[]): void {
    const normalizadas = this.normalizarConfiguracion(modalidades);

    this.firmaOriginal.set(this.firmaConfiguracion(normalizadas));
    this.modalidades.set(normalizadas);
  }

  private normalizarConfiguracion(modalidades: ConfiguracionModalidadSemanalItem[]): ConfiguracionModalidadSemanalItem[] {
    return modalidades.map((modalidad) => ({ ...modalidad, seleccionado: modalidad.esObligatorio || modalidad.seleccionado }));
  }

  private construirJerarquia(modalidades: ConfiguracionModalidadSemanalItem[], textoBusqueda: string): BienJuridicoSemanalAgrupado[] {
    const texto = textoBusqueda.trim().toLowerCase();
    const visibles = texto ? modalidades.filter((modalidad) => this.coincideBusqueda(modalidad, texto)) : modalidades;
    const ordenadas = [...visibles].sort((a, b) => this.compararClaves(a.claveBienJuridico, b.claveBienJuridico) || this.compararClaves(a.claveDelito, b.claveDelito) || this.compararClaves(a.claveSubtipo, b.claveSubtipo) || this.compararClaves(a.claveModalidad, b.claveModalidad));
    const bienes = new Map<number, BienJuridicoSemanalAgrupado>();

    for (const modalidad of ordenadas) {
      let bien = bienes.get(modalidad.idBienJuridico);

      if (!bien) {
        bien = {
          idBienJuridico: modalidad.idBienJuridico,
          claveBienJuridico: modalidad.claveBienJuridico,
          bienJuridico: modalidad.bienJuridico,
          delitos: [],
        };

        bienes.set(modalidad.idBienJuridico, bien);
      }

      let delito = bien.delitos.find((item) => item.idDelito === modalidad.idDelito);

      if (!delito) {
        delito = {
          idDelito: modalidad.idDelito,
          claveDelito: modalidad.claveDelito,
          delito: modalidad.delito,
          modalidades: [],
        };

        bien.delitos.push(delito);
      }

      delito.modalidades.push(modalidad);
    }

    return [...bienes.values()];
  }

  private coincideBusqueda(modalidad: ConfiguracionModalidadSemanalItem, texto: string): boolean {
    return [
      modalidad.claveBienJuridico,
      modalidad.bienJuridico,
      modalidad.claveDelito,
      modalidad.delito,
      modalidad.claveSubtipo,
      modalidad.subtipo,
      modalidad.claveModalidad,
      modalidad.modalidad,
    ].some((valor) => valor.toLowerCase().includes(texto));
  }

  private compararClaves(a: string, b: string): number {
    return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
  }

  private firmaConfiguracion(modalidades: ConfiguracionModalidadSemanalItem[]): string {
    return [...modalidades].sort((a, b) => a.idModalidadDelito - b.idModalidadDelito).map((modalidad) => `${modalidad.idModalidadDelito}:${modalidad.seleccionado ? 1 : 0}`).join('|');
  }
}