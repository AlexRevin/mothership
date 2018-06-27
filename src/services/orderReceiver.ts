// This service implements the following strategy:
// - Puts the order to the processing queue
import { config } from './../config';
import * as amqp from 'amqplib';
import * as uuid from 'uuid';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import { OrderType, Order, OrderStatus } from '../types/order';
import { AmqpExchange, OrdersPersistenceMessage } from '../types/amqpRoutes';

export interface OrderReceiverParams {
  amqpClient: amqp.Connection;
}
export const orderReceiver = async ({ amqpClient }: OrderReceiverParams) => {
  const channel = await amqpClient.createChannel();
  await channel.assertExchange(AmqpExchange.ORDERS, 'fanout');

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

  async function processOrder({ order }: { order: Partial<Order> }) {
    const { price, amount, type } = order;
    const data: OrdersPersistenceMessage = {
      OpType: 'NEW',
      data: {
        price, amount, type,
        id: order.id || uuid.v4(),
        status: OrderStatus.NEW,
        initial_amount: order.amount,
        created_at: new Date(),
      },
    };
    const stringifiedOrder = JSON.stringify(data);
    return channel.publish(
      AmqpExchange.ORDERS,
      ``,
      Buffer.from(stringifiedOrder, 'utf8'),
    );
  }
};
