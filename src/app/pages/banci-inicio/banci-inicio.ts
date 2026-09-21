import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-banci-inicio',
  imports: [RouterLink],
  templateUrl: './banci-inicio.html',
  styleUrl: './banci-inicio.css',
})
export class BanciInicio {
  private readonly sessionService = inject(SessionService);

  usuario = this.sessionService.usuario;
  puedeCapturar = computed(() => this.usuario()?.rol === 'SUPER_USUARIO' || (this.usuario()?.rol === 'ENLACE_ESTATAL' && this.sessionService.habilitaCarga()));

  nombreUsuario = computed(() => {
    return this.usuario()?.nombreCompleto || this.usuario()?.nombre || this.usuario()?.usuario || 'usuario';
  });

  entidadUsuario = computed(() => {
    return this.usuario()?.entidadFederativa || 'Nacional';
  });

  rolDescripcion = computed(() => {
    const rol = this.usuario()?.rol;

    if (rol === 'SUPER_USUARIO') return 'Superusuario';
    if (rol === 'ENLACE_ESTATAL') return 'Enlace estatal';
    if (rol === 'CONSULTA') return 'Consulta';

    return rol || 'Usuario';
  });
}