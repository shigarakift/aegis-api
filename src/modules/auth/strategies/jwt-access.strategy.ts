import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../../../database/entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  jti?: string;
}

const customBearerExtractor = (req: any): string | null => {
  const authHeader =
    req?.headers?.authorization ||
    req?.headers?.Authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  // Handle standard "Bearer <token>", accidental "Bearer Bearer <token>", or raw "<token>"
  const token = authHeader.replace(/^(Bearer\s+)+/i, '').trim();
  return token || null;
};

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        customBearerExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Sesi tidak valid atau akun Anda sedang dinonaktifkan.',
      );
    }

    return user;
  }
}
