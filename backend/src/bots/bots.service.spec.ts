import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BotsService } from './bots.service';

describe('BotsService', () => {
  let service: BotsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotsService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('storage/') },
        },
        {
          provide: 'SEQUELIZE',
          useValue: { models: { BotModel: {} } },
        },
      ],
    }).compile();

    service = module.get<BotsService>(BotsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
