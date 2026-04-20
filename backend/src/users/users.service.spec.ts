import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { UsersService } from './users.service';
import { UserModel } from './entities/user.model';
import { BotsService } from 'src/bots/bots.service';
import { OpenaiKnowledgeService } from 'src/openai-knowledge/openai-knowledge.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(UserModel),
          useValue: {},
        },
        {
          provide: BotsService,
          useValue: {},
        },
        {
          provide: OpenaiKnowledgeService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
