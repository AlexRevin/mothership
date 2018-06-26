import * as Knex from 'knex';
import { Channel } from 'amqplib';
import { OrderReceiverParams } from './orderReceiver';
import { AmqpExchange, OrdersPersistenceKeys, OrdersPersistenceMessage } from '../types/amqpRoutes';
import { Order } from '../types/order';

export interface OrderPersisterParams extends OrderReceiverParams {
  db: Knex;
}
export const orderPersister = async ({ db, amqpClient }: OrderPersisterParams) => {
  let channel: Channel;
  const ordersStack: OrdersPersistenceMessage[] = [];
  let rps = 0;

  batchPoller();
  metricsCounter();
  channel = await amqpClient.createChannel();
  const queue = await channel.assertQueue('persister');
  await channel.bindQueue(
    queue.queue,
    AmqpExchange.ORDERS_PERSISTENCE,
    OrdersPersistenceKeys.ORDER,
  );
  await channel.prefetch(30);
  await channel.consume(queue.queue, async (msg) => {
    try {
      const order: OrdersPersistenceMessage = JSON.parse(msg.content.toString());
      ordersStack.push(order);
      // await processOrderUpdate(order);
      channel.ack(msg);
    } catch (e) {
      console.log(e);
    }
  });

  function metricsCounter() {
    console.log('rps: ', rps);
    rps = 0;
    setTimeout(metricsCounter, 1000);
  }

  async function batchPoller() {
    const orders = ordersStack.splice(0, 200);
    if (orders.length) {
      // console.log('processing orders with ids: ', orders.map(o => o.data.id));
      await processOrderUpdate(orders);
      rps += orders.length;
    }
    setTimeout(batchPoller, 5);
  }

  async function processOrderUpdate(orderMsgs: OrdersPersistenceMessage[]) {
    const sqlRows: string[] = [];
    for (const orderMsg of orderMsgs) {
      const { amount, status, id, closed_at } = orderMsg.data;
      const updateFields: Partial<Order> = {
        amount, status, updated_at: new Date(),
      };
      if (orderMsg.OpType === 'CLOSE') {
        updateFields.closed_at = closed_at;
      }
      // console.log(`persister -> ${orderMsg.OpType}: `, id);
      sqlRows.push(
        db('order_list').where({ id }).update(updateFields).toString(),
      );
    }
    await db.raw(sqlRows.join(';'));
  }
};
