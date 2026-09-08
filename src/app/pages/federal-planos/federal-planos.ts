import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ROLES } from '../../core/constants/roles.constants';
import { FederalInformesService } from '../../core/services/federal-informes.service';
import type { ModoPlanoDescarga, TipoSabanaDescarga } from '../../core/services/informes.service';
import { SessionService } from '../../core/services/session.service';
import { mostrarAdvertencia, mostrarError } from '../../core/utils/alert.utils';
import { obtenerMensajeErrorHttpAsync } from '../../core/utils/http-error.utils';

@Component({
  selector: 'app-federal-planos',
  imports: [FormsModule],
  templateUrl: './federal-planos.html',
  styleUrl: '../informes/informes.css',
})
export class FederalPlanos {
  private readonly informesService = inject(FederalInformesService);
  private readonly sessionService = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);

  usuario = this.sessionService.usuario;
  esSuperUsuario = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);
  puedeVerSabanas = computed(() => {
    const rol = this.usuario()?.rol;
    return rol === ROLES.SUPER_USUARIO || rol === ROLES.ENLACE_ESTATAL || rol === ROLES.CONSULTA;
  });

  anioSabana = signal(new Date().getFullYear());
  modoPlano = signal<ModoPlanoDescarga>('CONFIRMADO');
  descargandoSabanas = signal<TipoSabanaDescarga | null>(null);
  descargaEnProceso = computed(() => this.descargandoSabanas() !== null);

  descargarSabanas(tipo: TipoSabanaDescarga): void {
    if (!this.puedeVerSabanas() || this.descargaEnProceso()) return;

    const anio = Number(this.anioSabana());
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      mostrarAdvertencia('Año inválido', 'Capture un año de corte válido.');
      return;
    }

    const modo: ModoPlanoDescarga = this.esSuperUsuario() ? this.modoPlano() : 'CONFIRMADO';
    this.descargandoSabanas.set(tipo);

    this.informesService.crearTicketDescargaSabanas(anio, tipo, modo).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.descargandoSabanas.set(null)),
    ).subscribe({
      next: (response) => {
        if (!response?.esValido || !response.ticket?.trim()) {
          mostrarAdvertencia('Descarga no disponible', 'La API no devolvió un ticket de descarga válido.');
          return;
        }

        const iframe = document.createElement('iframe');
        iframe.src = this.informesService.obtenerUrlDescargaSabanas(response.ticket);
        iframe.style.display = 'none';
        iframe.title = 'Descarga de planos estadísticos federales';
        document.body.appendChild(iframe);

        setTimeout(() => iframe.remove(), 60000);
      },
      error: async (error) => {
        mostrarError('No fue posible descargar los planos', await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'));
      },
    });
  }
}
