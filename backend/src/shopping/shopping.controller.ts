import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user';
import { SessionUser } from '../auth/auth.entity';
import { SessionGuard } from '../auth/session.guard';
import { uuidPipe } from '../common/params';
import { ApiData, ApiErrors, ApiHomeQuery, ApiIdParam, CreatedResponse, MessageResponse } from '../common/swagger';
import { ShoppingItemDto, UpdateShoppingItemDto } from './shopping.dto';
import { ShoppingItemView } from './shopping.responses';
import { ShoppingService } from './shopping.service';

@ApiTags('Lista de compras')
@ApiCookieAuth()
@ApiErrors([401])
@UseGuards(SessionGuard)
@Controller('shopping')
export class ShoppingController {
  constructor(private readonly shopping: ShoppingService) {}

  @Get()
  @ApiOperation({ summary: 'Listar los productos: pendientes agrupados por categoría y comprados al final' })
  @ApiHomeQuery()
  @ApiData(ShoppingItemView, 'Productos del apartamento con quién los agregó, los compró o debe comprarlos.', { isArray: true })
  @ApiErrors([400, 403], { 400: 'Falta `homeId` o no es un identificador válido.', 403: 'Quien consulta no pertenece al apartamento.' })
  list(@CurrentUser() user: SessionUser, @Query('homeId') homeId?: string) {
    return this.shopping.list(user.id, homeId);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Agregar un producto a la lista, opcionalmente asignado a un comprador' })
  @ApiHomeQuery()
  @ApiData(CreatedResponse, 'Producto agregado como pendiente.')
  @ApiErrors([400, 403], { 400: 'Datos inválidos o comprador que no es integrante activo del apartamento.', 403: 'Quien agrega no pertenece al apartamento.' })
  create(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined, @Body() data: ShoppingItemDto) {
    return this.shopping.create(user, homeId, data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un producto o cambiar su estado: marcar comprado registra quién lo compró' })
  @ApiIdParam('Identificador del producto.')
  @ApiData(MessageResponse, 'Producto actualizado.')
  @ApiErrors([400, 403, 404], {
    400: 'Cuerpo vacío, datos inválidos o comprador que no es integrante activo.',
    403: 'Solo quien agregó el producto o un administrador puede editar sus datos; cambiar el estado lo puede hacer cualquier integrante.',
    404: 'El producto no existe o está eliminado.',
  })
  update(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string, @Body() data: UpdateShoppingItemDto) {
    return this.shopping.update(user, id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un producto de forma reversible; quien lo agregó o un administrador' })
  @ApiIdParam('Identificador del producto.')
  @ApiData(MessageResponse, 'Producto eliminado. Se puede deshacer con la ruta de restauración.')
  @ApiErrors([400, 403, 404], { 403: 'Solo quien agregó el producto o un administrador puede eliminarlo.', 404: 'El producto no existe o ya está eliminado.' })
  remove(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string) {
    return this.shopping.remove(user, id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deshacer la eliminación de un producto; quien lo agregó o un administrador' })
  @ApiIdParam('Identificador del producto eliminado.')
  @ApiData(MessageResponse, 'Producto restaurado.')
  @ApiErrors([400, 403, 404], { 403: 'Solo quien agregó el producto o un administrador puede restaurarlo.', 404: 'No hay un producto eliminado con ese identificador.' })
  restore(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string) {
    return this.shopping.restore(user, id);
  }
}
