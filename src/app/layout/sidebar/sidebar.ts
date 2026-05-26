import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  cargaAbierta = signal(true);
  incidenciaAbierta = signal(true);

  toggleCarga(): void {
    this.cargaAbierta.update(valor => !valor);
  }

  toggleIncidencia(): void {
    this.incidenciaAbierta.update(valor => !valor);
  }
}