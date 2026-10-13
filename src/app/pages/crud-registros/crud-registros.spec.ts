import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { UsuariosService } from '../../core/services/usuarios.service';
import { CatalogosService } from '../../core/services/catalogos.service';

import { CrudRegistros } from './crud-registros';

describe('CrudRegistros', () => {
  let component: CrudRegistros;
  let fixture: ComponentFixture<CrudRegistros>;
  let usuariosService: { obtenerUsuarios: ReturnType<typeof vi.fn> };
  let catalogosService: {
    obtenerEntidadesFederativas: ReturnType<typeof vi.fn>;
    obtenerRoles: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    usuariosService = { obtenerUsuarios: vi.fn(() => of({ usuarios: [] })) };
    catalogosService = {
      obtenerEntidadesFederativas: vi.fn(() => of([])),
      obtenerRoles: vi.fn(() => of([])),
    };
    await TestBed.configureTestingModule({
      imports: [CrudRegistros],
      // La prueba de inicio recibe datos locales; no realiza solicitudes a la API.
      providers: [
        { provide: UsuariosService, useValue: usuariosService },
        { provide: CatalogosService, useValue: catalogosService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CrudRegistros);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('inicializa la pantalla y termina la carga sin registros', () => {
    expect(component).toBeTruthy();
    expect(usuariosService.obtenerUsuarios).toHaveBeenCalledWith(false);
    expect(catalogosService.obtenerEntidadesFederativas).toHaveBeenCalled();
    expect(catalogosService.obtenerRoles).toHaveBeenCalled();
    expect(component.usuarios()).toEqual([]);
    expect(component.cargando()).toBe(false);
  });
});
