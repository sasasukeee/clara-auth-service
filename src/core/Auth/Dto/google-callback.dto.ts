import {
  IsNotEmpty,
  IsString,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class GoogleCallbackDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((o: GoogleCallbackDto) => !o.code)
  @IsString()
  @IsNotEmpty()
  id_token?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((o: GoogleCallbackDto) => !o.id_token)
  @IsString()
  @IsNotEmpty()
  code?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((o: GoogleCallbackDto) => !!o.code)
  @IsString()
  @IsNotEmpty()
  state?: string;
}
