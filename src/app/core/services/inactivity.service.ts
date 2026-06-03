import { Injectable, NgZone, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { mostrarInfo } from '../utils/alert.utils';

import { SessionService } from './session.service';

const TIEMPO_INACTIVIDAD_MS = 10 * 60 * 1000;

@Injectable({
  providedIn: 'root',
})
export class InactivityService {
  private readonly sessionService = inject(SessionService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private iniciado = false;

  private readonly eventosActividad = [
    'click',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'wheel',
  ];

  private readonly manejarActividad = () => {
    this.reiniciarTemporizador();
  };

  constructor() {
    effect(() => {
      const autenticado = this.sessionService.estaAutenticado();

      if (autenticado) {
        this.reiniciarTemporizador();
        return;
      }

      this.limpiarTemporizador();
    });
  }

  iniciar(): void {
    if (this.iniciado) {
      return;
    }

    this.iniciado = true;

    this.ngZone.runOutsideAngular(() => {
      for (const evento of this.eventosActividad) {
        window.addEventListener(evento, this.manejarActividad, {
          passive: true,
        });
      }
    });

    this.reiniciarTemporizador();
  }

  detener(): void {
    if (!this.iniciado) {
      return;
    }

    this.iniciado = false;

    for (const evento of this.eventosActividad) {
      window.removeEventListener(evento, this.manejarActividad);
    }

    this.limpiarTemporizador();
  }

  private reiniciarTemporizador(): void {
    this.limpiarTemporizador();

    if (!this.sessionService.estaAutenticado()) {
      return;
    }

    this.temporizador = setTimeout(() => {
      this.ngZone.run(() => this.cerrarSesionPorInactividad());
    }, TIEMPO_INACTIVIDAD_MS);
  }

  private limpiarTemporizador(): void {
    if (!this.temporizador) {
      return;
    }

    clearTimeout(this.temporizador);
    this.temporizador = null;
  }

  private cerrarSesionPorInactividad(): void {
    if (!this.sessionService.estaAutenticado()) {
      return;
    }

    this.sessionService.limpiarSesion();

    this.router.navigateByUrl('/login').then(() => {
      mostrarInfo('Sesión cerrada', 'La sesión se cerró por 10 minutos de inactividad.');
    });
  }
}
