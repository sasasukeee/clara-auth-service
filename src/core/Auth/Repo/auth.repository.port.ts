export type OAuthProvider = 'google' | 'github';

export interface AuthUser {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  roles?: string[];
}

export interface OAuthIdentity {
  provider: OAuthProvider;
  providerId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

export abstract class AuthRepositoryPort {
  abstract findById(id: string): Promise<AuthUser | null>;

  abstract findByEmail(email: string): Promise<AuthUser | null>;

  abstract verifyUser(
    usernameOrEmail: string,
    password: string,
  ): Promise<AuthUser | null>;

  abstract findByOAuthIdentity(
    provider: OAuthProvider,
    providerId: string,
  ): Promise<AuthUser | null>;

  abstract linkOAuthIdentity(
    userId: string,
    identity: OAuthIdentity,
  ): Promise<void>;

  abstract createUserFromOAuth(identity: OAuthIdentity): Promise<AuthUser>;
}
