import { ApiProperty } from '@nestjs/swagger';
import { POLL_RULES } from './polls.entity';

export class PollOptionView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Verde' }) label: string;
  @ApiProperty({ type: Number, nullable: true, description: 'Votos de la opción. Es null mientras la votación está abierta: solo se ve cuántas personas votaron.' }) votes: number | null;
  @ApiProperty({ type: [String], nullable: true, description: 'Quiénes eligieron la opción. Solo en votaciones públicas ya cerradas; en las anónimas siempre es null.' }) voters: string[] | null;
}

export class PollView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: '¿Pintamos la sala?' }) title: string;
  @ApiProperty({ example: '' }) description: string;
  @ApiProperty({ enum: POLL_RULES }) rule: string;
  @ApiProperty() anonymous: boolean;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) closes_at: string | Date | null;
  @ApiProperty({ enum: ['open', 'closed'] }) status: string;
  @ApiProperty({ example: 'Miguel', description: 'Quien abrió la votación.' }) creator: string;
  @ApiProperty({ type: String, format: 'date-time' }) created_at: string | Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) closed_at: string | Date | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Opción elegida por quien consulta; es lo único que ve de los votos mientras está abierta.' }) my_option_id: string | null;
  @ApiProperty({ example: 2, description: 'Cuántas personas han votado.' }) voters: number;
  @ApiProperty({ example: 3, description: 'Integrantes habilitados: los activos hoy, o los que había al cerrar si ya cerró.' }) eligible: number | null;
  @ApiProperty({ description: 'true si la votación está abierta y quien consulta la creó o es administrador.' }) can_close: boolean;
  @ApiProperty({ type: [PollOptionView] }) options: PollOptionView[];
}
