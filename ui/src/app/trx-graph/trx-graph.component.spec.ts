import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TrxGraphComponent } from './trx-graph.component';

describe('TrxGraphComponent', () => {
  let component: TrxGraphComponent;
  let fixture: ComponentFixture<TrxGraphComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TrxGraphComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TrxGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
