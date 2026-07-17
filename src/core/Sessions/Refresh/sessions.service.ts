import { Injectable } from '@nestjs/common';
import { Session, SessionsRepositoryPort } from '../Repo/sessions.repository.port';

@Injectable()
export class SessionsService {
  constructor(
    private readonly sessionsRepository: SessionsRepositoryPort,
  ) { }

  async create(
    data: Omit<Session, 'id' | 'createdAt'>,
  ): Promise<Session> {
    return this.sessionsRepository.createSession(data);
  }

  async findByRefreshToken(
    refreshToken: string,
  ): Promise<Session | null> {
    return this.sessionsRepository.findByRefreshToken(refreshToken);
  }

  async deleteById(id: string): Promise<void> {
    await this.sessionsRepository.deleteById(id);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.sessionsRepository.deleteAllForUser(userId);
  }
}
