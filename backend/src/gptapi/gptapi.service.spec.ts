import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { GptapiService } from './gptapi.service';

describe('GptapiService', () => {
  let service: GptapiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GptapiService,
        {
          provide: HttpService,
          useValue: { post: jest.fn() },
        },
        {
          provide: 'GPT_API_CONFIG',
          useValue: { openrouter_api_key: 'test-key' },
        },
      ],
    }).compile();

    service = module.get<GptapiService>(GptapiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
