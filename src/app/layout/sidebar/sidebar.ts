import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  cargaAbierta = signal(false);
  incidenciaAbierta = signal(false);

  toggleCarga(): void {
    this.cargaAbierta.update(valor => !valor);

    if (!this.cargaAbierta()) {
      this.incidenciaAbierta.set(false);
    }
  }

  toggleIncidencia(): void {
    this.incidenciaAbierta.update(valor => !valor);
  }
}