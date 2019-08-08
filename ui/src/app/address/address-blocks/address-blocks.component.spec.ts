import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AddressBlocksComponent } from './address-blocks.component';

describe('AddressBlocksComponent', () => {
  let component: AddressBlocksComponent;
  let fixture: ComponentFixture<AddressBlocksComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AddressBlocksComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AddressBlocksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
