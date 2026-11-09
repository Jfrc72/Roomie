export class Home {
  id: string;
  name: string;
  address: string;
  description: string;
  created_at: Date;
  archived_at: Date | null;
}

export class Membership {
  id: string;
  home_id: string;
  user_id: string;
  role: 'admin' | 'member';
  active: boolean;
  joined_at: Date;
}

export class Invitation {
  id: string;
  home_id: string;
  email: string;
  token_hash: string;
  created_by: string;
  expires_at: Date;
  status: 'pending' | 'accepted' | 'revoked';
}

export interface HomeMember {
  id: string;
  name: string;
  email: string;
  membership_id: string;
  role: 'admin' | 'member';
}
