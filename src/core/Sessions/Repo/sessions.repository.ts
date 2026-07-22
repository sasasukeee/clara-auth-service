import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../Prisma/prisma.service';
import { Session, SessionsRepositoryPort } from './sessions.repository.port';
import type { refresh_tokens } from '@prisma/client';

@Injectable()
export class SessionsRepository extends SessionsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createSession(
    data: Omit<Session, 'id' | 'createdAt'>,
  ): Promise<Session> {
    const created = await this.prisma.refresh_tokens.create({
      data: {
        user_id: data.userId,
        refresh_token: data.refreshToken,
        expires_at: data.expiresAt,
        ip_address: data.ipAddress ?? null,
        user_agent: data.userAgent ?? null,
      },
    });

    return this.mapToDomain(created);
  }

  async findById(id: string): Promise<Session | null> {
    const record = await this.prisma.refresh_tokens.findUnique({
      where: { id },
    });

    return record ? this.mapToDomain(record) : null;
  }

  async findByRefreshToken(
    refreshToken: string,
  ): Promise<Session | null> {
    const record = await this.prisma.refresh_tokens.findUnique({
      where: { refresh_token: refreshToken },
    });

    return record ? this.mapToDomain(record) : null;
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.refresh_tokens.delete({
      where: { id },
    });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.refresh_tokens.deleteMany({
      where: { user_id: userId },
    });
  }

  private mapToDomain(record: refresh_tokens): Session {
    return {
      id: record.id,
      userId: record.user_id,
      refreshToken: record.refresh_token,
      createdAt: record.created_at,
      expiresAt: record.expires_at,
      ipAddress: record.ip_address ?? undefined,
      userAgent: record.user_agent ?? undefined,
    };
  }
}

