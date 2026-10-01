import { afterEach, describe, it, expect, vi } from 'vitest';
import Swal from 'sweetalert2';
import { mostrarTablaCruce, textoHtml } from './banci-cruce-tabla';
import * as XLSX from 'xlsx';
vi.mock('xlsx',() => ({utils:{json_to_sheet:vi.fn().mockReturnValue({}),book_new:vi.fn().mockReturnValue({}),book_append_sheet:vi.fn()},writeFile:vi.fn()}));
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); document.body.innerHTML=''; });
describe('Tabla descargable del cruce',() => {
 it('escapa texto capturado por usuarios',() => expect(textoHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
 it('pagina y exporta todas las filas filtradas con detalles largos completos',async () => {
  let popup:HTMLElement;let cerrar:()=>void=()=>{};
  vi.spyOn(Swal,'fire').mockImplementation((async (opciones:any) => {
    popup=document.createElement('div');popup.innerHTML=opciones.html;document.body.appendChild(popup);opciones.didOpen(popup);cerrar=opciones.willClose;
    return {isConfirmed:false,isDenied:false,isDismissed:true};
  }) as any);
  const errores=Array.from({length:123},(_,i)=>({codigo:i<110?'BANCI_OMITIDA':'BANCI_NO_REPORTADA',mensaje:i===0?'X'.repeat(45000):'<script>dato</script>',ntraCi:`CI/${i}`,entidadCruce:9}));
  await mostrarTablaCruce(errores,true,'federal');
  expect(popup!.querySelectorAll('tbody tr')).toHaveLength(50);
  (popup!.querySelector('#cruce-siguiente') as HTMLButtonElement).click();expect(popup!.querySelector('tbody')!.textContent).toContain('CI/50');
  const select=popup!.querySelector('#cruce-filtro') as HTMLSelectElement;select.value='No reportada en BANCI';select.dispatchEvent(new Event('change'));
  expect(popup!.querySelectorAll('tbody tr')).toHaveLength(13);
  (popup!.querySelector('#cruce-excel') as HTMLButtonElement).click();await vi.waitFor(() => expect(XLSX.utils.json_to_sheet).toHaveBeenCalledTimes(1));
  expect(vi.mocked(XLSX.utils.json_to_sheet).mock.calls[0][0]).toHaveLength(13);
  select.value='';select.dispatchEvent(new Event('change'));(popup!.querySelector('#cruce-excel') as HTMLButtonElement).click();await vi.waitFor(() => expect(XLSX.utils.json_to_sheet).toHaveBeenCalledTimes(2));
  const filas=vi.mocked(XLSX.utils.json_to_sheet).mock.calls[1][0];expect(filas).toHaveLength(123);expect(String(filas[0]['Detalle'])+String(filas[0]['Detalle 2'])).toBe('X'.repeat(45000));
  expect(popup!.querySelector('tbody script')).toBeNull();cerrar();
 });
 it('separa y exporta las carpetas registradas en otro período', async () => {
  let popup!: HTMLElement;
  vi.spyOn(Swal,'fire').mockImplementation((async (opciones:any) => {
    popup=document.createElement('div');popup.innerHTML=opciones.html;document.body.appendChild(popup);opciones.didOpen(popup);
    return {isConfirmed:false,isDenied:false,isDismissed:true};
  }) as any);
  await mostrarTablaCruce([
    {codigo:'BANCI_OTRO_PERIODO',ntraCi:'AGOSTO',mensaje:'Consolidado: 2026-09-11; BANCI: 2026-08-11'},
    {codigo:'BANCI_OMITIDA',ntraCi:'SEPTIEMBRE',mensaje:'Falta'},
    {codigo:'BANCI_NO_REPORTADA',ntraCi:'NUEVA',mensaje:'Registrar'}
  ],true,'mensual');
  expect(popup.textContent).toContain('Otro período: 1');
  const select=popup.querySelector('#cruce-filtro') as HTMLSelectElement;
  select.value='Registrada en otro período';select.dispatchEvent(new Event('change'));
  expect(popup.querySelectorAll('tbody tr')).toHaveLength(1);
  expect(popup.querySelector('tbody')!.textContent).toContain('2026-08-11');
  (popup.querySelector('#cruce-excel') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(XLSX.utils.json_to_sheet).toHaveBeenCalledTimes(1));
  expect(vi.mocked(XLSX.utils.json_to_sheet).mock.calls[0][0][0]['Tipo']).toBe('Registrada en otro período');
 });

});
