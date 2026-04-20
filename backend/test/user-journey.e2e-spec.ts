import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { ProjectsService } from '../src/projects/projects.service';
import { OpenaiKnowledgeService } from '../src/openai-knowledge/openai-knowledge.service';
import { RagService } from '../src/rag/rag.service';

describe('User Journey (integration, db-backed)', () => {
  let moduleFixture: TestingModule;
  let authService: AuthService;
  let usersService: UsersService;
  let projectsService: ProjectsService;
  let openaiKnowledgeService: OpenaiKnowledgeService;
  let ragService: RagService;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_DIALECT = 'sqlite';
    process.env.DB_STORAGE = ':memory:';
    process.env.DB_DATABASE = 'test';
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '0';
    process.env.DB_USER = 'test';
    process.env.DB_PASSWORD = 'test';
    process.env.JWT_SECRET = 'journey-jwt-secret';
    process.env.JWT_EXPIRY = '1h';
    process.env.PUBLIC_FILES_STORAGE = 'public/';
    process.env.SEED_DEFAULT_ADMIN = 'false';
    delete process.env.OPENROUTER_API_KEY;

    const { AppModule } = await import('../src/app.module');

    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    authService = moduleFixture.get(AuthService);
    usersService = moduleFixture.get(UsersService);
    projectsService = moduleFixture.get(ProjectsService);
    openaiKnowledgeService = moduleFixture.get(OpenaiKnowledgeService);
    ragService = moduleFixture.get(RagService);
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('runs: sign-up -> login -> create project -> upload -> train -> chat', async () => {
    // 1) Sign-up
    const email = `journey_${Date.now()}@example.com`;
    const password = 'JourneyPass1!';
    const user = await usersService.registration({ email, password });
    expect(user).toBeDefined();
    expect(user.email).toBe(email);

    // 2) Login
    const login = await authService.login({ email, password });
    expect(login.accessToken).toBeDefined();
    expect(login.refreshToken).toBeDefined();
    const userId = login.user.id;

    // 3) Create project
    const project = await projectsService.createProject({
      user_id: userId,
      name: 'Journey Project',
    } as any);
    expect(project).toBeDefined();
    expect(project.user_id).toBe(userId);

    // 4) Upload document
    const fileBuffer = Buffer.from(
      'SOP: Always verify invoice totals before posting to ledger.',
      'utf-8',
    );
    const upload = await openaiKnowledgeService.uploadFileForRetrieval(
      project.id,
      fileBuffer,
      'sop.txt',
      userId,
    );
    expect(upload.dbFileId).toBeDefined();

    // 5) Train (no-op fallback path still should succeed)
    const train = await openaiKnowledgeService.trainUploadedFiles(project.id, userId);
    expect(train.success).toBe(true);

    // 6) Chat (without API keys -> fallback response)
    const writes: string[] = [];
    const fakeRes = {
      write: (chunk: string) => writes.push(chunk),
    } as any;

    const answer = await ragService.streamTokens(
      'What should I verify before posting to ledger?',
      [],
      project.id,
      userId,
      '',
      fakeRes,
    );

    expect(answer).toContain('OPENROUTER_API_KEY is not configured');
    expect(writes.length).toBeGreaterThan(0);
  });
});
