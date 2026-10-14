import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { UsuariosService } from '../../core/services/usuarios.service';

import { Configuracion } from './configuracion';

describe('Configuracion', () =>
{
    let component: Configuracion;
    let fixture: ComponentFixture<Configuracion>;
    let usuariosService: { obtenerUsuarios: ReturnType<typeof vi.fn> };

    beforeEach(async () =>
    {
        usuariosService = { obtenerUsuarios: vi.fn(() => of({ usuarios: [] })) };
        await TestBed.configureTestingModule({
            imports: [Configuracion],
            // La prueba de inicio recibe datos locales; no realiza solicitudes a la API.
            providers: [{ provide: UsuariosService, useValue: usuariosService }],
        }).compileComponents();

        fixture = TestBed.createComponent(Configuracion);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('inicializa la pantalla y termina la carga sin registros', () =>
    {
        expect(component).toBeTruthy();
        expect(usuariosService.obtenerUsuarios).toHaveBeenCalledWith(true);
        expect(component.usuarios()).toEqual([]);
        expect(component.cargando()).toBe(false);
    });
});
