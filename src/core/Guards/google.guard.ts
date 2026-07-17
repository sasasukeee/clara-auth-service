import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class GoogleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      Request & { query: Record<string, string | string[]> }
    >();

    const code = request.query['code'];

    if (!code) {
      throw new UnauthorizedException('Missing Google authorization code');
    }

    return true;
  }
}
