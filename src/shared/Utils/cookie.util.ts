import { Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

type SameSiteMode = 'lax' | 'strict' | 'none';

interface BaseAuthCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: SameSiteMode;
  path: '/';
  domain?: string;
}

interface AuthCookieOptions extends BaseAuthCookieOptions {
  maxAge?: number;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function getBaseCookieOptions(): BaseAuthCookieOptions {
  const domain = process.env.COOKIE_DOMAIN;

  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? 'none' : 'lax',
    path: '/',
    ...(domain ? { domain } : {}),
  };
}

function parseDurationToMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) return numeric;

  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i.exec(trimmed);
  if (!match) return undefined;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const multiplier = multipliers[unit];
  if (!multiplier) return undefined;
  return Math.round(amount * multiplier);
}

function getAccessTokenCookieOptions(): AuthCookieOptions {
  const baseOptions = getBaseCookieOptions();
  const maxAge =
    parseDurationToMs(process.env.JWT_ACCESS_TOKEN_EXPIRES_IN) ??
    parseDurationToMs(process.env.ACCESS_TOKEN_COOKIE_MAX_AGE_MS);

  return {
    ...baseOptions,
    ...(maxAge ? { maxAge } : {}),
  };
}

function getRefreshTokenCookieOptions(): AuthCookieOptions {
  const baseOptions = getBaseCookieOptions();
  const maxAge =
    parseDurationToMs(process.env.JWT_REFRESH_TOKEN_EXPIRES_IN) ??
    parseDurationToMs(process.env.REFRESH_TOKEN_COOKIE_MAX_AGE_MS) ??
    7 * 24 * 60 * 60 * 1000;

  return {
    ...baseOptions,
    ...(maxAge ? { maxAge } : {}),
  };
}

export class CookieUtil {
  static setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    const accessTokenOptions = getAccessTokenCookieOptions();
    const refreshTokenOptions = getRefreshTokenCookieOptions();

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessTokenOptions);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshTokenOptions);
  }

  static clearAuthCookies(res: Response): void {
    const baseOptions = getBaseCookieOptions();

    res.clearCookie(ACCESS_TOKEN_COOKIE, baseOptions);
    res.clearCookie(REFRESH_TOKEN_COOKIE, baseOptions);
  }
}
