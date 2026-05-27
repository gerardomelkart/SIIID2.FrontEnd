import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ActualizacionPeriodoResponse } from '../../core/models/actualizacion.models';
import { ActualizacionService } from '../../core/services/actualizacion.service';
import { SessionService } from '../../core/services/session.service';

type EstadoPeriodo =
  | 'SIN_CONSULTAR'
  | 'CONSULTANDO'
  | 'DISPONIBLE'
  | 'NO_DISPONIBLE'
  | 'ERROR';

@Component({
  selector: 'app-actualizacion',
  imports: [FormsModule],
  templateUrl: './actualizacion.html',
  styleUrl: './actualizacion.css'
})
export class Actualizacion {
  anioCorte = signal<string>('');
  mesCorte = signal<string>('');
  idEntidadFederativa = signal<string>('');

  estadoPeriodo = signal<EstadoPeriodo>('SIN_CONSULTAR');
  respuestaPeriodo = signal<ActualizacionPeriodoResponse | null>(null);
  mensajePeriodo = signal('');

  carpetas = signal<File | null>(null);
  delitos = signal<File | null>(null);
  victimas = signal<File | null>(null);

  usuario = this.sessionService.usuario;

  esSuperUsuario = computed(() => {
    const rol = this.usuario()?.rol?.toLowerCase() ?? '';
    return rol.includes('super');
  });

  puedeConsultar = computed(() => {
    const tienePeriodo = this.anioCorte() !== '' && this.mesCorte() !== '';

    if (!tienePeriodo) {
      return false;
    }

    if (this.esSuperUsuario()) {
      return this.idEntidadFederativa() !== '';
    }

    return true;
  });

  mostrarSelectorEntidad = computed(() => this.esSuperUsuario());

  mostrarArchivos = computed(() => this.estadoPeriodo() === 'DISPONIBLE');

  constructor(
    private actualizacionService: ActualizacionService,
    private sessionService: SessionService
  ) {}

  onPeriodoChange(): void {
    this.estadoPeriodo.set('SIN_CONSULTAR');
    this.respuestaPeriodo.set(null);
    this.mensajePeriodo.set('');
    this.limpiarArchivos();
  }

  consultarPeriodo(): void {
    if (!this.puedeConsultar()) {
      return;
    }

    const mes = Number(this.mesCorte());
    const anio = Number(this.anioCorte());

    const idEntidad = this.esSuperUsuario()
      ? Number(this.idEntidadFederativa())
      : null;

    this.estadoPeriodo.set('CONSULTANDO');
    this.respuestaPeriodo.set(null);
    this.mensajePeriodo.set('Consultando periodo seleccionado...');

    this.actualizacionService.consultarPeriodo(mes, anio, idEntidad).subscribe({
      next: (response) => {
        this.respuestaPeriodo.set(response);
        this.mensajePeriodo.set(response.mensaje || '');

        if (response.puedeActualizar) {
          this.estadoPeriodo.set('DISPONIBLE');
          return;
        }

        this.estadoPeriodo.set('NO_DISPONIBLE');
      },
      error: (error) => {
        const response = error?.error as ActualizacionPeriodoResponse | undefined;

        if (response?.mensaje) {
          this.respuestaPeriodo.set(response);
          this.mensajePeriodo.set(response.mensaje);
          this.estadoPeriodo.set('NO_DISPONIBLE');
          return;
        }

        this.estadoPeriodo.set('ERROR');
        this.mensajePeriodo.set('No fue posible consultar el periodo seleccionado.');
      }
    });
  }

  seleccionarArchivo(event: Event, tipo: 'carpetas' | 'delitos' | 'victimas'): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;

    if (tipo === 'carpetas') {
      this.carpetas.set(archivo);
    }

    if (tipo === 'delitos') {
      this.delitos.set(archivo);
    }

    if (tipo === 'victimas') {
      this.victimas.set(archivo);
    }
  }

  private limpiarArchivos(): void {
    this.carpetas.set(null);
    this.delitos.set(null);
    this.victimas.set(null);
  }
}