export interface GithubOAuthUserProfile {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

export abstract class GithubOAuthPort {
  abstract getAuthorizationUrl(state?: string): string;

  abstract exchangeCodeForUser(
    code: string,
    redirectUri?: string,
  ): Promise<GithubOAuthUserProfile>;

  abstract refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }>;
}

