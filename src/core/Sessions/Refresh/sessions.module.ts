import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../Prisma/prisma.module';
import { SessionsRepository } from '../Repo/sessions.repository';
import { SessionsRepositoryPort } from '../Repo/sessions.repository.port';
import { SessionsService } from './sessions.service';

@Module({
  imports: [PrismaModule],
  providers: [
    SessionsService,
    {
      provide: SessionsRepositoryPort,
      useClass: SessionsRepository,
    },
  ],
  exports: [SessionsService, SessionsRepositoryPort],
})
export class SessionsModule { }
