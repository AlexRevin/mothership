import * as uuid from 'uuid';
import { amqp } from './setup';
import { OrderMatcher, TransactionEmitterEvents } from './../services/orderMatcher';
import { OrderType, OrderStatus, Order } from './../types/order';
import { OrderTransaction } from '../types/orderTransaction';

let matcher: OrderMatcher;
let transactionStorage: OrderTransaction[] = [];

const transactionLogger = (orderTransaction: OrderTransaction) => {
  transactionStorage.push(orderTransaction);
};

describe('Matcher', () => {
  it('should persist order', () => {
    const order = createBuyOrder(100, 1);
    matcher.processBuyOrder(order);
    const foundByPrice = matcher.buyOrderStorage.storage.search({ price: order.price });
    expect(foundByPrice).not.toBe(undefined);
    const { data } = foundByPrice.data.search({ created_at: +order.created_at });
    expect(data.get(order.id).id).toEqual(order.id);
  });

  it('should remove order', () => {
    const date = new Date();
    const order = createBuyOrder(100, 1);
    matcher.processBuyOrder(order);
    matcher.removeInMemOrder(order);
    expect(matcher.buyOrderStorage.storage.isEmpty()).toBeTruthy();
  });

  it('should not remove all orders', () => {
    const date = new Date();
    const order = createBuyOrder(100, 1);
    const order2 = createBuyOrder(100, 1);
    matcher.processBuyOrder(order);
    matcher.processBuyOrder(order2);
    matcher.removeInMemOrder(order2);
    expect(matcher.buyOrderStorage.storage.isEmpty()).toBeFalsy();
    const found = matcher.buyOrderStorage.storage
    .search({ price: 100 }).data
    .search({ created_at: +date }).data.get(order.id);
    expect(found.id).toEqual(order.id);
  });

  it('should process full buy order', () => {
    const buyOrder = createBuyOrder(100, 1);
    const sellOrder = createSellOrder(100, 1);
    let emitCounter = 0;
    matcher.transactionEmitter.on(TransactionEmitterEvents.CLOSED, (ord) => {
      if (!emitCounter) {
        expect(ord.id).toEqual(sellOrder.id);
        emitCounter += 1;
        return;
      }
      expect(ord.id).toEqual(buyOrder.id);
    });
    matcher.processOrder(buyOrder);
    matcher.processOrder(sellOrder);
  });

  it('should bulk process', (done) => {
    let transactionCounter = 0;
    const timeCounter = +new Date();
    matcher.transactionEmitter.on(TransactionEmitterEvents.CLOSED, () => {
      transactionCounter += 1;
      if (transactionCounter === 2000) {
        console.log('took:', +new Date() - timeCounter, ' ms');
        done();
      }
    });
    for (const i in Array(1000).fill(1)) {
      const order = createSellOrder(100, 1);
      matcher.processOrder(order);
    }
    for (const i in Array(1000).fill(1)) {
      const order = createBuyOrder(100, 1);
      matcher.processOrder(order);
    }
  });
  it('should close 2 sell orders with 1 buy order', () => {
    matcher.transactionEmitter.on(TransactionEmitterEvents.TRANSACTION, transactionLogger);
    const sellOrder1 = createSellOrder(100, 1);
    const sellOrder2 = createSellOrder(100, 1);
    const buyOrder = createBuyOrder(100, 2);
    for (const order of [sellOrder1, sellOrder2, buyOrder]) {
      matcher.processOrder(order);
    }
    expect(transactionStorage.length).toEqual(2);
    expect(transactionStorage[0].buyer.id).toEqual(buyOrder.id);
    expect(transactionStorage[0].seller.id).toEqual(sellOrder1.id);
    expect(transactionStorage[1].seller.id).toEqual(sellOrder2.id);
  });

  it('should close 2 buy orders with 1 sell order', () => {
    matcher.transactionEmitter.on(TransactionEmitterEvents.TRANSACTION, transactionLogger);
    const buyOrder1 = createBuyOrder(100, 1);
    const buyOrder2 = createBuyOrder(100, 1);
    const sellOrder = createSellOrder(100, 2);
    for (const order of [buyOrder1, buyOrder2, sellOrder]) {
      matcher.processOrder(order);
    }
    expect(transactionStorage.length).toEqual(2);
    expect(transactionStorage[0].buyer.id).toEqual(buyOrder1.id);
    expect(transactionStorage[1].buyer.id).toEqual(buyOrder2.id);
    expect(transactionStorage[0].seller.id).toEqual(sellOrder.id);
    expect(transactionStorage[1].seller.id).toEqual(sellOrder.id);
  });

  it('should partially fill sell Order', () => {
    matcher.transactionEmitter.on(TransactionEmitterEvents.TRANSACTION, transactionLogger);
    const buyOrder = createBuyOrder(100, 15);
    const sellOrder = createSellOrder(100, 20);
    const sellAmount = sellOrder.amount - buyOrder.amount;
    for (const order of [buyOrder, sellOrder]) {
      matcher.processOrder(order);
    }
    expect(transactionStorage[0].amount).toEqual(15);
    expect(transactionStorage[0].seller.amount).toEqual(sellAmount);
    expect(buyOrder.status).toEqual(OrderStatus.COMPLETED);
    expect(sellOrder.status).toEqual(OrderStatus.NEW);
  });

  it('should fill buy Order with sell orders having 1 left', () => {
    matcher.transactionEmitter.on(TransactionEmitterEvents.TRANSACTION, transactionLogger);
    const sellOrder1 = createSellOrder(125, 45);
    const sellOrder2 = createSellOrder(126, 55);
    const sellOrder3 = createSellOrder(130, 90);
    const buyOrder = createBuyOrder(130, 50);
    [sellOrder1, sellOrder2, sellOrder3, buyOrder].map(matcher.processOrder.bind(matcher));
    expect(transactionStorage.length).toEqual(2);
    expect(transactionStorage[0].amount).toEqual(45);
    expect(transactionStorage[1].amount).toEqual(5);
    expect(sellOrder1.status).toBe(OrderStatus.COMPLETED);
    expect(sellOrder2.status).toBe(OrderStatus.NEW);
    expect(sellOrder3.status).toBe(OrderStatus.NEW);
    expect(buyOrder.status).toBe(OrderStatus.COMPLETED);
    expect(sellOrder1.amount).toBe(0);
    expect(sellOrder2.amount).toBe(50);
    expect(sellOrder3.amount).toBe(90);
    expect(buyOrder.amount).toBe(0);
  });

  beforeEach(async () => {
    matcher = new OrderMatcher({ amqpClient: amqp, mode: 'emitter' });
    transactionStorage = [];
  });
});

function createBuyOrder(price: number, amount: number): Partial<Order> {
  return {
    price, amount,
    initial_amount: amount,
    type: OrderType.BUY,
    id: uuid.v4(),
    created_at: new Date(),
    status: OrderStatus.NEW,
  };
}

function createSellOrder(price: number, amount: number): Partial<Order> {
  return {
    price, amount,
    initial_amount: amount,
    type: OrderType.SELL,
    id: uuid.v4(),
    created_at: new Date(),
    status: OrderStatus.NEW,
  };
}
