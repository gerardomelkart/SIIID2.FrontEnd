import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { BanciCampos } from './banci-campos';

describe('Entidad fija en formulario BANCI', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('oculta el selector y bloquea el manejador de cambio del enlace', async () => {
    const f = TestBed.createComponent(BanciCampos);
    const datos = { id_ent_hchos: '15', id_mun_hchos: '001' };
    f.componentRef.setInput('campos', [{ clave: 'id_ent_hchos', etiqueta: 'Entidad', tipo: 'select' }]);
    f.componentRef.setInput('datos', datos);
    f.componentRef.setInput('catalogos', [{ campo: 'id_ent_hchos', clave: '15', descripcion: 'México' }, { campo: 'id_ent_hchos', clave: '9', descripcion: 'CDMX' }]);
    f.componentRef.setInput('camposFijos', ['id_ent_hchos']);
    f.detectChanges();
    expect(f.nativeElement.querySelector('select')).toBeNull();
    expect(f.nativeElement.querySelector('input').readOnly).toBe(true);
    f.componentInstance.cambiar('id_ent_hchos', '9');
    expect(datos.id_ent_hchos).toBe('15'); expect(datos.id_mun_hchos).toBe('001');
    f.componentRef.setInput('camposFijos', []); f.detectChanges(); await f.whenStable();
    expect(f.nativeElement.querySelector('select').disabled).toBe(false);
    f.componentInstance.cambiar('id_ent_hchos', '9'); expect(datos.id_ent_hchos).toBe('9');
  });
});