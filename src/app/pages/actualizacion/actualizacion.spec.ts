import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Actualizacion } from './actualizacion';

describe('Actualizacion', () => {
  let component: Actualizacion;
  let fixture: ComponentFixture<Actualizacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Actualizacion],
    }).compileComponents();

    fixture = TestBed.createComponent(Actualizacion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
