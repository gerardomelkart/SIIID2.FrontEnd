import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BanciFormularioCampo, BanciFormularioOpcion } from '../../core/models/banci-formulario.models';

@Component({
  selector: 'app-banci-campos',
  imports: [FormsModule],
  template: `
    <div class="campos">
      @for (campo of campos(); track campo.clave) {
        <label [class.ancho]="campo.tipo === 'textarea'">
          <span>{{ campo.etiqueta }} @if (campo.obligatorio) { <b aria-label="obligatorio">*</b> }</span>
          @if (campo.tipo === 'select') {
            <select class="form-select" [ngModel]="datos()[campo.clave] || ''" (ngModelChange)="cambiar(campo.clave, $event)" [ngModelOptions]="{ standalone: true }" [disabled]="bloqueado()" [required]="!!campo.obligatorio">
              <option value="">Seleccione...</option>
              @for (opcion of opciones(campo.clave); track opcion.clave) { <option [value]="opcion.clave">{{ opcion.clave }} · {{ opcion.descripcion }}</option> }
            </select>
          } @else if (campo.tipo === 'textarea') {
            <textarea class="form-control" rows="3" [ngModel]="datos()[campo.clave] || ''" (ngModelChange)="cambiar(campo.clave, $event)" [ngModelOptions]="{ standalone: true }" [disabled]="bloqueado()" [attr.maxlength]="campo.maximo" [required]="!!campo.obligatorio"></textarea>
          } @else {
            <input class="form-control" [type]="campo.tipo" [ngModel]="datos()[campo.clave] || ''" (ngModelChange)="cambiar(campo.clave, $event)" [ngModelOptions]="{ standalone: true }" [disabled]="bloqueado()" [attr.maxlength]="campo.maximo" [required]="!!campo.obligatorio" [attr.step]="campo.tipo === 'time' ? 1 : null" />
          }
          @if (campo.ayuda) { <small>{{ campo.ayuda }}</small> }
        </label>
      }
    </div>
  `,
  styles: [`
    .campos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; font-weight: 600; }
    .ancho { grid-column: 1 / -1; } small { color: #64748b; font-weight: 400; } b { color: #a61b1b; }
    @media (max-width: 1100px) { .campos { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 650px) { .campos { grid-template-columns: 1fr; } }
  `],
})
export class BanciCampos {
  campos = input.required<BanciFormularioCampo[]>();
  datos = input.required<Record<string, string>>();
  catalogos = input.required<BanciFormularioOpcion[]>();
  bloqueado = input(false);

  opciones(campo: string): BanciFormularioOpcion[] {
    return this.catalogos().filter(o => o.campo === campo && (campo !== 'id_mun_hchos' || o.idEntidadFederativa === Number(this.datos()['id_ent_hchos'])));
  }

  cambiar(campo: string, valor: string): void {
    if (this.bloqueado()) return;
    const datos = this.datos();
    datos[campo] = valor;
    if (campo === 'id_ent_hchos') {
      datos['nom_ent_hchos'] = this.opciones(campo).find(o => o.clave === valor)?.descripcion || '';
      datos['id_mun_hchos'] = '';
      datos['nom_mun_hchos'] = '';
    }
    if (campo === 'id_mun_hchos') datos['nom_mun_hchos'] = this.opciones(campo).find(o => o.clave === valor)?.descripcion || '';
  }
}
