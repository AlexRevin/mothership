import * as amqp from 'amqplib';
import { EventEmitter } from 'events';

import { OrderType, OrderStatus, Order } from './../types/order';
import { OrderReceiverParams } from './orderReceiver';
import { createInMemOrderStorage } from '../types/inMemOrderStorage';
import { OrderTransaction } from '../types/orderTransaction';
import { AmqpExchange, OrdersPersistenceMessage, OrdersPersistenceKeys } from '../types/amqpRoutes';

interface OrderMatcherParams extends OrderReceiverParams {
  mode: 'emitter' | 'amqp';
}
interface storeTransactionParams {
  buyer: Partial<Order>;
  seller: Partial<Order>;
  amount: number;
}
export enum TransactionEmitterEvents {
  CLOSED = 'order_closed',
  UPDATED = 'order_updated',
  TRANSACTION = 'order_transaction',
}
export class OrderMatcher {
  public shutdownFlag = false;
  private amqpClient: amqp.Connection;
  private incomingChannel: amqp.Channel;
  private outgoingChannel: amqp.Channel;
  public buyOrderStorage = createInMemOrderStorage();
  public sellOrderStorage = createInMemOrderStorage();
  public transactionEmitter = new EventEmitter();
  public mode: 'emitter' | 'amqp' = 'amqp';

  constructor({ amqpClient, mode }: OrderMatcherParams) {
    this.amqpClient = amqpClient;
    if (mode) {
      this.mode = mode;
    }
  }

  public async startService() {
    this.incomingChannel = await this.amqpClient.createChannel();
    this.outgoingChannel = await this.amqpClient.createChannel();
    await this.incomingChannel.assertExchange(AmqpExchange.ORDERS, 'fanout');
    await this.outgoingChannel.assertExchange(AmqpExchange.ORDERS_PERSISTENCE, 'direct');
    const queue = await this.incomingChannel.assertQueue('matcher', { exclusive: true });
    await this.incomingChannel.bindQueue(queue.queue, AmqpExchange.ORDERS, '');
    await this.incomingChannel.prefetch(100);
    await this.incomingChannel.consume(queue.queue, async (msg) => {
      try {
        const { data }: Partial<OrdersPersistenceMessage> = JSON.parse(msg.content.toString());
        data.created_at = new Date(data.created_at);
        await this.processOrder(data);
        this.incomingChannel.ack(msg);
      } catch (e) {
        console.log(e);
      }
    });
  }

  public closeOrder(order: Partial<Order>) {
    order.closed_at = new Date();
    order.updated_at = null;
    order.status = OrderStatus.COMPLETED;
    order.amount = 0;
    this.removeInMemOrder(order);

    if (this.mode === 'emitter') {
      this.transactionEmitter.emit(TransactionEmitterEvents.CLOSED, order);
    } else {
      const message: OrdersPersistenceMessage = {
        OpType: 'CLOSE',
        data: order,
      };
      return this.outgoingChannel.publish(
        AmqpExchange.ORDERS_PERSISTENCE,
        OrdersPersistenceKeys.ORDER,
        Buffer.from(JSON.stringify(message), 'utf8'),
      );
    }
  }
  public updateOrder(order: Partial<Order>) {
    if (order.status === OrderStatus.COMPLETED) {
      return;
    }
    // console.log('matcher -> persistence (update): ', order.id);
    order.updated_at = new Date();
    if (this.mode === 'emitter') {
      this.transactionEmitter.emit(TransactionEmitterEvents.UPDATED, order);
    } else {
      const message: OrdersPersistenceMessage = {
        OpType: 'UPDATE',
        data: order,
      };
      return this.outgoingChannel.publish(
        AmqpExchange.ORDERS_PERSISTENCE,
        OrdersPersistenceKeys.ORDER,
        Buffer.from(JSON.stringify(message), 'utf8'),
      );
    }
  }

  public processTransaction({ buyer, seller, amount }: storeTransactionParams) {
    const orderTransaction: OrderTransaction = {
      buyer, seller, amount, price: seller.price, time: new Date(),
    };
    if (this.mode === 'emitter') {
      this.transactionEmitter.emit(TransactionEmitterEvents.TRANSACTION, orderTransaction);
    } else {
      this.outgoingChannel.publish(
        AmqpExchange.ORDERS_PERSISTENCE,
        OrdersPersistenceKeys.ORDER_BOOK,
        Buffer.from(JSON.stringify(orderTransaction), 'utf8'),
      );
    }
  }

