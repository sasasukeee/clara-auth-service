import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  BadGatewayException,
} from '@nestjs/common';
import axios, { isAxiosError } from 'axios';
import { randomBytes } from 'node:crypto';
import { SessionsService } from '../../Sessions/Refresh/sessions.service';
import {
  AuthRepositoryPort,
  AuthUser,
  OAuthIdentity,
} from '../Repo/auth.repository.port';
import { JwtUtil } from '../../../shared/Utils/jwt.util';
import { InvalidTokenException } from '../../../shared/Exceptions/invalid-token.exception';
import { SessionNotFoundException } from '../../../shared/Exceptions/session-not-found.exception';
import { LoginDto } from '../Dto/login.dto';
import { PrismaService } from '../../../Prisma/prisma.service';
import { gatewayHttp } from '../../../shared/Http/gateway-http';
import { GoogleStrategy } from '../../Strategies/google.strategy';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepositoryPort,
    private readonly sessionsService: SessionsService,
    private readonly jwtUtil: JwtUtil,
    private readonly prisma: PrismaService,
    private readonly googleStrategy: GoogleStrategy,
  ) { }

  createOAuthState(): string {
    return randomBytes(16).toString('base64url');
  }

  getGoogleAuthorizationUrl(state?: string): string {
    return this.googleStrategy.getAuthorizationUrl(state);
  }

  getGoogleAuthorizationUrlWithRedirectUri(
    state: string | undefined,
    redirectUri: string,
  ): string {
    return this.googleStrategy.getAuthorizationUrl(state, redirectUri);
  }

  async loginWithGoogleAuthorizationCode(
    code: string,
    redirectUri?: string,
  ): Promise<AuthResult> {
    if (!code || typeof code !== 'string') {
      throw new BadRequestException('code missing');
    }

    const { idToken } = await this.exchangeGoogleCodeForTokens(
      code,
      redirectUri,
    );
    const googlePayload = await this.verifyGoogleIdToken(idToken);

    const profile = {
      provider: 'google' as const,
      providerUserId: googlePayload.sub,
      email: googlePayload.email,
      emailVerified: googlePayload.emailVerified,
      name: googlePayload.name,
      picture: googlePayload.picture,
    };

    const resolve = await this.resolveIdentity(profile);

    let userId: string | undefined;

    if (resolve.status === 'FOUND_BY_PROVIDER' && resolve.userId) {
      userId = resolve.userId;
    } else if (resolve.status === 'FOUND_BY_EMAIL' && resolve.userId) {
      const linkingAllowed = resolve.linking?.allowed !== false;
      if (!linkingAllowed) {
        throw new ForbiddenException('LINKING_NOT_ALLOWED');
      }

      await this.linkIdentity(profile, resolve.userId);
      userId = resolve.userId;
    } else if (resolve.status === 'NOT_FOUND') {
      if (!profile.email) {
        throw new BadRequestException('EMAIL_REQUIRED_FOR_SIGNUP');
      }

      userId = await this.signupWithGoogle(profile as {
        provider: 'google';
        providerUserId: string;
        email: string;
        emailVerified?: boolean;
        name?: string;
        picture?: string;
      });
    }

    if (!userId) {
      throw new InternalServerErrorException('Unable to resolve user');
    }

    return this.loginWithUserId(userId);
  }

  async loginWithUsernameOrPassword(
    dto: LoginDto,
  ): Promise<AuthResult> {
    const user = await this.authRepository.verifyUser(
      dto.usernameOrEmail,
      dto.password,
    );
    //console.log(user);
    if (!user) {
      throw new InvalidTokenException(
        'Invalid username/email or password',
      );
    }

    const tokens = await this.issueTokens(user.id);

    return { user, tokens };
  }

  async loginWithOAuth(identity: OAuthIdentity): Promise<AuthResult> {
    throw new InvalidTokenException('OAuth login is currently disabled');
  }

  async loginWithGoogleIdToken(idToken: string): Promise<AuthResult> {
    if (!idToken || typeof idToken !== 'string') {
      throw new BadRequestException('id_token missing');
    }

    const googlePayload = await this.verifyGoogleIdToken(idToken);

    const profile = {
      provider: 'google' as const,
      providerUserId: googlePayload.sub,
      email: googlePayload.email,
      emailVerified: googlePayload.emailVerified,
      name: googlePayload.name,
      picture: googlePayload.picture,
    };

    const resolve = await this.resolveIdentity(profile);

    let userId: string | undefined;

    if (resolve.status === 'FOUND_BY_PROVIDER' && resolve.userId) {
      userId = resolve.userId;
    } else if (
      resolve.status === 'FOUND_BY_EMAIL' &&
      resolve.userId
    ) {
      const linkingAllowed =
        resolve.linking?.allowed !== false;
      if (!linkingAllowed) {
        throw new ForbiddenException('LINKING_NOT_ALLOWED');
      }

      await this.linkIdentity(profile, resolve.userId);
      userId = resolve.userId;
    } else if (resolve.status === 'NOT_FOUND') {
      if (!profile.email) {
        throw new BadRequestException(
          'EMAIL_REQUIRED_FOR_SIGNUP',
        );
      }
      userId = await this.signupWithGoogle(profile as {
        provider: 'google';
        providerUserId: string;
        email: string;
        emailVerified?: boolean;
        name?: string;
        picture?: string;
      });
    }

    if (!userId) {
      throw new InternalServerErrorException(
        'Unable to resolve user',
      );
    }

    const { user, tokens } = await this.loginWithUserId(userId);

    return { user, tokens };
  }

  async refreshTokens(refreshToken: string): Promise<AuthResult> {
    let payload;

    try {
      payload = this.jwtUtil.verifyRefreshToken(refreshToken);
    } catch {
      throw new InvalidTokenException();
    }

    const session = await this.sessionsService.findByRefreshToken(
      refreshToken,
    );

    if (!session || session.userId !== payload.sub) {
      throw new SessionNotFoundException();
    }

    const user = await this.authRepository.findById(payload.sub);
    //console.log(user)
    //console.log(payload,payload.sub
    //)
    if (!user) {
      throw new InvalidTokenException('User for token not found');
    }

    await this.sessionsService.deleteById(session.id);

    const tokens = await this.issueTokens(user.id);

    return { user, tokens };
  }

  async me(accessToken: string): Promise<AuthUser> {
    let payload;

    try {
      payload = this.jwtUtil.verifyAccessToken(accessToken);
    } catch {
      throw new InvalidTokenException();
    }

    const user = await this.authRepository.findById(payload.sub);
    if (!user) {
      throw new InvalidTokenException('USER_NOT_FOUND');
    }

    return user;
  }

  async logoutAllSessions(userId: string): Promise<void> {
    await this.sessionsService.deleteAllForUser(userId);
  }

  private async issueTokens(userId: string): Promise<AuthTokens> {
    const user = await this.authRepository.findById(userId);
    const userRoles =
      user?.roles && user.roles.length > 0
        ? user.roles
        : ['user'];

    const accessToken = this.jwtUtil.signAccessToken({
      sub: userId,
      roles: userRoles,
    });

    const refreshToken = await this.createUniqueRefreshToken(userId);

    return { accessToken, refreshToken };
  }

  private async loginWithUserId(userId: string): Promise<AuthResult> {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new InvalidTokenException('USER_NOT_FOUND');
    }

    const tokens = await this.issueTokens(userId);
    return { user, tokens };
  }

  private getGoogleOAuthCallbackUrl(): string {
    const callbackUrl =
      process.env.GOOGLE_OAUTH_CALLBACK_URL ??
      process.env.GOOGLE_CALLBACK_URL;

    if (!callbackUrl) {
      throw new InternalServerErrorException(
        'GOOGLE_OAUTH_CALLBACK_URL missing',
      );
    }

    return callbackUrl;
  }

  private getGoogleClientSecret(): string {
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientSecret) {
      throw new InternalServerErrorException(
        'GOOGLE_CLIENT_SECRET missing',
      );
    }
    return clientSecret;
  }

  private getGoogleClientId(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new InternalServerErrorException('GOOGLE_CLIENT_ID missing');
    }
    return clientId;
  }

  private async exchangeGoogleCodeForTokens(
    code: string,
    redirectUri?: string,
  ): Promise<{
    idToken: string;
    accessToken?: string;
  }> {
    const tokenUrl = 'https://oauth2.googleapis.com/token';

    try {
      const redirect = redirectUri ?? this.getGoogleOAuthCallbackUrl();
      const response = await axios.post(
        tokenUrl,
        new URLSearchParams({
          code,
          client_id: this.getGoogleClientId(),
          client_secret: this.getGoogleClientSecret(),
          redirect_uri: redirect,
          grant_type: 'authorization_code',
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const data = response.data as {
        id_token?: string;
        access_token?: string;
      };

      if (!data?.id_token) {
        throw new UnauthorizedException('INVALID_GOOGLE_TOKEN');
      }

      return { idToken: data.id_token, accessToken: data.access_token };
    } catch (error) {
      if (isAxiosError(error)) {
        throw new UnauthorizedException('INVALID_GOOGLE_TOKEN');
      }
      throw error;
    }
  }

  private async verifyGoogleIdToken(idToken: string) {
    const clientId = this.getGoogleClientId();
    const tokenInfoUrl =
      'https://oauth2.googleapis.com/tokeninfo';

    try {
      const response = await axios.get(tokenInfoUrl, {
        params: { id_token: idToken },
      });

      const payload = response.data as {
        iss?: string;
        aud?: string;
        exp?: string | number;
        sub?: string;
        email?: string;
        email_verified?: string | boolean;
        name?: string;
        picture?: string;
      };

      if (
        payload.iss !== 'https://accounts.google.com' &&
        payload.iss !== 'accounts.google.com'
      ) {
        throw new UnauthorizedException('INVALID_GOOGLE_TOKEN');
      }

      if (payload.aud !== clientId) {
        throw new UnauthorizedException('INVALID_GOOGLE_TOKEN');
      }

      const exp =
        typeof payload.exp === 'string'
          ? Number(payload.exp)
          : payload.exp;

      if (!exp || exp * 1000 < Date.now()) {
        throw new UnauthorizedException('INVALID_GOOGLE_TOKEN');
      }

      if (!payload.sub) {
        throw new UnauthorizedException('INVALID_GOOGLE_TOKEN');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        emailVerified:
          payload.email_verified === true ||
          payload.email_verified === 'true',
        name: payload.name,
        picture: payload.picture,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (isAxiosError(error) && error.response?.status === 400) {
        throw new UnauthorizedException('INVALID_GOOGLE_TOKEN');
      }

      throw new UnauthorizedException('INVALID_GOOGLE_TOKEN');
    }
  }

  private async resolveIdentity(profile: {
    provider: 'google';
    providerUserId: string;
    email?: string;
    emailVerified?: boolean;
  }) {
    try {
      console.log(profile);

      const res = await gatewayHttp.post<{
        status: 'FOUND_BY_PROVIDER' | 'FOUND_BY_EMAIL' | 'NOT_FOUND';
        userId?: string;
        linking?: { allowed?: boolean };
      }>('/accounts/identity/users/resolve', {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        email: profile.email,
        emailVerified: profile.emailVerified,
      });

      return res.data;

    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data;

        // DEBUG için – bunu prod’da log seviyesine bağlarsın
        console.error('Identity resolve failed', {
          status,
          data,
        });

        // 🔹 Identity endpoint yok
        if (status === 404) {
          throw new BadGatewayException('IDENTITY_ENDPOINT_NOT_FOUND');
        }

        // 🔹 Service-to-service auth yok / geçersiz
        if (status === 401 || status === 403) {
          throw new BadGatewayException('IDENTITY_UNAUTHORIZED');
        }

        // 🔹 Contract / validation hatası
        if (status === 400) {
          throw new BadRequestException({
            message: 'IDENTITY_BAD_REQUEST',
            details: data,
          });
        }

        // 🔹 Identity iç patladı
        if (status && status >= 500) {
          throw new BadGatewayException('IDENTITY_INTERNAL_ERROR');
        }

        // 🔹 Network error, timeout, DNS vs.
        if (!status) {
          throw new BadGatewayException('IDENTITY_UNREACHABLE');
        }
      }

      // Axios dışı bir şeyse (programming error vs.)
      throw error;
    }

  }

  private async linkIdentity(
    profile: {
      provider: 'google';
      providerUserId: string;
      email?: string;
      emailVerified?: boolean;
    },
    userId: string,
  ) {
    try {
      await gatewayHttp.post(
        '/accounts/identity/users/oauth/link',
        {
          userId,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          email: profile.email,
          emailVerified: profile.emailVerified ?? true,
        },
      );
    } catch (error) {
      if (isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new ForbiddenException('LINKING_NOT_ALLOWED');
        }
        if (error.response?.status === 409) {
          throw new ForbiddenException('LINKING_NOT_ALLOWED');
        }
        if (error.response?.status === 404) {
          throw new InvalidTokenException('USER_NOT_FOUND');
        }
        console.log("link error")
        throw new BadGatewayException('IDENTITY_UNAVAILABLE');
      }
      throw error;
    }
  }

  private async signupWithGoogle(profile: {
    provider: 'google';
    providerUserId: string;
    email: string;
    emailVerified?: boolean;
    name?: string;
    picture?: string;
  }): Promise<string> {
    try {
      const res = await gatewayHttp.post<{
        userId: string;
      }>('/accounts/identity/users/create-with-provider', {
        user: {
          email: profile.email,
          username: profile.email,
          emailVerified: profile.emailVerified ?? true,
        },
        provider: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          providerEmail: profile.email,
          providerName: profile.name,
          providerAvatarUrl: profile.picture,
        },
      });

      return res.data.userId;
    } catch (error) {
      if (isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new ForbiddenException('LINKING_NOT_ALLOWED');
        }
        console.log("create prov error")
        throw new BadGatewayException('IDENTITY_UNAVAILABLE');
      }
      throw error;
    }
  }

  private async createUniqueRefreshToken(
    userId: string,
  ): Promise<string> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    for (let attempt = 0; attempt < 3; attempt++) {
      const refreshToken = this.jwtUtil.signRefreshToken({
        sub: userId,
      });

      try {
        await this.sessionsService.create({
          userId,
          refreshToken,
          expiresAt,
        });
        return refreshToken;
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new InternalServerErrorException('FAILED_TO_ISSUE_TOKENS');
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
