import { Component, inject } from '@angular/core';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-semanal-inicio',
  imports: [],
  templateUrl: './semanal-inicio.html',
  styleUrl: './semanal-inicio.css',
})
export class SemanalInicio {
  private readonly sessionService = inject(SessionService);

  usuario = this.sessionService.usuario;
}