  public processOrder(order: Partial<Order>) {
    switch (order.type) {
      case OrderType.BUY:
        this.processBuyOrder(order);
        break;
      case OrderType.SELL:
        this.processSellOrder(order);
        break;
    }
  }

  public processSellOrder(order: Partial<Order>) {
    order.status = OrderStatus.PROCESSING;
    while (true) {
      const item = this.buyOrderStorage.maximum();
      if (!item) {
        break;
      }
      if (item.price < order.price) {
        break;
      }
      while (!item.data.isEmpty()) {
        const minimumTimed = item.data.minimum();
        for (const buyOrder of minimumTimed.data.values()) {
          // threadsafe kinda
          if (buyOrder.status === OrderStatus.NEW) {
            buyOrder.status = OrderStatus.PROCESSING;
            if (buyOrder.amount > order.amount) {
              buyOrder.amount = buyOrder.amount - order.amount;
              buyOrder.status = OrderStatus.NEW;
              this.processTransaction({
                buyer: buyOrder, seller: order, amount: order.amount,
              });
              this.closeOrder(order);
              this.updateOrder(buyOrder);
              return;
            }
            if (buyOrder.amount === order.amount) {
              this.processTransaction({
                buyer: buyOrder, seller: order, amount: buyOrder.amount,
              });
              this.closeOrder(order);
              this.closeOrder(buyOrder);
              return;
            }
            if (buyOrder.amount < order.amount) {
              order.amount = order.amount - buyOrder.amount;
              this.processTransaction({
                buyer: buyOrder, seller: order, amount: buyOrder.amount,
              });
              this.closeOrder(buyOrder);
            }
          }
        }
      }
    }
    if (order.amount > 0) {
      order.status = OrderStatus.NEW;
      this.persistInMemOrder(order);
      if (order.amount !== order.initial_amount) {
        this.updateOrder(order);
      }
    }
  }

  public processBuyOrder(order: Partial<Order>) {
    // fetching orders from storage unless the max price hit
    order.status = OrderStatus.PROCESSING;
    while (true) {
      const item = this.sellOrderStorage.minimum();
      if (!item) {
        break;
      }
      if (item.price > order.price) {
        break;
      }
      while (!item.data.isEmpty()) {
        const minimumTimed = item.data.minimum();
        for (const sellOrder of minimumTimed.data.values()) {
          // threadsafe kinda
          if (sellOrder.status === OrderStatus.NEW) {
            sellOrder.status = OrderStatus.PROCESSING;
            if (sellOrder.amount > order.amount) {
              sellOrder.amount = sellOrder.amount - order.amount;
              sellOrder.status = OrderStatus.NEW;
              this.processTransaction({
                buyer: order, seller: sellOrder, amount: order.amount,
              });
              this.closeOrder(order);
              this.updateOrder(sellOrder);
              return;
            }
            if (sellOrder.amount === order.amount) {
              this.processTransaction({
                buyer: order, seller: sellOrder, amount: sellOrder.amount,
              });
              this.closeOrder(order);
              this.closeOrder(sellOrder);
              return;
            }
            if (sellOrder.amount < order.amount) {
              order.amount = order.amount - sellOrder.amount;
              this.processTransaction({
                buyer: order, seller: sellOrder, amount: sellOrder.amount,
              });
              this.closeOrder(sellOrder);
            }
          }
        }
      }
    }
    if (order.amount > 0) {
      order.status = OrderStatus.NEW;
      this.persistInMemOrder(order);
      if (order.amount !== order.initial_amount) {
        this.updateOrder(order);
      }
    }
  }

  private persistInMemOrder(order: Partial<Order>) {
    const storage = order.type === OrderType.BUY ? this.buyOrderStorage : this.sellOrderStorage;
    storage.persist(order);
  }

  public removeInMemOrder(order: Partial<Order>) {
    const storage = order.type === OrderType.BUY ? this.buyOrderStorage : this.sellOrderStorage;
    storage.remove(order);
  }

  public async shutdown() {
    await this.incomingChannel.close();
    await this.outgoingChannel.close();
  }
}
