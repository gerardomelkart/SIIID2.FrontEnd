import { Component, inject, signal } from '@angular/core';
import { BanciCargaValidacionResponse } from '../../core/models/banci-carga.models';
import { BanciCargaService } from '../../core/services/banci-carga.service';

@Component({
  selector: 'app-banci-carga',
  imports: [],
  templateUrl: './banci-carga.html',
  styleUrl: './banci-carga.css',
})
export class BanciCarga {
  private readonly banciCargaService = inject(BanciCargaService);

  archivoLibro: File | null = null;
  archivoCarpetas: File | null = null;
  archivoDelitos: File | null = null;
  archivoVictimas: File | null = null;

  cargando = signal(false);
  resultado = signal<BanciCargaValidacionResponse | null>(null);
  mensajeLocal = signal('');

  seleccionarLibro(event: Event): void {
    this.archivoLibro = this.obtenerArchivo(event);
    this.archivoCarpetas = null;
    this.archivoDelitos = null;
    this.archivoVictimas = null;
    this.resultado.set(null);
  }

  seleccionarCarpetas(event: Event): void { this.archivoCarpetas = this.obtenerArchivo(event); this.archivoLibro = null; this.resultado.set(null); }
  seleccionarDelitos(event: Event): void { this.archivoDelitos = this.obtenerArchivo(event); this.archivoLibro = null; this.resultado.set(null); }
  seleccionarVictimas(event: Event): void { this.archivoVictimas = this.obtenerArchivo(event); this.archivoLibro = null; this.resultado.set(null); }

  procesar(): void {
    this.mensajeLocal.set('');
    this.resultado.set(null);

    const peticion = this.archivoLibro
      ? this.banciCargaService.validarLibro(this.archivoLibro)
      : this.archivoCarpetas && this.archivoDelitos && this.archivoVictimas
        ? this.banciCargaService.validarArchivos(this.archivoCarpetas, this.archivoDelitos, this.archivoVictimas)
        : null;

    if (!peticion) {
      this.mensajeLocal.set('Selecciona un Excel con las hojas CI, Delitos y Victimas, o los tres archivos Carpetas, Delitos y Victimas.');
      return;
    }

    this.cargando.set(true);

    peticion.subscribe({
      next: (response) => {
        this.resultado.set(response);
        this.cargando.set(false);
      },
      error: (error) => {
        const response = error?.error as BanciCargaValidacionResponse | undefined;

        if (response?.errores) this.resultado.set(response);
        else this.mensajeLocal.set(error?.error?.mensaje || 'No fue posible procesar la carga BANCI.');

        this.cargando.set(false);
      },
    });
  }

  private obtenerArchivo(event: Event): File | null {
    return (event.target as HTMLInputElement).files?.item(0) ?? null;
  }
}