import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Informes } from './informes';

describe('Informes', () => {
  let component: Informes;
  let fixture: ComponentFixture<Informes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Informes],
    }).compileComponents();

    fixture = TestBed.createComponent(Informes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
