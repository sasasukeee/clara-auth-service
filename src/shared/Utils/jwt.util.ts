import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { sign, verify, JwtPayload as BaseJwtPayload, SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';

export interface JwtPayload extends BaseJwtPayload {
  sub: string; // user id
  [key: string]: unknown; // ekstra payload alanları (role, email, device vs.)
}

@Injectable()
export class JwtUtil {
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly issuer: string;
  private readonly accessAudience?: string;
  private readonly refreshAudience?: string;
  private readonly keyId?: string;

  private readonly accessTokenExpiresIn: StringValue =
    (process.env.JWT_ACCESS_TOKEN_EXPIRES_IN ?? '15m') as StringValue;

  private readonly refreshTokenExpiresIn: StringValue =
    (process.env.JWT_REFRESH_TOKEN_EXPIRES_IN ?? '7d') as StringValue;

  constructor() {
    const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH ?? './private.key';
    const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH ?? './public.key';
    this.issuer = process.env.JWT_ISSUER ?? 'auth-service';
    this.accessAudience = process.env.JWT_ACCESS_AUDIENCE;
    this.refreshAudience = process.env.JWT_REFRESH_AUDIENCE;
    this.keyId = process.env.JWT_KEY_ID;

    // PRIVATE KEY (jwt sign için)
    const envPrivKey = process.env.JWT_PRIVATE_KEY;
    if (envPrivKey) {
      this.privateKey = envPrivKey.replace(/\\n/g, '\n');
    } else {
      this.privateKey = readFileSync(privateKeyPath, 'utf8');
    }

    // PUBLIC KEY (jwt verify için)
    const envPubKey = process.env.JWT_PUBLIC_KEY;
    if (envPubKey) {
      this.publicKey = envPubKey.replace(/\\n/g, '\n');
    } else {
      this.publicKey = readFileSync(publicKeyPath, 'utf8');
    }
  }

  // ------------------------------------------------------------------------
  // ACCESS TOKEN SIGN (RS256)
  // ------------------------------------------------------------------------
  signAccessToken(
    payload: JwtPayload,
    options: Omit<SignOptions, 'expiresIn' | 'algorithm'> = {},
  ): string {
    const baseOptions: SignOptions = {
      algorithm: 'RS256',
      expiresIn: this.accessTokenExpiresIn,
      issuer: this.issuer,
      ...this.accessAudience ? { audience: this.accessAudience } : {},
      ...this.keyId ? { keyid: this.keyId } : {},
    };

    return sign(
      payload,
      this.privateKey,
      {
        ...baseOptions,
        ...options,
      },
    );
  }

  // ------------------------------------------------------------------------
  // REFRESH TOKEN SIGN (RS256)
  // ------------------------------------------------------------------------
  signRefreshToken(
    payload: JwtPayload,
    options: Omit<SignOptions, 'expiresIn' | 'algorithm'> = {},
  ): string {
    const baseOptions: SignOptions = {
      algorithm: 'RS256',
      expiresIn: this.refreshTokenExpiresIn,
      issuer: this.issuer,
      ...this.refreshAudience ? { audience: this.refreshAudience } : {},
      ...this.keyId ? { keyid: this.keyId } : {},
    };

    return sign(
      payload,
      this.privateKey,
      {
        ...baseOptions,
        ...options,
      },
    );
  }

  // ------------------------------------------------------------------------
  // ACCESS TOKEN VERIFY (public key)
  // ------------------------------------------------------------------------
  verifyAccessToken(token: string): JwtPayload {
    return verify(token, this.publicKey, {
      algorithms: ['RS256'],
      issuer: this.issuer,
      ...this.accessAudience ? { audience: this.accessAudience } : {},
    }) as JwtPayload;
  }

  // ------------------------------------------------------------------------
  // REFRESH TOKEN VERIFY (public key)
  // ------------------------------------------------------------------------
  verifyRefreshToken(token: string): JwtPayload {
    return verify(token, this.publicKey, {
      algorithms: ['RS256'],
      issuer: this.issuer,
      ...this.refreshAudience ? { audience: this.refreshAudience } : {},
    }) as JwtPayload;
  }
}
