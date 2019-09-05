import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AddressAnalyticsComponent } from './address-analytics.component';

describe('AddressAnalyticsComponent', () => {
  let component: AddressAnalyticsComponent;
  let fixture: ComponentFixture<AddressAnalyticsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AddressAnalyticsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AddressAnalyticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
