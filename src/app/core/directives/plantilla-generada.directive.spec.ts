import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlantillaGeneradaDirective } from './plantilla-generada.directive';
import { ModuloPlantilla, PlantillasService } from '../services/plantillas.service';
import { ArchivoCargaTipo } from '../types/archivo-carga.types';

@Component({ imports: [PlantillaGeneradaDirective], template: '<a [plantillaModulo]="modulo" [plantillaArchivo]="archivo">Descargar plantilla</a>' })
class PlantillaPrueba
{
    modulo: ModuloPlantilla = 'mensual';
    archivo: ArchivoCargaTipo = 'carpetas';
}

describe('Plantillas vacías generadas', () =>
{
    beforeEach(() =>
    {
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:plantilla');
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    });
    afterEach(() =>
    {
        TestBed.inject(HttpTestingController).verify();
        vi.restoreAllMocks();
    });
    for(const modulo of ['mensual', 'federal', 'semanal'] as const)
    for(const archivo of ['carpetas', 'delitos', 'victimas'] as const)
    {
        it(`${modulo}/${archivo}: solicita la plantilla a la API y no a un archivo estático`, () =>
        {
            const f = TestBed.createComponent(PlantillaPrueba);
            f.componentInstance.modulo = modulo;
            f.componentInstance.archivo = archivo;
            f.detectChanges();
            const enlace = f.nativeElement.querySelector('a') as HTMLAnchorElement;
            enlace.dispatchEvent(new MouseEvent('click', { cancelable: true }));
            enlace.dispatchEvent(new MouseEvent('click', { cancelable: true }));
            expect(TestBed.inject(PlantillasService).descargando()).toBe(`${modulo}/${archivo}`);
            const peticion = TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith(`/plantillas/${modulo}/${archivo}`));
            expect(peticion.request.responseType).toBe('blob');
            peticion.flush(new Blob(['plantilla']));
            expect(TestBed.inject(PlantillasService).descargando()).toBeNull();
            expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
        });
    }
});
