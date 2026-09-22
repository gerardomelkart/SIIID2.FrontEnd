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
            <select class="form-select" [attr.id]="idCampo(campo.clave)" [ngModel]="datos()[campo.clave] || ''" (ngModelChange)="cambiar(campo.clave, $event)" [ngModelOptions]="{ standalone: true }" [disabled]="bloqueado()" [required]="!!campo.obligatorio">
              <option value="">Seleccione...</option>
              @for (opcion of opciones(campo.clave); track opcion.clave) { <option [value]="opcion.clave">{{ opcion.clave }} · {{ opcion.descripcion }}</option> }
            </select>
          } @else if (campo.tipo === 'textarea') {
            <textarea class="form-control" [attr.id]="idCampo(campo.clave)" rows="3" [ngModel]="datos()[campo.clave] || ''" (ngModelChange)="cambiar(campo.clave, $event)" [ngModelOptions]="{ standalone: true }" [disabled]="bloqueado()" [attr.maxlength]="campo.maximo" [required]="!!campo.obligatorio"></textarea>
          } @else if (regla(campo.clave); as r) {
            <input class="form-control" [attr.id]="idCampo(campo.clave)" type="text" [attr.inputmode]="r.decimal ? 'decimal' : 'numeric'" [value]="datos()[campo.clave] || ''" (input)="capturarNumero(campo.clave, $event)" [disabled]="bloqueado()" [attr.maxlength]="r.longitud" [attr.pattern]="r.patron" [required]="!!campo.obligatorio" [attr.title]="r.ayuda" />
            <small>{{ r.ayuda }}</small>
          } @else {
            <input class="form-control" [attr.id]="idCampo(campo.clave)" [type]="campo.tipo" [ngModel]="datos()[campo.clave] || ''" (ngModelChange)="cambiar(campo.clave, $event)" [ngModelOptions]="{ standalone: true }" [disabled]="bloqueado()" [attr.maxlength]="campo.maximo" [required]="!!campo.obligatorio" [attr.step]="campo.tipo === 'time' ? 1 : null" />
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
  private readonly contadores = new Set(['ord_apreh', 'fgran', 'ctaon', 'td_v_ap', 'proc_abrev', 'juc_oral', 'td_sen_con', 'no_ejer_acc_pnal', 'otra']);
  campos = input.required<BanciFormularioCampo[]>();
  datos = input.required<Record<string, string>>();
  catalogos = input.required<BanciFormularioOpcion[]>();
  bloqueado = input(false);
  idPrefijo = input('');

  idCampo(clave: string): string | null {
    return this.idPrefijo() ? `${this.idPrefijo()}-${clave}` : null;
  }

  regla(campo: string): { decimal: boolean; longitud: number; patron: string; maximo: number; ayuda: string } | null {
    if (campo === 'edad') return { decimal: false, longitud: 3, patron: '(?:[0-9]{1,2}|1[01][0-9]|120|999)', maximo: 999, ayuda: 'De 0 a 120 años, o 999 para no identificado.' };
    if (campo === 'dic') return { decimal: false, longitud: 3, patron: '[0-9]{1,3}', maximo: 255, ayuda: 'Entero de 0 a 255; vacío si está pendiente.' };
    if (this.contadores.has(campo)) return { decimal: false, longitud: 10, patron: '[0-9]{1,10}', maximo: 2147483647, ayuda: 'Sólo dígitos; de 0 a 2147483647. Vacío si está pendiente.' };
    if (campo === 'cp') return { decimal: false, longitud: 5, patron: '[0-9]{5}|0', maximo: 99999, ayuda: 'Cinco dígitos (conserve los ceros iniciales), 0 o vacío si no hay información.' };
    if (campo === 'coord_x' || campo === 'coord_y') return { decimal: true, longitud: 12, patron: '-?[0-9]{1,4}(?:[.][0-9]{1,6})?', maximo: 9999.999999, ayuda: 'Decimal con punto y hasta seis decimales; permite signo negativo. Las reglas geográficas se verifican al validar.' };
    return null;
  }

  capturarNumero(campo: string, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const r = this.regla(campo);
    if (!r || this.bloqueado()) return;
    const valor = input.value;
    if (!(r.decimal ? /^-?\d*(?:\.\d{0,6})?$/ : /^\d*$/).test(valor)) input.value = this.datos()[campo] || '';
    else this.datos()[campo] = valor;
    const numero = Number(input.value);
    const fuera = input.value !== '' && (Math.abs(numero) > r.maximo || (campo === 'edad' && numero > 120 && numero !== 999));
    input.setCustomValidity(fuera ? r.ayuda : '');
  }

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
