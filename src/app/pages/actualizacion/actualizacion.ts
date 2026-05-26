import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type EstadoPeriodo = 'SIN_CONSULTAR' | 'VALIDANDO' | 'DISPONIBLE' | 'NO_DISPONIBLE';

@Component({
  selector: 'app-actualizacion',
  imports: [FormsModule],
  templateUrl: './actualizacion.html',
  styleUrl: './actualizacion.css',
})
export class Actualizacion {
  anioCorte = signal<string>('');
  mesCorte = signal<string>('');
  estadoPeriodo = signal<EstadoPeriodo>('SIN_CONSULTAR');

  mensajePeriodo = computed(() => {
    const mes = this.mesCorte();
    const anio = this.anioCorte();

    if (this.estadoPeriodo() === 'SIN_CONSULTAR') {
      return '';
    }

    if (this.estadoPeriodo() === 'VALIDANDO') {
      return 'Consultando si existe carga inicial confirmada para el periodo seleccionado...';
    }

    if (this.estadoPeriodo() === 'DISPONIBLE') {
      return `Existe carga inicial confirmada para el periodo ${this.formatearPeriodo(mes, anio)}. Puede continuar con la actualización.`;
    }

    return `No existe carga inicial confirmada para el periodo ${this.formatearPeriodo(mes, anio)}. Primero debe existir una carga inicial confirmada.`;
  });

  puedeConsultar = computed(() => {
    return this.anioCorte() !== '' && this.mesCorte() !== '';
  });

  mostrarArchivos = computed(() => {
    return this.estadoPeriodo() === 'DISPONIBLE';
  });

  onPeriodoChange(): void {
    this.estadoPeriodo.set('SIN_CONSULTAR');
  }

  consultarPeriodo(): void {
    if (!this.puedeConsultar()) {
      return;
    }

    this.estadoPeriodo.set('VALIDANDO');

    // Temporal para demo:
    // Después esto se cambia por una llamada real a la API.
    setTimeout(() => {
      this.estadoPeriodo.set('DISPONIBLE');
    }, 500);
  }

  private formatearPeriodo(mes: string, anio: string): string {
    if (!mes || !anio) {
      return '';
    }

    return `${mes.padStart(2, '0')}/${anio}`;
  }
}