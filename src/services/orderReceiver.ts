import { config } from './../config';
// This service implements the following strategy:
// - Puts the order to the processing queue

import * as amqp from 'amqplib';
import * as uuid from 'uuid';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import { OrderType, Order, OrderStatus } from '../types/order';
import { AmqpExchange } from '../types/amqpRoutes';

export interface OrderReceiverParams {
  amqpClient: amqp.Connection;
}
export const orderReceiver = async ({ amqpClient }: OrderReceiverParams) => {
  const channel = await amqpClient.createChannel();
  await channel.assertExchange(AmqpExchange.ORDERS, 'fanout');
  console.log('receiver started');
  createPair();

  const app = express();
  app.use(bodyParser.json());

  app.post('/', async (req, res) => {
    await processOrder({ order: req.body });
    return res.json({ received: true });
  });
  app.listen(+config.PORT || 8080);

  return Object.freeze({
    processOrder,
    shutdown,
    app,
  });

  async function shutdown() {
    await channel.close();
  }

  async function createPair() {
    await processOrder({order: {
      type: OrderType.SELL,
      amount: 1,
      price: 100,
    }});
    await processOrder({order: {
      type: OrderType.BUY,
      amount: 1,
      price: 100,
    }});
    setTimeout(createPair, 1);
  }

  async function processOrder({ order }: { order: Partial<Order> }) {
    order.id = order.id || uuid.v4();
    order.status = OrderStatus.NEW;
    order.initial_amount = order.amount;
    order.created_at = new Date();
    const stringifiedOrder = JSON.stringify(order);
    return channel.publish(
      AmqpExchange.ORDERS,
      ``,
      Buffer.from(stringifiedOrder, 'utf8'),
    );
  }
};
