import { Module } from '@nestjs/common';
import { AuthModule } from './core/Auth/Login/auth.module';
import { SessionsModule } from './core/Sessions/Refresh/sessions.module';

@Module({
  imports: [AuthModule, SessionsModule],
})
export class AppModule { }
