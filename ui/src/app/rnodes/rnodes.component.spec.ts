import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RnodesComponent } from './rnodes.component';

describe('RnodesComponent', () => {
  let component: RnodesComponent;
  let fixture: ComponentFixture<RnodesComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RnodesComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RnodesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
