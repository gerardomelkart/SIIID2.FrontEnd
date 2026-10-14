import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { InformesService } from '../../core/services/informes.service';

import { Informes } from './informes';

describe('Informes', () =>
{
    let component: Informes;
    let fixture: ComponentFixture<Informes>;
    let informesService: { obtenerPeriodosEnvios: ReturnType<typeof vi.fn> };

    beforeEach(async () =>
    {
        informesService = { obtenerPeriodosEnvios: vi.fn(() => of([])) };
        await TestBed.configureTestingModule({
            imports: [Informes],
            // La prueba de inicio recibe datos locales; no realiza solicitudes a la API.
            providers: [provideRouter([]), { provide: InformesService, useValue: informesService }],
        }).compileComponents();

        fixture = TestBed.createComponent(Informes);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('inicializa la pantalla y termina la carga sin registros', () =>
    {
        expect(component).toBeTruthy();
        expect(informesService.obtenerPeriodosEnvios).toHaveBeenCalled();
        expect(component.reporteActivo()).toBe('ENVIOS');
        expect(component.envios()).toEqual([]);
        expect(component.cargandoEnvios()).toBe(false);
    });
});
