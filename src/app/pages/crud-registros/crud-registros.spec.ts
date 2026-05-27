import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrudRegistros } from './crud-registros';

describe('CrudRegistros', () => {
  let component: CrudRegistros;
  let fixture: ComponentFixture<CrudRegistros>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrudRegistros],
    }).compileComponents();

    fixture = TestBed.createComponent(CrudRegistros);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
