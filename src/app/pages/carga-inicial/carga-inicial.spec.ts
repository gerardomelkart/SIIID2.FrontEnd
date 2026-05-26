import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CargaInicial } from './carga-inicial';

describe('CargaInicial', () => {
  let component: CargaInicial;
  let fixture: ComponentFixture<CargaInicial>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CargaInicial],
    }).compileComponents();

    fixture = TestBed.createComponent(CargaInicial);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
