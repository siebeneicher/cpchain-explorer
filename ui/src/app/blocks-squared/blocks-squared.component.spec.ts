import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { BlocksSquaredComponent } from './blocks-squared.component';

describe('BlocksSquaredComponent', () => {
  let component: BlocksSquaredComponent;
  let fixture: ComponentFixture<BlocksSquaredComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BlocksSquaredComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BlocksSquaredComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
