import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AccessTokenGuard } from '../src/modules/auth/auth.guard';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';

describe('Authentication HTTP surface (e2e)', () => {
  let app: INestApplication;
  const principal = {
    userId: 'user-1',
    sessionId: 'session-1',
    id: 'user-1',
    email: 'person@example.com',
    phoneNumber: null,
    displayName: 'Person',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  beforeEach(async () => {
    const authService = {
      register: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresIn: '15m',
        user: principal,
      }),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn().mockResolvedValue(undefined),
      validateAccessToken: jest.fn().mockResolvedValue(principal),
    };
    const usersService = {
      updateBasicProfile: jest.fn().mockResolvedValue({
        ...principal,
        displayName: 'Updated Person',
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController, UsersController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        {
          provide: AccessTokenGuard,
          useValue: {
            canActivate: (context: {
              switchToHttp: () => { getRequest: () => { user: unknown } };
            }) => {
              context.switchToHttp().getRequest().user = principal;
              return true;
            },
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('routes registration through the versioned auth API', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    await request(httpServer)
      .post('/api/v1/auth/register')
      .send({
        email: 'person@example.com',
        password: 'a-secure-password',
        displayName: 'Person',
      })
      .expect(201)
      .expect(({ body }: { body: { accessToken: string; user: { email: string } } }) => {
        expect(body.accessToken).toBe('access-token');
        expect(body.user.email).toBe('person@example.com');
      });
  });

  it('protects the current-user surface and strips session internals', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];

    await request(httpServer)
      .get('/api/v1/me')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect(({ body }: { body: Record<string, unknown> }) => {
        expect(body.id).toBe('user-1');
        expect(body).not.toHaveProperty('sessionId');
        expect(body).not.toHaveProperty('userId');
      });
  });
});
