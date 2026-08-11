import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ROLES } from '../../core/constants/roles.constants';
import { SemanalEnviosService } from '../../core/services/semanal-envios.service';
import { SessionService } from '../../core/services/session.service';
import { mostrarAdvertencia, mostrarError } from '../../core/utils/alert.utils';
import { obtenerMensajeErrorHttpAsync } from '../../core/utils/http-error.utils';

type TipoPlanoPreliminar = 'COMPLETA' | 'ESTATALES' | 'MUNICIPALES';
type ModoPlanoPreliminar = 'CONFIRMADO' | 'PREVIO' | 'MIXTO';

@Component({
  selector: 'app-semanal-sabanas',
  imports: [FormsModule],
  templateUrl: './semanal-sabanas.html',
  styleUrls: ['../informes/informes.css', './semanal-sabanas.css'],
})
export class SemanalSabanas {
  private readonly semanalEnviosService = inject(SemanalEnviosService);
  private readonly sessionService = inject(SessionService);

  usuario = this.sessionService.usuario;
  esSuperUsuario = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);
  entidadUsuario = computed(() => this.usuario()?.entidadFederativa ?? '');

  anioCorte = signal(new Date().getFullYear());
  modoPlano = signal<ModoPlanoPreliminar>('CONFIRMADO');
  descargandoPlano = signal<TipoPlanoPreliminar | null>(null);
  descargaEnProceso = computed(() => this.descargandoPlano() !== null);

  ajustarAnio(cantidad: number): void {
    this.anioCorte.set(this.anioCorte() + cantidad);
  }

  descargarPlanos(tipo: TipoPlanoPreliminar): void {
    const anioCorte = Number(this.anioCorte());
    const modo: ModoPlanoPreliminar = this.esSuperUsuario() ? this.modoPlano() : 'CONFIRMADO';

    if (!Number.isInteger(anioCorte) || anioCorte < 2000 || anioCorte > 2100) {
      mostrarAdvertencia('Año inválido', 'Capture un año de corte válido.');
      return;
    }

    this.descargandoPlano.set(tipo);

    this.semanalEnviosService.crearTicketDescargaSabanas(anioCorte, tipo, modo).subscribe({
      next: (response) => {
        if (!response.ticket) {
          this.descargandoPlano.set(null);
          mostrarAdvertencia('Descarga no disponible', 'La API no devolvió un ticket de descarga.');
          return;
        }

        const iframe = document.createElement('iframe');

        iframe.src = this.semanalEnviosService.obtenerUrlDescargaSabanas(response.ticket);
        iframe.style.display = 'none';

        document.body.appendChild(iframe);
        this.descargandoPlano.set(null);

        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 60000);
      },
      error: async (error: unknown) => {
        this.descargandoPlano.set(null);

        mostrarError(
          'No fue posible descargar los planos estadísticos',
          await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
        );
      },
    });
  }
}