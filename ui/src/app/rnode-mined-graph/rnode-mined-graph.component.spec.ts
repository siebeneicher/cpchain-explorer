import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RnodeMinedGraphComponent } from './rnode-mined-graph.component';

describe('RnodeMinedGraphComponent', () => {
  let component: RnodeMinedGraphComponent;
  let fixture: ComponentFixture<RnodeMinedGraphComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RnodeMinedGraphComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RnodeMinedGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
