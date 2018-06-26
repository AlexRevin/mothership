import * as Knex from 'knex';
import { Channel } from 'amqplib';
import { OrderReceiverParams } from './orderReceiver';
import { AmqpExchange, OrdersPersistenceKeys, OrdersPersistenceMessage } from '../types/amqpRoutes';
import { Order } from '../types/order';
import { OrderPersisterParams } from './orderPersister';
import { OrderTransaction, OrderTransactionRow } from '../types/orderTransaction';
import { EventEmitter } from 'events';

export interface OrderTransactionPersisterParams extends OrderPersisterParams {}

export const orderTransactionPersister = async (
  { db, amqpClient }: OrderTransactionPersisterParams,
) => {
  const orderTransactionStack: OrderTransactionRow[] = [];
  const emitter = new EventEmitter();
  let channel: Channel;

  batchPoller();

  channel = await amqpClient.createChannel();
  const queue = await channel.assertQueue('transaction_persister', { exclusive: true });
  await channel.bindQueue(
    queue.queue,
    AmqpExchange.ORDERS_PERSISTENCE,
    OrdersPersistenceKeys.ORDER_BOOK,
  );
  await channel.prefetch(100);
  await channel.consume(queue.queue, async (msg) => {
    try {
      const { buyer, seller, amount, price, time }: OrderTransaction =
        JSON.parse(msg.content.toString());

      console.log(`transaction: ${seller.id} -> ${buyer.id}`);
      orderTransactionStack.push({
        amount, price, time,
        buyer: buyer.id,
        seller: seller.id,
      });
      channel.ack(msg);
    } catch (e) {
      console.log(e);
    }
  });

  async function batchPoller() {
    const transactions = orderTransactionStack.splice(0, 100);
    if (transactions.length) {
      await persistOrderTransactions(transactions);
    }
    transactions.map(o => emitter.emit('transaction_persisted', o));
    setTimeout(batchPoller, 20);
  }

  async function persistOrderTransactions(transactions: OrderTransactionRow[]) {
    return db.batchInsert('transaction_log', transactions);
  }
};
