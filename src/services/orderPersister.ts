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
  channel = await amqpClient.createChannel();
  const queue = await channel.assertQueue('persister', { exclusive: true });
  await channel.bindQueue(
    queue.queue,
    AmqpExchange.ORDERS_PERSISTENCE,
    OrdersPersistenceKeys.ORDER,
  );
  await channel.prefetch(10);
  await channel.consume(queue.queue, async (msg) => {
    try {
      const order: OrdersPersistenceMessage = JSON.parse(msg.content.toString());
      await processOrderUpdate(order);
      channel.ack(msg);
    } catch (e) {
      console.log(e);
    }
  });

  async function processOrderUpdate(orderMsg: OrdersPersistenceMessage) {
    const { amount, status, id, closed_at } = orderMsg.data;
    const updateFields: Partial<Order> = {
      amount, status, updated_at: new Date(),
    };
    if (orderMsg.OpType === 'CLOSE') {
      updateFields.closed_at = closed_at;
    }
    console.log(`persister -> ${orderMsg.OpType}: `, id);
    await db('order_list').where({ id }).update(updateFields);
  }
};
