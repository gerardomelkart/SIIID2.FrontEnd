import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResumenValidacion } from './resumen-validacion';

describe('ResumenValidacion', () => {
  let component: ResumenValidacion;
  let fixture: ComponentFixture<ResumenValidacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResumenValidacion],
    }).compileComponents();

    fixture = TestBed.createComponent(ResumenValidacion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
