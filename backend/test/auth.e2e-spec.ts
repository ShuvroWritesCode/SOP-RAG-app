import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';

describe('Auth + Users (integration, db-backed)', () => {
  let moduleFixture: TestingModule;
  let authService: AuthService;
  let usersService: UsersService;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_DIALECT = 'sqlite';
    process.env.DB_STORAGE = ':memory:';
    process.env.DB_DATABASE = 'test';
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '0';
    process.env.DB_USER = 'test';
    process.env.DB_PASSWORD = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_EXPIRY = '1h';
    process.env.PUBLIC_FILES_STORAGE = 'public/';
    process.env.SEED_DEFAULT_ADMIN = 'false';
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

    const { AppModule } = await import('../src/app.module');

    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    authService = moduleFixture.get(AuthService);
    usersService = moduleFixture.get(UsersService);
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('supports user registration + auth login + refresh with DB persistence', async () => {
    const email = `user_${Date.now()}@example.com`;
    const password = 'StrongPass1!';

    const created = await usersService.registration({ email, password });
    expect(created).toBeDefined();
    expect(created.email).toBe(email);

    const login = await authService.login({ email, password });
    expect(login.user).toBeDefined();
    expect(login.user.email).toBe(email);
    expect(login.accessToken).toBeDefined();
    expect(login.refreshToken).toBeDefined();

    const refreshed = await authService.refreshToken(login.refreshToken);
    expect(refreshed.accessToken).toBeDefined();

    const loaded = await usersService.findById(login.user.id);
    expect(loaded).toBeDefined();
    expect(loaded.email).toBe(email);
  });

  it('supports auth.register flow and stores user in DB', async () => {
    const email = `auth_${Date.now()}@example.com`;
    const password = 'AnotherStrong1!';

    const registered = await authService.register({
      email,
      password,
      username: 'tester',
    });

    expect(registered.user).toBeDefined();
    expect(registered.user.email).toBe(email);
    expect(registered.accessToken).toBeDefined();
    expect(registered.refreshToken).toBeDefined();

    const fromDb = await usersService.findByEmail(email);
    expect(fromDb).toBeDefined();
    expect(fromDb.email).toBe(email);
  });
});
