import { HttpException } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { ApiController } from './api/api.controller';
import { ProjectManagementController } from './projects/management/project-management.controller';
import { AiModelsController } from './ai-models/ai-models.controller';

describe('API contract snapshots', () => {
  it('auth.login returns expected shape', async () => {
    const controller = new AuthController({
      login: jest.fn().mockResolvedValue({
        user: { id: 'u1' },
        accessToken: 'a',
        refreshToken: 'r',
      }),
    } as any);

    const response = await controller.login({} as any, {
      email: 'a@a.com',
      password: 'x',
    } as any);

    expect(response).toEqual({
      status: true,
      user: { id: 'u1' },
      accessToken: 'a',
      refreshToken: 'r',
      next: '/bots/create',
    });
  });

  it('api.upload-file returns expected shape', async () => {
    const controller = new ApiController(
      {} as any,
      {
        uploadFileForRetrieval: jest.fn().mockResolvedValue({ dbFileId: 'f1' }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const response = await controller.uploadFile(
      {
        file: [{ buffer: Buffer.from('abc'), originalname: 'a.txt' }],
      },
      { user: { id: 'u1' } } as any,
      null,
    );

    expect(response).toEqual({
      status: true,
      data: {
        id: 'f1',
        file_name: 'a.txt',
        createdAt: expect.any(String),
      },
      message: 'File uploaded and ingested successfully.',
    });
  });

  it('api.upload-file throws when file missing', async () => {
    const controller = new ApiController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      controller.uploadFile({}, { user: { id: 'u1' } } as any, null),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('api.list-of-conversations returns data envelope', async () => {
    const controller = new ApiController(
      {} as any,
      {} as any,
      {} as any,
      {
        getConversationsList: jest.fn().mockResolvedValue({ c1: { id: 'c1' } }),
      } as any,
      {} as any,
    );

    const response = await controller.listConversations({
      project_id: 'p1',
    });

    expect(response).toEqual({ data: { c1: { id: 'c1' } } });
  });

  it('project-management.knowledge-base returns status+data', async () => {
    const controller = new ProjectManagementController(
      {} as any,
      {} as any,
      {
        getCompiledKnowledge: jest.fn().mockResolvedValue('compiled text'),
      } as any,
    );

    const response = await controller.getAllKnowledgeRaw(
      { user: { id: 'u1' } } as any,
      'p1',
    );

    expect(response).toEqual({ status: true, data: 'compiled text' });
  });

  it('ai-models.getAll returns status+data', async () => {
    const controller = new AiModelsController({
      getAll: jest.fn().mockResolvedValue([{ id: 'm1' }]),
    } as any);

    const response = await controller.getAll();
    expect(response).toEqual({ status: true, data: [{ id: 'm1' }] });
  });
});
