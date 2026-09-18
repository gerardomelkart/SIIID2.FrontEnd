import { Component, input } from '@angular/core';
import { BanciVistaPrevia } from '../../core/models/banci-carga.models';

@Component({
  selector: 'app-banci-vista-previa',
  template: `
    @if (previa(); as p) {
      <section class="previa" aria-label="Cambios antes de aceptar">
        <h3><i class="fa-solid fa-code-compare"></i> Lo que se integrará al aceptar</h3>
        <p>Las carpetas existentes se identifican por entidad e ID_CI, no por su fecha. Los campos vacíos conservan la información anterior.</p>
        <div class="table-responsive"><table class="table table-sm">
          <thead><tr><th>Registros</th><th>Nuevos</th><th>Se actualizarán</th><th>Sin cambio</th></tr></thead>
          <tbody>@for (r of p.resumen; track r.tipo) { <tr><th>{{ nombre(r.tipo) }}</th><td>{{ r.altas }}</td><td [class.actualizacion]="r.actualizaciones > 0">{{ r.actualizaciones }}</td><td>{{ r.sinCambio }}</td></tr> }</tbody>
        </table></div>
        @if (p.totalCambios > 0) {
          <p class="alert alert-warning" role="status"><strong>Atención: esta carga actualizará información que ya está registrada.</strong> Revise los cambios antes de aceptar; puede rechazar sin modificar esos datos.</p>
          <details><summary>Ver campos que cambiarán ({{ p.cambios.length }} de {{ p.totalCambios }})</summary>
            <p>Se muestran hasta 200 cambios de campo; los totales anteriores incluyen todos los registros.</p>
            <div class="table-responsive cambios"><table class="table table-sm table-bordered">
              <thead><tr><th>Tipo</th><th>Carpeta / delito / víctima</th><th>Campo</th><th>Actual</th><th>Al aceptar</th></tr></thead>
              <tbody>@for (c of p.cambios; track $index) { <tr><td>{{ nombre(c.tipo) }}</td><td>{{ c.idCi }} @if (c.idDelito) { / {{ c.idDelito }} } @if (c.idVictima) { / {{ c.idVictima }} }</td><td>{{ c.campo }}</td><td>{{ c.anterior ?? 'Sin información' }}</td><td>{{ c.nuevo ?? 'Sin información' }}</td></tr> }</tbody>
            </table></div>
          </details>
        } @else { <p>No se modificarán campos de registros existentes.</p> }
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
  nombre(tipo: string): string { return ({ CARPETA: 'Carpetas', DELITO: 'Delitos', VICTIMA: 'Víctimas' } as Record<string, string>)[tipo] || tipo; }
}
