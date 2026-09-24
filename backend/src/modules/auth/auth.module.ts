import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AccessTokenGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher.service';

type AccessTokenTtl = `${number}${'s' | 'm' | 'h' | 'd'}`;

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('auth.accessTokenSecret'),
        signOptions: {
          expiresIn: configService.getOrThrow<string>('auth.accessTokenTtl') as AccessTokenTtl,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordHasher, AccessTokenGuard],
  exports: [AuthService, AccessTokenGuard],
})
export class AuthModule {}
