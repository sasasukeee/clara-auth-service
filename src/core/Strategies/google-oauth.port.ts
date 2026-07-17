export interface GoogleOAuthUserProfile {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

export abstract class GoogleOAuthPort {
  abstract getAuthorizationUrl(state?: string, redirectUri?: string): string;

  abstract exchangeCodeForUser(
    code: string,
    redirectUri?: string,
  ): Promise<GoogleOAuthUserProfile>;

  abstract refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }>;
}
