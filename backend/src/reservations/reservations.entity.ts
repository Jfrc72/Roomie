// active=false retira el recurso sin borrar las reservas que lo referencian.
export class Resource {
  id: string;
  home_id: string;
  name: string;
  description: string;
  active: boolean;
  created_at: Date;
}

export class Reservation {
  id: string;
  home_id: string;
  resource_id: string;
  membership_id: string;
  starts_at: Date;
  ends_at: Date;
  status: 'active' | 'cancelled';
  created_at: Date;
  cancelled_at: Date | null;
}

// La reserva como la muestra la API: con el recurso y la persona que reservó.
export interface ReservationRow {
  id: string;
  resource_id: string;
  resource: string;
  user_id: string;
  member: string;
  member_active: boolean;
  starts_at: Date;
  ends_at: Date;
}
