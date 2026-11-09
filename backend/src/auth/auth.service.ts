import { BadRequestException, Injectable, HttpException, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { HomeAccessService } from '../access/home-access.service';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './auth.dto';
import { SessionUser } from './auth.entity';
import { hashPassword, hashToken, token, verifyPassword } from './passwords';

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly db: DatabaseService,
    private readonly access: HomeAccessService,
  ) {}

  async register(data: RegisterDto) {
    const passwordHash = await hashPassword(data.password);
    const value = token();
    await this.db.transaction(async client => {
      const user = await this.repository.create(data.name, data.email, passwordHash, client);
      await this.repository.createSession(user.id, hashToken(value), client);
    });
    return value;
  }

  async login(email: string, password: string) {
    if (await this.repository.countAttempt(email) > 10) {
      throw new HttpException('Demasiados intentos. Espera 15 minutos y vuelve a intentarlo.', 429);
    }
    const user = await this.repository.findByEmail(email);
    if (!user || !await verifyPassword(password, user.password_hash)) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }
    await this.repository.clearAttempts(email);
    const value = token();
    await this.repository.createSession(user.id, hashToken(value));
    return value;
  }

  currentUser(value: string) {
    if (!/^[a-f0-9]{64}$/.test(value)) return Promise.resolve(null);
    return this.repository.currentUser(hashToken(value));
  }

  async session(user: SessionUser) {
    const homes = await this.repository.homesFor(user.id);
    return {
      user: { id: user.id, name: user.name, email: user.email },
      homes,
      activeHomeId: homes.some(home => home.id === user.active_home_id) ? user.active_home_id : (homes[0]?.id ?? null),
    };
  }

  async logout(user: SessionUser) {
    await this.repository.logout(user.sessionHash);
    return { message: 'Sesión cerrada.' };
  }

  async profile(user: SessionUser, name: string) {
    await this.repository.rename(user.id, name);
    return { message: 'Perfil actualizado.' };
  }

  async changePassword(user: SessionUser, current: string, password: string) {
    const value = token();
    await this.db.transaction(async client => {
      const stored = await this.repository.passwordFor(user.id, client);
      if (!stored || !await verifyPassword(current, stored)) throw new BadRequestException('La contraseña actual no coincide.');
      await this.repository.changePassword(user.id, await hashPassword(password), client);
      await this.repository.createSession(user.id, hashToken(value), client);
    });
    return value;
  }

  async closeAccount(user: SessionUser, current: string) {
    await this.db.transaction(async client => {
      const stored = await this.repository.passwordFor(user.id, client);
      if (!stored || !await verifyPassword(current, stored)) throw new BadRequestException('La contraseña actual no coincide.');
      await this.access.requireAccountCanClose(user.id, client);
      await this.repository.closeAccount(user.id, client);
    });
    return { message: 'Cuenta cerrada.' };
  }
}
