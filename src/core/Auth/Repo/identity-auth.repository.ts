import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import {
  AuthRepositoryPort,
  AuthUser,
  OAuthIdentity,
  OAuthProvider,
} from './auth.repository.port';
import { gatewayHttp } from '../../../shared/Http/gateway-http';
import { isEmail } from 'class-validator';

interface IdentityUserResponse {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  username?: string;
  password_hash?: string;
  passwordHash?: string;
  password?: string;
  roles?: string[];
}

@Injectable()
export class IdentityAuthRepository implements AuthRepositoryPort {
  constructor() { }

  async findById(id: string): Promise<AuthUser | null> {
    const res = await gatewayHttp.get<IdentityUserResponse>(
      `/accounts/identity/users/${encodeURIComponent(id)}`,
      { validateStatus },
    );

    if (res.status === 404 || !res.data) {
      return null;
    }

    return this.mapUser(res.data);
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const account = await this.fetchIdentityAccountByEmail(email);

    if (!account) {
      return null;
    }

    return this.mapUser(account);
  }

  async verifyUser(
    usernameOrEmail: string,
    password: string,
  ): Promise<AuthUser | null> {
    const identifier = usernameOrEmail?.trim();
    const account = isEmail(identifier)
      ? await this.fetchIdentityAccountByEmail(identifier)
      : await this.fetchIdentityAccountByUsername(identifier);

    if (!account) {
      return null;
    }

    const passwordHash =
      account.passwordHash ?? account.password_hash ?? account.password;

    if (!passwordHash) {
      throw new Error(
        'Identity account response missing password hash for comparison',
      );
    }

    const isMatch = await bcrypt.compare(password, passwordHash);

    if (!isMatch) {
      return null;
    }

    return this.mapUser(account);
  }

  async findByOAuthIdentity(
    provider: OAuthProvider,
    providerId: string,
  ): Promise<AuthUser | null> {
    // OAuth flow is currently disabled; keep signature for future use.
    return null;
  }

  async linkOAuthIdentity(
    userId: string,
    identity: OAuthIdentity,
  ): Promise<void> {
    // OAuth linking is currently disabled; method kept for future use.
    void userId;
    void identity;
  }

  async createUserFromOAuth(
    identity: OAuthIdentity,
  ): Promise<AuthUser> {
    // OAuth-based user creation is disabled; kept for future implementation.
    throw new Error('OAuth-based user creation is disabled');
  }

  private mapUser(user: IdentityUserResponse): AuthUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? user.username,
      avatarUrl: user.avatarUrl,
      roles: user.roles,
    };
  }

  private async fetchIdentityAccountByEmail(
    email: string,
  ): Promise<IdentityUserResponse | null> {
    const res = await gatewayHttp.get<IdentityUserResponse>(
      `/accounts/identity/email?email=${encodeURIComponent(
        email,
      )}`,
      { validateStatus },
    );

    if (res.status === 404 || !res.data) {
      return null;
    }

    return res.data;
  }

  private async fetchIdentityAccountByUsername(
    username: string,
  ): Promise<IdentityUserResponse | null> {
    const res = await gatewayHttp.get<IdentityUserResponse>(
      `/accounts/identity/username?username=${encodeURIComponent(
        username,
      )}`,
      { validateStatus },
    );

    if (res.status === 404 || !res.data) {
      return null;
    }

    return res.data;
  }
}

function validateStatus(status: number): boolean {
  return status === 404 || status < 400;
}
