import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from '../Dto/login.dto';
import { RefreshDto } from '../../Sessions/Dto/refresh.dto';
import {
  ACCESS_TOKEN_COOKIE,
  CookieUtil,
  REFRESH_TOKEN_COOKIE,
} from '../../../shared/Utils/cookie.util';
import { GoogleCallbackDto } from '../Dto/google-callback.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  private getFrontendOrigin(req: Request): string {
    const fromEnv = process.env.FRONTEND_ORIGIN?.trim();
    if (fromEnv) {
      return fromEnv.replace(/\/+$/, '');
    }

    const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '')
      .split(',')[0]
      .trim();
    const forwardedHost = String(req.headers['x-forwarded-host'] ?? '')
      .split(',')[0]
      .trim();
    const forwardedPort = String(req.headers['x-forwarded-port'] ?? '')
      .split(',')[0]
      .trim();

    const protocol = forwardedProto || req.protocol;
    let host = forwardedHost || req.get('host') || '';

    if (
      host &&
      !host.includes(':') &&
      forwardedPort &&
      !['80', '443'].includes(forwardedPort)
    ) {
      host = `${host}:${forwardedPort}`;
    }

    return `${protocol}://${host}`;
  }

  @Get('oauth/google')
  async googleOAuthRedirectLegacy(@Res() res: Response) {
    res.setHeader('location', '/auth/google');
    return res.status(HttpStatus.FOUND).send();
  }

  @Get('google')
  async googleOAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const frontendOrigin = this.getFrontendOrigin(req);
    const redirectUri = new URL(
      '/auth/oauth/google/callback',
      frontendOrigin,
    ).toString();

    const state = this.authService.createOAuthState();

    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      ...(process.env.COOKIE_DOMAIN
        ? { domain: process.env.COOKIE_DOMAIN }
        : {}),
      maxAge: 10 * 60 * 1000,
    });

    const authorizationUrl =
      this.authService.getGoogleAuthorizationUrlWithRedirectUri(
        state,
        redirectUri,
      );

    res.setHeader('location', authorizationUrl);
    return res.status(HttpStatus.FOUND).send();
  }

  @Get('google/callback')
  async googleOAuthCallback(@Req() req: Request, @Res() res: Response) {
    const frontendOrigin = this.getFrontendOrigin(req);
    const callbackUrl = new URL(
      '/auth/oauth/google/callback',
      frontendOrigin,
    );

    const requestUrl = new URL(
      req.originalUrl,
      `${req.protocol}://${req.get('host')}`,
    );
    callbackUrl.search = requestUrl.search;

    res.setHeader('location', callbackUrl.toString());
    return res.status(HttpStatus.FOUND).send();
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } =
      await this.authService.loginWithUsernameOrPassword(dto);

    CookieUtil.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return {
      success: true,
      user,
      tokens,
    };
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@Req() req: Request) {
    const authorization = req.headers.authorization?.trim();
    const bearerToken =
      authorization?.toLowerCase().startsWith('bearer ')
        ? authorization.slice('bearer '.length).trim()
        : undefined;

    const accessToken =
      bearerToken ?? this.getCookie(req, ACCESS_TOKEN_COOKIE);

    if (!accessToken) {
      throw new UnauthorizedException('Access token missing');
    }

    const user = await this.authService.me(accessToken);

    return {
      success: true,
      user,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      this.getCookie(req, REFRESH_TOKEN_COOKIE) ?? dto.refreshToken;

    if (!refreshToken) {
      throw new BadRequestException('Refresh token missing');
    }

    const { user, tokens } = await this.authService.refreshTokens(
      refreshToken,
    );

    CookieUtil.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return {
      success: true,
      user,
      tokens,
    };
  }

  @Post('oauth/google/callback')
  @HttpCode(HttpStatus.OK)
  async googleCallback(
    @Body() dto: GoogleCallbackDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (dto.id_token) {
      const { user, tokens } =
        await this.authService.loginWithGoogleIdToken(dto.id_token);

      CookieUtil.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      return {
        success: true,
        user,
        tokens,
      };
    }

    const expectedState = this.getCookie(req, 'oauth_state');
    res.clearCookie('oauth_state', {
      path: '/',
      ...(process.env.COOKIE_DOMAIN
        ? { domain: process.env.COOKIE_DOMAIN }
        : {}),
    });

    if (!dto.code || !dto.state || !expectedState || dto.state !== expectedState) {
      throw new BadRequestException('INVALID_OAUTH_STATE');
    }

    const frontendOrigin = this.getFrontendOrigin(req);
    const redirectUri = new URL(
      '/auth/oauth/google/callback',
      frontendOrigin,
    ).toString();

    const { user, tokens } =
      await this.authService.loginWithGoogleAuthorizationCode(
        dto.code,
        redirectUri,
      );

    CookieUtil.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return {
      success: true,
      user,
      tokens,
    };
  }

  private getCookie(req: Request, name: string): string | undefined {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return undefined;

    for (const part of cookieHeader.split(';')) {
      const [key, ...valueParts] = part.trim().split('=');
      if (key === name) {
        return decodeURIComponent(valueParts.join('='));
      }
    }

    return undefined;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    CookieUtil.clearAuthCookies(res);

    return {
      success: true,
    };
  }
}
