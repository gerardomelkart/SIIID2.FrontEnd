import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { describe,it,expect,vi,afterEach } from 'vitest';
import { BanciCruceService } from './banci-cruce.service';
import { ActualizacionService } from './actualizacion.service';
import { FederalActualizacionService } from './federal-actualizacion.service';
import { SessionService } from './session.service';
import { CatalogosService } from './catalogos.service';
import { CargaInicial } from '../../pages/carga-inicial/carga-inicial';
import { FederalCarga } from '../../pages/federal-carga/federal-carga';
import { Actualizacion } from '../../pages/actualizacion/actualizacion';
import { FederalActualizacion } from '../../pages/federal-actualizacion/federal-actualizacion';
afterEach(()=>TestBed.resetTestingModule());
for(const [nombre,Tipo] of [['mensual',CargaInicial],['federal',FederalCarga],['mensual',Actualizacion],['federal',FederalActualizacion]] as const) {
 describe(`${Tipo.name}: actualización BANCI antes del acuse de decisión`,()=>{
  for(const continuar of [true,false]) it(`espera la revisión y ${continuar?'continúa':'conserva pendiente'} sin confirmar`,async()=>{
   let resolver!:(valor:boolean)=>void;
   const cruce={ofrecer:vi.fn(()=>new Promise<boolean>(r=>resolver=r))};
   const api={descargarAcusePrevio:vi.fn(()=>EMPTY),confirmarCarga:vi.fn(),confirmarActualizacion:vi.fn()};
   const sanitizer={} as DomSanitizer,router={} as Router;
   TestBed.configureTestingModule({providers:[{provide:BanciCruceService,useValue:cruce},{provide:ActualizacionService,useValue:api},{provide:FederalActualizacionService,useValue:api},{provide:SessionService,useValue:{usuario:()=>null,esSuperUsuario:()=>false}},{provide:CatalogosService,useValue:{}},{provide:DomSanitizer,useValue:sanitizer},{provide:Router,useValue:router}]});
   const c=TestBed.runInInjectionContext(()=>Tipo===CargaInicial?new CargaInicial(api as any,sanitizer,router):Tipo===FederalCarga?new FederalCarga(api as any,sanitizer,router):Tipo===Actualizacion?new Actualizacion():new FederalActualizacion());
   const tarea=(c as unknown as {abrirAcusePrevio(r:string):Promise<void>}).abrirAcusePrevio('REF');
   expect(cruce.ofrecer).toHaveBeenCalledWith('REF',nombre);expect(api.descargarAcusePrevio).not.toHaveBeenCalled();
   resolver(continuar);await tarea;
   expect(api.descargarAcusePrevio).toHaveBeenCalledTimes(continuar?1:0);
   expect(api.confirmarCarga).not.toHaveBeenCalled();expect(api.confirmarActualizacion).not.toHaveBeenCalled();
  });
 });
}
