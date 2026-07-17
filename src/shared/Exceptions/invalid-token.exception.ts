import { UnauthorizedException } from '@nestjs/common';

export class InvalidTokenException extends UnauthorizedException {
  constructor(message = 'Invalid or expired token') {
    super(message);
  }
}
