// This service implements the following strategy:
// - Reads the order from the processing queue
// - Persists it to database

// What could be implemented, but not essential:
// - Storing the entry to hot cache if clients would need order listings

import * as Knex from 'knex';
import { EventEmitter } from 'events';
import { Channel } from 'amqplib';

import { OrderReceiverParams } from './orderReceiver';
import { AmqpExchange, OrdersPersistenceKeys, OrdersPersistenceMessage } from '../types/amqpRoutes';
import { Order } from '../types/order';

export interface OrderProcessorParams extends OrderReceiverParams {
  db: Knex;
}

export const orderProcessor = async ({ amqpClient, db }: OrderProcessorParams) => {

  const emitter = new EventEmitter(); // TODO: remove, it can leak
  const ordersStack: Partial<Order>[] = [];
  let channel: Channel;

  async function startProcessing() {
    batchPoller();
    channel = await amqpClient.createChannel();
    const queue = await channel.assertQueue('processor', { exclusive: true });
    await channel.bindQueue(queue.queue, AmqpExchange.ORDERS, '');
    await channel.bindQueue(
      queue.queue,
      AmqpExchange.ORDERS_PERSISTENCE,
      OrdersPersistenceKeys.ORDER,
    );
    await channel.prefetch(100);
    await channel.consume(queue.queue, async (msg) => {
      try {
        const orderMessage: Partial<OrdersPersistenceMessage> = JSON.parse(msg.content.toString());
        ordersStack.push(orderMessage.data);
        channel.ack(msg);
      } catch (e) {
        console.log(e);
      }
    });
  }

  async function batchPoller() {
    const orders = ordersStack.splice(0, 100);
    if (orders.length) {
      await persistOrders({ orders });
      orders.map(o => emitter.emit('order_persisted', o));
    }
    setTimeout(batchPoller, 20);
  }

  return Object.freeze({
    persistOrders,
    shutdown,
    emitter,
    ordersStack,
    startProcessing,
  });

  async function shutdown() {
    emitter.removeAllListeners();
    if (channel) {
      return channel.close();
    }
  }

  async function persistOrders({ orders }: { orders: Partial<Order>[] }) {
    try {
      return db.batchInsert('order_list', orders);
    } catch (e) {
      console.log(e);
    }
  }
};
