import { Transform } from 'class-transformer';
import {
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isEmail } from 'class-validator';

@ValidatorConstraint({ name: 'isEmailOrUsername', async: false })
class IsEmailOrUsernameConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;

    if (isEmail(trimmed)) return true;

    return trimmed.length >= 1 && trimmed.length <= 32;
  }

  defaultMessage(): string {
    return 'usernameOrEmail must be a valid email or a username (max 32 chars)';
  }
}

export class LoginDto {
  @Transform(({ value, obj }) => (value ?? obj?.email ?? obj?.username)?.trim?.())
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  @Validate(IsEmailOrUsernameConstraint)
  usernameOrEmail!: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  password!: string;
}

