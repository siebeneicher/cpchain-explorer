import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RnodesRoiGraphComponent } from './rnodes-roi-graph.component';

describe('RnodesRoiGraphComponent', () => {
  let component: RnodesRoiGraphComponent;
  let fixture: ComponentFixture<RnodesRoiGraphComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RnodesRoiGraphComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RnodesRoiGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
