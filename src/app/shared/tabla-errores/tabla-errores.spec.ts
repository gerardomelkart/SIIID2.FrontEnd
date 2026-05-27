import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TablaErrores } from './tabla-errores';

describe('TablaErrores', () => {
  let component: TablaErrores;
  let fixture: ComponentFixture<TablaErrores>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TablaErrores],
    }).compileComponents();

    fixture = TestBed.createComponent(TablaErrores);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
