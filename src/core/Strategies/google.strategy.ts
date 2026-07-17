import { Injectable } from '@nestjs/common';
import { GoogleOAuthPort, GoogleOAuthUserProfile } from './google-oauth.port';

@Injectable()
export class GoogleStrategy implements GoogleOAuthPort {
  private readonly clientId =
    process.env.GOOGLE_CLIENT_ID ?? '';
  private readonly clientSecret =
    process.env.GOOGLE_CLIENT_SECRET ?? '';
  private readonly callbackUrl =
    process.env.GOOGLE_OAUTH_CALLBACK_URL ??
    process.env.GOOGLE_CALLBACK_URL ??
    '';

  getAuthorizationUrl(state?: string, redirectUri?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri ?? this.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });

    if (state) {
      params.set('state', state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForUser(
    code: string,
    redirectUri?: string,
  ): Promise<GoogleOAuthUserProfile> {
    const redirect = redirectUri ?? this.callbackUrl;

    const tokenResponse = await fetch(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: redirect,
          grant_type: 'authorization_code',
        }),
      },
    );

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const tokenJson = (await tokenResponse.json()) as {
      id_token?: string;
      access_token?: string;
    };

    if (!tokenJson.id_token && !tokenJson.access_token) {
      throw new Error('No tokens received from Google');
    }

    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${
            tokenJson.id_token ?? tokenJson.access_token
          }`,
        },
      },
    );

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch Google user info');
    }

    const profile = (await userInfoResponse.json()) as {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    return {
      id: profile.sub,
      email: profile.email,
      displayName: profile.name,
      avatarUrl: profile.picture,
    };
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const response = await fetch(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      },
    );

    if (!response.ok) {
      throw new Error('Failed to refresh Google access token');
    }

    const json = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    return {
      accessToken: json.access_token,
      expiresIn: json.expires_in,
    };
  }
}
