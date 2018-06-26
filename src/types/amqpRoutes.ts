import { Order } from './order';

export enum AmqpExchange {
  ORDERS = 'orders',
  ORDERS_PERSISTENCE = 'orders_persistence',
}

export enum OrdersPersistenceKeys {
  ORDER = 'order.tr',
  ORDER_BOOK = 'order_book.tr',
}

export interface OrdersPersistenceMessage {
  OpType: 'NEW'| 'CLOSE' | 'UPDATE';
  data: Partial<Order>;
}
