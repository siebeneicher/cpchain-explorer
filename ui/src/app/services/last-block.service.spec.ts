import { TestBed } from '@angular/core/testing';

import { LastBlockService } from './last-block.service';

describe('LastBlockService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: LastBlockService = TestBed.get(LastBlockService);
    expect(service).toBeTruthy();
  });
});
