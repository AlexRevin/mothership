"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid = require("uuid");
const setup_1 = require("./setup");
const orderMatcher_1 = require("./../services/orderMatcher");
const order_1 = require("./../types/order");
let matcher;
let transactionStorage = [];
const transactionLogger = (orderTransaction) => {
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
        matcher.transactionEmitter.on(orderMatcher_1.TransactionEmitterEvents.CLOSED, (ord) => {
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
        matcher.transactionEmitter.on(orderMatcher_1.TransactionEmitterEvents.CLOSED, () => {
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
        matcher.transactionEmitter.on(orderMatcher_1.TransactionEmitterEvents.TRANSACTION, transactionLogger);
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
        matcher.transactionEmitter.on(orderMatcher_1.TransactionEmitterEvents.TRANSACTION, transactionLogger);
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
        matcher.transactionEmitter.on(orderMatcher_1.TransactionEmitterEvents.TRANSACTION, transactionLogger);
        const buyOrder = createBuyOrder(100, 15);
        const sellOrder = createSellOrder(100, 20);
        const sellAmount = sellOrder.amount - buyOrder.amount;
        for (const order of [buyOrder, sellOrder]) {
            matcher.processOrder(order);
        }
        expect(transactionStorage[0].amount).toEqual(15);
        expect(transactionStorage[0].seller.amount).toEqual(sellAmount);
        expect(buyOrder.status).toEqual(order_1.OrderStatus.COMPLETED);
        expect(sellOrder.status).toEqual(order_1.OrderStatus.NEW);
    });
    it('should fill buy Order with sell orders having 1 left', () => {
        matcher.transactionEmitter.on(orderMatcher_1.TransactionEmitterEvents.TRANSACTION, transactionLogger);
        const sellOrder1 = createSellOrder(125, 45);
        const sellOrder2 = createSellOrder(126, 55);
        const sellOrder3 = createSellOrder(130, 90);
        const buyOrder = createBuyOrder(130, 50);
        [sellOrder1, sellOrder2, sellOrder3, buyOrder].map(matcher.processOrder.bind(matcher));
        expect(transactionStorage.length).toEqual(2);
        expect(transactionStorage[0].amount).toEqual(45);
        expect(transactionStorage[1].amount).toEqual(5);
        expect(sellOrder1.status).toBe(order_1.OrderStatus.COMPLETED);
        expect(sellOrder2.status).toBe(order_1.OrderStatus.NEW);
        expect(sellOrder3.status).toBe(order_1.OrderStatus.NEW);
        expect(buyOrder.status).toBe(order_1.OrderStatus.COMPLETED);
        expect(sellOrder1.amount).toBe(0);
        expect(sellOrder2.amount).toBe(50);
        expect(sellOrder3.amount).toBe(90);
        expect(buyOrder.amount).toBe(0);
    });
    beforeEach(() => __awaiter(this, void 0, void 0, function* () {
        matcher = new orderMatcher_1.OrderMatcher({ amqpClient: setup_1.amqp, mode: 'emitter' });
        transactionStorage = [];
    }));
});
function createBuyOrder(price, amount) {
    return {
        price, amount,
        initial_amount: amount,
        type: order_1.OrderType.BUY,
        id: uuid.v4(),
        created_at: new Date(),
        status: order_1.OrderStatus.NEW,
    };
}
function createSellOrder(price, amount) {
    return {
        price, amount,
        initial_amount: amount,
        type: order_1.OrderType.SELL,
        id: uuid.v4(),
        created_at: new Date(),
        status: order_1.OrderStatus.NEW,
    };
}
//# sourceMappingURL=orderMatcher.test.js.map