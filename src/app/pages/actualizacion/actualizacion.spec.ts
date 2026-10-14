import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ActualizacionService } from '../../core/services/actualizacion.service';

import { Actualizacion } from './actualizacion';

describe('Actualizacion', () =>
{
    let component: Actualizacion;
    let fixture: ComponentFixture<Actualizacion>;
    let actualizacionService: { obtenerPeriodosDisponibles: ReturnType<typeof vi.fn> };

    beforeEach(async () =>
    {
        actualizacionService = { obtenerPeriodosDisponibles: vi.fn(() => of([])) };
        await TestBed.configureTestingModule({
            imports: [Actualizacion],
            // La prueba de inicio recibe datos locales; no realiza solicitudes a la API.
            providers: [{ provide: ActualizacionService, useValue: actualizacionService }],
        }).compileComponents();

        fixture = TestBed.createComponent(Actualizacion);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('inicializa la pantalla y termina la carga sin registros', () =>
    {
        expect(component).toBeTruthy();
        expect(actualizacionService.obtenerPeriodosDisponibles).toHaveBeenCalled();
        expect(component.periodosDisponibles()).toEqual([]);
        expect(component.cargandoAniosCorte()).toBe(false);
    });
});
