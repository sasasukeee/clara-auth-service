import { Injectable } from '@nestjs/common';
import { GithubOAuthPort, GithubOAuthUserProfile } from './github-oauth.port';

@Injectable()
export class GithubStrategy implements GithubOAuthPort {
  private readonly clientId =
    process.env.GITHUB_CLIENT_ID ?? '';
  private readonly clientSecret =
    process.env.GITHUB_CLIENT_SECRET ?? '';
  private readonly callbackUrl =
    process.env.GITHUB_CALLBACK_URL ?? '';

  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      scope: 'read:user user:email',
      allow_signup: 'true',
    });

    if (state) {
      params.set('state', state);
    }

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForUser(
    code: string,
    redirectUri?: string,
  ): Promise<GithubOAuthUserProfile> {
    const redirect = redirectUri ?? this.callbackUrl;

    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: redirect,
        }),
      },
    );

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange GitHub code for token');
    }

    const tokenJson = (await tokenResponse.json()) as {
      access_token?: string;
    };

    if (!tokenJson.access_token) {
      throw new Error('No access token received from GitHub');
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch GitHub user');
    }

    const userJson = (await userResponse.json()) as {
      id: number;
      login?: string;
      avatar_url?: string;
      email?: string;
      name?: string;
    };

    let email = userJson.email;

    if (!email) {
      const emailsResponse = await fetch(
        'https://api.github.com/user/emails',
        {
          headers: {
            Authorization: `Bearer ${tokenJson.access_token}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );

      if (emailsResponse.ok) {
        const emailsJson = (await emailsResponse.json()) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;

        const primary = emailsJson.find(
          (e) => e.primary && e.verified,
        );

        email = primary?.email ?? emailsJson[0]?.email ?? undefined;
      }
    }

    return {
      id: String(userJson.id),
      email,
      displayName: userJson.name ?? userJson.login,
      avatarUrl: userJson.avatar_url,
    };
  }

  async refreshAccessToken(
    _refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    throw new Error('GitHub does not support refresh tokens');
  }
}
