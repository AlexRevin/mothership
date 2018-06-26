import { UUID } from '../config';

export interface Order {
  id: UUID;
  type: OrderType;
  price: number;
  initial_amount: number;
  amount: number;
  status: OrderStatus;
  created_at: Date;
  updated_at: Date;
  closed_at: Date;
}

export enum OrderType {
  SELL = 'sell',
  BUY = 'buy',
}

export enum OrderStatus {
  NEW,
  PROCESSING,
  COMPLETED,
  VOID,
}
