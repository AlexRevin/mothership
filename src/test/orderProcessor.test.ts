import { amqp, db } from './setup';
import { orderReceiver } from '../services/orderReceiver';
import { Order, OrderType } from '../types/order';
import { orderProcessor } from '../services/orderProcessor';

describe('Processor', async () => {
  const order: Partial<Order> = {
    type: OrderType.BUY,
    price: 100,
    amount: 1,
  };

  it('should fetch messages', async (done) => {
    const processor = await orderProcessor({ db, amqpClient: amqp });
    processor.emitter.on('order_persisted', async (processedOrder: Order) => {
      expect(processedOrder.amount).toBe(order.amount);
      await processor.shutdown();
      done();
    });
    const receiver = await orderReceiver({ amqpClient: amqp });
    await receiver.processOrder({ order });
    await receiver.shutdown();
  });
});
