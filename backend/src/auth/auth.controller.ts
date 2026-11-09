import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto, CurrentPasswordDto, LoginDto, ProfileDto, RegisterDto } from './auth.dto';
import { SessionUser } from './auth.entity';
import { CurrentUser } from './current-user';
import { SessionGuard } from './session.guard';
import { COOKIE } from './passwords';

function setSession(response: Response, value: string) {
  response.cookie(COOKIE, value, { httpOnly: true, sameSite: 'lax', secure: process.env.APP_URL?.startsWith('https://') ?? false, path: '/', maxAge: 604800000 });
}

@ApiTags('Cuentas y sesiones')
@ApiResponse({ status: 200, description: 'Confirmación; registro e ingreso también guardan la cookie de sesión.', schema: { example: { data: { message: 'Sesión iniciada.' } } } })
@ApiResponse({ status: 400, description: 'Datos inválidos o contraseña actual incorrecta.' })
@ApiResponse({ status: 401, description: 'Sesión ausente o credenciales incorrectas.' })
@ApiResponse({ status: 409, description: 'Correo repetido o cuenta con un único administrador.' })
@ApiResponse({ status: 429, description: 'Más de 10 intentos de ingreso en 15 minutos.' })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(200)
  @ApiOperation({ summary: 'Registrar una cuenta y crear su sesión con cookie HttpOnly' })
  async register(@Body() data: RegisterDto, @Res({ passthrough: true }) response: Response) {
    setSession(response, await this.auth.register(data));
    return { message: 'Cuenta creada correctamente.' };
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Iniciar sesión; los intentos fallidos se limitan por correo' })
  async login(@Body() data: LoginDto, @Res({ passthrough: true }) response: Response) {
    setSession(response, await this.auth.login(data.email, data.password));
    return { message: 'Sesión iniciada.' };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Invalidar la sesión actual en la base de datos y borrar su cookie' })
  async logout(@CurrentUser() user: SessionUser, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.logout(user);
    response.clearCookie(COOKIE, { path: '/' });
    return result;
  }

  @Patch('profile')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Cambiar el nombre de la cuenta conectada' })
  profile(@CurrentUser() user: SessionUser, @Body() data: ProfileDto) {
    return this.auth.profile(user, data.name);
  }

  @Patch('password')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Cambiar contraseña y cerrar las sesiones anteriores' })
  async password(@CurrentUser() user: SessionUser, @Body() data: ChangePasswordDto, @Res({ passthrough: true }) response: Response) {
    setSession(response, await this.auth.changePassword(user, data.current, data.password));
    return { message: 'Contraseña actualizada. Se cerraron las otras sesiones.' };
  }

  @Delete('account')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Cerrar la cuenta conservando su historial; no puede dejar hogares sin administrador' })
  async close(@CurrentUser() user: SessionUser, @Body() data: CurrentPasswordDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.closeAccount(user, data.current);
    response.clearCookie(COOKIE, { path: '/' });
    return result;
  }
}

@ApiTags('Cuentas y sesiones')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('session')
export class SessionController {
  constructor(private readonly auth: AuthService) {}
  @Get()
  @ApiOperation({ summary: 'Consultar el perfil público, los hogares autorizados y el hogar activo' })
  @ApiResponse({ status: 200, schema: { example: { data: { user: { id: 'UUID', name: 'Juan', email: 'juan@roomie.test' }, homes: [], activeHomeId: null } } } })
  @ApiResponse({ status: 401, description: 'Se necesita una sesión activa.' })
  session(@CurrentUser() user: SessionUser) { return this.auth.session(user); }
}
