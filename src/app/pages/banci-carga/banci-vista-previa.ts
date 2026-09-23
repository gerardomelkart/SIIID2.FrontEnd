import { Component, input } from '@angular/core';
import { BanciVistaPrevia } from '../../core/models/banci-carga.models';

@Component({
  selector: 'app-banci-vista-previa',
  template: `
    @if (previa(); as p) {
      <section class="previa" aria-label="Cambios antes de aceptar">
        @if (p.puedeAceptar === false) { <p class="alert alert-warning" role="alert">{{ p.motivoBloqueo || 'No tiene permisos para integrar esta carga.' }}</p> }
        <h3><i class="fa-solid fa-code-compare"></i> Lo que se integrará al aceptar</h3>
        <p>La carga inicial sólo registra carpetas nuevas, identificadas por entidad e ID_CI. Los cambios a víctimas registradas se realizan desde Actualización.</p>
        <div class="table-responsive"><table class="table table-sm">
          <thead><tr><th>Registros</th><th>Nuevos</th></tr></thead>
          <tbody>@for (r of p.resumen; track r.tipo) { <tr><th>{{ nombre(r.tipo) }}</th><td>{{ r.altas }}</td></tr> }</tbody>
        </table></div>
        @if (contieneExistentes()) { <p class="alert alert-danger" role="alert">La vista previa contiene registros existentes. Esta carga no debe integrarse: rechácela y utilice Actualización de víctimas.</p> }
      </section>
    } @else {
      <p class="alert alert-warning" role="alert">No hay una vista previa disponible. Actualice el estado para revisarla antes de aceptar. Puede rechazar la carga.</p>
    }
  `,
  styles: [`
    .previa { border: 1px solid #ded3e5; border-left: 4px solid #6f2c91; padding: 1rem; margin: 1rem 0; background: #fcfaff; }
    h3 { font-size: 1.1rem; font-weight: 700; } p { margin: .75rem 0; } summary { cursor: pointer; font-weight: 600; }
    thead th { background: #6f2c91; color: white; } td { overflow-wrap: anywhere; white-space: pre-wrap; max-width: 320px; }
    .actualizacion { color: #8b4a00; font-weight: 700; } .cambios { max-height: 400px; }
  `],
})
export class BanciVistaPreviaComponent {
  previa = input<BanciVistaPrevia | null | undefined>();
  contieneExistentes(): boolean { return !!this.previa()?.resumen.some(r => r.actualizaciones > 0 || r.sinCambio > 0); }
  nombre(tipo: string): string { return ({ CARPETA: 'Carpetas', DELITO: 'Delitos', VICTIMA: 'Víctimas' } as Record<string, string>)[tipo] || tipo; }
}
