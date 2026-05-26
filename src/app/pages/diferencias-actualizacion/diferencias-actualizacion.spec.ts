import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DiferenciasActualizacion } from './diferencias-actualizacion';

describe('DiferenciasActualizacion', () => {
  let component: DiferenciasActualizacion;
  let fixture: ComponentFixture<DiferenciasActualizacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiferenciasActualizacion],
    }).compileComponents();

    fixture = TestBed.createComponent(DiferenciasActualizacion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
