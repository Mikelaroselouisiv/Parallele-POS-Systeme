import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Auth sync-agent : header `X-Sync-Key` = SYNC_API_KEY.
 * Si SYNC_API_KEY n’est pas défini, refuse toute requête (sauf JWT via autre garde).
 */
@Injectable()
export class SyncApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('SYNC_API_KEY')?.trim();
    if (!expected) {
      throw new UnauthorizedException('SYNC_API_KEY non configurée sur ce nœud');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const provided = String(req.headers['x-sync-key'] ?? '').trim();
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Clé sync invalide');
    }
    return true;
  }
}
