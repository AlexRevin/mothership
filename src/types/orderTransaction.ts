import { Order } from './order';
import { UUID } from '../config';

export interface OrderTransaction {
  buyer: Partial<Order>;
  seller: Partial<Order>;
  time: Date;
  price: number;
  amount: number;
}

export interface OrderTransactionRow {
  buyer: UUID;
  seller: UUID;
  price: number;
  amount: number;
  time: Date;
}
