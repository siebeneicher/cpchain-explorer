import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MyRnodeComponent } from './my-rnode.component';

describe('MyRnodeComponent', () => {
  let component: MyRnodeComponent;
  let fixture: ComponentFixture<MyRnodeComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MyRnodeComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MyRnodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
