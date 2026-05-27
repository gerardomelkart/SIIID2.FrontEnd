import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('SIIID2.FrontEnd');

  constructor(private router: Router) {}

  ngOnInit(): void {
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const esRecarga = navigationEntry?.type === 'reload';

    if (!esRecarga) {
      return;
    }

    const rutaActual = window.location.pathname.toLowerCase();

    // Si está en login, no lo movemos.
    if (rutaActual === '/login') {
      return;
    }

    // Si está dentro del sistema, al refrescar regresa al inicio vacío.
    if (rutaActual !== '/') {
      this.router.navigateByUrl('/');
    }
  }
}