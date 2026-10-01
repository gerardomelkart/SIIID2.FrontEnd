import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import Swal from 'sweetalert2';
import { BanciCruceService } from './banci-cruce.service';
import { SessionService } from './session.service';
import { API_BASE_URL } from '../constants/api-endpoints.constants';
const aceptar = { isConfirmed: true, isDenied: false, isDismissed: false };
const omitir = { isConfirmed: false, isDenied: false, isDismissed: true };
describe('Cruce previo a aceptar o rechazar', () => {
 let service: BanciCruceService, http: HttpTestingController;
 beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: SessionService, useValue: { modulos: () => [], seleccionarModulo: vi.fn() } }] });
  service=TestBed.inject(BanciCruceService); http=TestBed.inject(HttpTestingController);
 });
 afterEach(() => { http.verify(); vi.restoreAllMocks(); });
 for (const activo of [true,false]) it(`sin víctimas y sin bloqueo de permiso continúa (activo=${activo})`,async () => {
  const dialogo=vi.spyOn(Swal,'fire');const tarea=service.ofrecer('CARGA-1');
  const req=http.expectOne(`${API_BASE_URL}/banci/cruce/mensual/CARGA-1/preparar`); expect(req.request.method).toBe('POST');
  req.flush({ activo,puedeActualizar:false,victimas:[] });expect(await tarea).toBe(true);expect(dialogo).not.toHaveBeenCalled();
 });
 it('el caso coincidente ofrece actualizar antes de devolver el control',async () => {
  const dialogo=vi.spyOn(Swal,'fire').mockResolvedValue(omitir);
  const navegar=vi.spyOn(TestBed.inject(Router),'navigate'); const tarea=service.ofrecer('OK');
  http.expectOne(`${API_BASE_URL}/banci/cruce/mensual/OK/preparar`).flush({activo:true,puedeActualizar:true,victimas:[{id_vicf:'V1'}]});
  expect(await tarea).toBe(true); expect(dialogo).toHaveBeenCalledWith(expect.objectContaining({title:'Actualizar datos BANCI',cancelButtonText:'Omitir actualización y continuar'})); expect(navegar).not.toHaveBeenCalled();
 });
 for(const modalidad of ['manual','masiva']) it(`abre ${modalidad} sin abandonar la carga federal`,async () => {
  const dialogo=vi.spyOn(Swal,'fire').mockResolvedValueOnce({isConfirmed:modalidad==='manual',isDenied:modalidad==='masiva',isDismissed:false}).mockResolvedValueOnce(aceptar);
  const navegar=vi.spyOn(TestBed.inject(Router),'navigate');const tarea=service.ofrecer('FED-1','federal');
  http.expectOne(`${API_BASE_URL}/banci/cruce/federal/FED-1/preparar`).flush({activo:true,puedeActualizar:true,victimas:[{id_vicf:'V1'}]});
  expect(await tarea).toBe(true);expect(navegar).not.toHaveBeenCalled();expect(dialogo.mock.calls[1][0]).toEqual(expect.objectContaining({html:expect.stringContaining(`/banci/actualizacion/${modalidad}?cruce=FED-1&amp;moduloCruce=federal&amp;integrado=1`)}));
 });
 it('permiso faltante se informa y permite omitir expresamente',async () => {
  const dialogo=vi.spyOn(Swal,'fire').mockResolvedValue(aceptar);const tarea=service.ofrecer('P');
  http.expectOne(`${API_BASE_URL}/banci/cruce/mensual/P/preparar`).flush({activo:true,puedeActualizar:false,motivo:'Sin permiso',victimas:[]});
  expect(await tarea).toBe(true);expect(dialogo).toHaveBeenCalledWith(expect.objectContaining({text:'Sin permiso'}));
 });
 it('fallo de API conserva pendiente y no habilita la decisión',async () => {
  vi.spyOn(Swal,'fire').mockResolvedValue(aceptar);const tarea=service.ofrecer('ERROR');
  http.expectOne(`${API_BASE_URL}/banci/cruce/mensual/ERROR/preparar`).flush({mensaje:'Reintente'},{status:500,statusText:'Error'});
  expect(await tarea).toBe(false);
 });
 it('rechazo del re-cruce muestra tabla y no habilita la decisión',async () => {
  vi.spyOn(Swal,'fire').mockResolvedValue(aceptar);const bloqueo=vi.spyOn(service,'mostrarBloqueo').mockResolvedValue();const tarea=service.ofrecer('DIFF','federal');
  const errores=[{codigo:'BANCI_OMITIDA',mensaje:'Falta',ntraCi:'CI/1'}];
  http.expectOne(`${API_BASE_URL}/banci/cruce/federal/DIFF/preparar`).flush({errores},{status:400,statusText:'Error'});
  expect(await tarea).toBe(false);expect(bloqueo).toHaveBeenCalledWith(errores,'federal');
 });
 it('plantilla federal recibe entidad seleccionada',() => {
  service.plantilla('FED-1','federal',9).subscribe();http.expectOne(`${API_BASE_URL}/banci/cruce/federal/FED-1/plantilla?entidad=9`).flush(new Blob());
 });
 it('el iframe exige respuesta del origen y ventana correctos antes de continuar', async () => {
  const contenedor=document.createElement('div');
  contenedor.innerHTML='<iframe id="banci-cruce-integrado"></iframe>';
  document.body.append(contenedor);
  const destino=contenedor.querySelector('iframe')!.contentWindow!;
  vi.spyOn(Swal,'getHtmlContainer').mockReturnValue(contenedor);
  const enviar=vi.spyOn(destino,'postMessage').mockImplementation(() => {});
  const tarea=service['comprobarSalida']();
  const solicitud=enviar.mock.calls[0][0].solicitud;
  let terminado=false; void tarea.then(() => terminado=true);
  window.dispatchEvent(new MessageEvent('message',{origin:'https://otro.test',source:destino,data:{tipo:'BANCI_SALIDA',solicitud,permitido:true}}));
  await Promise.resolve(); expect(terminado).toBe(false);
  window.dispatchEvent(new MessageEvent('message',{origin:window.location.origin,source:destino,data:{tipo:'BANCI_SALIDA',solicitud,permitido:true}}));
  expect(await tarea).toBe(true);contenedor.remove();
 });

});
