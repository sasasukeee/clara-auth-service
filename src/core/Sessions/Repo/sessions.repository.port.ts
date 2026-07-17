export interface Session {
  id: string;
  userId: string;
  refreshToken: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export abstract class SessionsRepositoryPort {
  abstract createSession(
    data: Omit<Session, 'id' | 'createdAt'>,
  ): Promise<Session>;

  abstract findById(id: string): Promise<Session | null>;

  abstract findByRefreshToken(
    refreshToken: string,
  ): Promise<Session | null>;

  abstract deleteById(id: string): Promise<void>;

  abstract deleteAllForUser(userId: string): Promise<void>;
}

