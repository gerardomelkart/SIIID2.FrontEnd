import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { ModuloRecordatorioCarga, RecordatorioCargaResponse, RecordatoriosCargaService } from '../../core/services/recordatorios-carga.service';

@Component({
  selector: 'app-recordatorio-carga',
  templateUrl: './recordatorio-carga.html',
  styleUrl: './recordatorio-carga.css',
})
export class RecordatorioCarga implements OnInit {
  private readonly recordatoriosCargaService = inject(RecordatoriosCargaService);

  @Input({ required: true }) modulo!: ModuloRecordatorioCarga;

  recordatorio = signal<RecordatorioCargaResponse | null>(null);
  visible = signal(false);

  ngOnInit(): void {
    this.recordatoriosCargaService.obtener(this.modulo).subscribe({
      next: (response) => {
        this.recordatorio.set(response);
        this.visible.set(response.hayPendiente);
      },
      error: () => {
        this.recordatorio.set(null);
        this.visible.set(false);
      },
    });
  }

  cerrar(): void {
    this.visible.set(false);
  }
}