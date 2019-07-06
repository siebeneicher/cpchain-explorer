import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TrxStreamgraphComponent } from './trx-streamgraph.component';

describe('TrxStreamgraphComponent', () => {
  let component: TrxStreamgraphComponent;
  let fixture: ComponentFixture<TrxStreamgraphComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TrxStreamgraphComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TrxStreamgraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
