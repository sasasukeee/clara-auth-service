import { UnauthorizedException } from '@nestjs/common';

export class SessionNotFoundException extends UnauthorizedException {
  constructor(message = 'Session not found') {
    super(message);
  }
}
