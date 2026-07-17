import { Module } from '@nestjs/common';
import { SessionsModule } from '../../Sessions/Refresh/sessions.module';
import { JwtUtil } from '../../../shared/Utils/jwt.util';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepositoryPort } from '../Repo/auth.repository.port';
import { IdentityAuthRepository } from '../Repo/identity-auth.repository';
import { GoogleStrategy } from '../../Strategies/google.strategy';

@Module({
  imports: [SessionsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtUtil,
    GoogleStrategy,
    {
      provide: AuthRepositoryPort,
      useClass: IdentityAuthRepository,
    },
  ],
  exports: [AuthService],
})
export class AuthModule { }
