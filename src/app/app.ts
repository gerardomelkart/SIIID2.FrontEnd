import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { InactivityService } from './core/services/inactivity.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly title = signal('SIIID2.FrontEnd');

  constructor(
    private router: Router,
    private inactivityService: InactivityService,
  ) {}

  ngOnInit(): void {
    this.inactivityService.iniciar();
    const navigationEntry = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    const esRecarga = navigationEntry?.type === 'reload';

    if (!esRecarga) {
      return;
    }

    const rutaActual = window.location.pathname.toLowerCase();

    // Estas rutas deben conservarse al recargar.
    if (rutaActual === '/login' || rutaActual === '/cambiar-password') {
      return;
    }

    // Si está dentro del sistema, al refrescar regresa al inicio vacío.
    if (rutaActual !== '/') {
      this.router.navigateByUrl('/');
    }
  }
}
