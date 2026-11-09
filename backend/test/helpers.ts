import { Provider, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PoolClient } from 'pg';

export const client = {} as PoolClient;
export const user = { id: '00000000-0000-4000-8000-000000000001', name: 'Juan', email: 'juan@roomie.test', sessionHash: 'hash-sesion', active_home_id: null };
export const homeId = '00000000-0000-4000-8000-000000000010';
export const memberId = '00000000-0000-4000-8000-000000000020';
export const database = () => ({ transaction: jest.fn((work: (db: PoolClient) => Promise<unknown>) => work(client)) });

export async function service<T>(type: Type<T>, providers: Provider[]) {
  const testingModule = await Test.createTestingModule({ providers: [type, ...providers] }).compile();
  return testingModule.get(type);
}
