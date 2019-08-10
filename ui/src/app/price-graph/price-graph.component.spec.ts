import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PriceGraphComponent } from './price-graph.component';

describe('PriceGraphComponent', () => {
  let component: PriceGraphComponent;
  let fixture: ComponentFixture<PriceGraphComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PriceGraphComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PriceGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
