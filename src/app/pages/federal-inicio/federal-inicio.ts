import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';

import { ROLES } from '../../core/constants/roles.constants';
import { FederalCatalogoResumen } from '../../core/models/federal-catalogos.models';
import { FederalCatalogosService } from '../../core/services/federal-catalogos.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-federal-inicio',
  imports: [DecimalPipe],
  templateUrl: './federal-inicio.html',
  styleUrls: ['../dashboard/dashboard.css', './federal-inicio.css'],
})
export class FederalInicio implements OnInit {
  private readonly sessionService = inject(SessionService);
  private readonly federalCatalogosService = inject(FederalCatalogosService);

  usuario = this.sessionService.usuario;
  resumen = signal<FederalCatalogoResumen | null>(null);
  cargando = signal(true);
  mensaje = signal('');

  nombreUsuario = computed(
    () => this.usuario()?.nombre || this.usuario()?.usuario || 'Usuario',
  );

  rolDescripcion = computed(() => {
    if (this.usuario()?.rol === ROLES.SUPER_USUARIO) {
      return 'Administrador general del sistema';
    }

    if (this.usuario()?.rol === ROLES.ENLACE_ESTATAL) {
      return 'Enlace de información';
    }

    return 'Usuario de consulta';
  });

  ngOnInit(): void {
    this.cargarResumen();
  }

  cargarResumen(): void {
    this.cargando.set(true);
    this.mensaje.set('');

    this.federalCatalogosService.obtenerResumen().subscribe({
      next: (response) => {
        this.resumen.set(response);
        this.cargando.set(false);
      },
      error: () => {
        this.resumen.set(null);
        this.cargando.set(false);
        this.mensaje.set('No fue posible consultar los catálogos del módulo federal.');
      },
    });
  }
}