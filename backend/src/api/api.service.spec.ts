import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;

  beforeEach(() => {
    service = new ApiService(
      { models: { BotModel: {} } } as any,
      {} as any,
      {
        get: jest.fn((key: string, fallback?: string) => fallback || key),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
