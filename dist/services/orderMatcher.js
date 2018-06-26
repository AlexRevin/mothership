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
const order_1 = require("./../types/order");
const events_1 = require("events");
const inMemOrderStorage_1 = require("../types/inMemOrderStorage");
const amqpRoutes_1 = require("../types/amqpRoutes");
var TransactionEmitterEvents;
(function (TransactionEmitterEvents) {
    TransactionEmitterEvents["CLOSED"] = "order_closed";
    TransactionEmitterEvents["UPDATED"] = "order_updated";
    TransactionEmitterEvents["TRANSACTION"] = "order_transaction";
})(TransactionEmitterEvents = exports.TransactionEmitterEvents || (exports.TransactionEmitterEvents = {}));
class OrderMatcher {
    constructor({ amqpClient, mode }) {
        this.shutdownFlag = false;
        this.buyOrderStorage = inMemOrderStorage_1.createInMemOrderStorage();
        this.sellOrderStorage = inMemOrderStorage_1.createInMemOrderStorage();
        this.transactionEmitter = new events_1.EventEmitter();
        this.mode = 'amqp';
        this.amqpClient = amqpClient;
        if (mode) {
            this.mode = mode;
        }
    }
    startService() {
        return __awaiter(this, void 0, void 0, function* () {
            this.incomingChannel = yield this.amqpClient.createChannel();
            this.outgoingChannel = yield this.amqpClient.createChannel();
            yield this.incomingChannel.assertExchange(amqpRoutes_1.AmqpExchange.ORDERS, 'fanout');
            yield this.outgoingChannel.assertExchange(amqpRoutes_1.AmqpExchange.ORDERS_PERSISTENCE, 'direct');
            const queue = yield this.incomingChannel.assertQueue('matcher', { exclusive: true });
            yield this.incomingChannel.bindQueue(queue.queue, amqpRoutes_1.AmqpExchange.ORDERS, '');
            yield this.incomingChannel.prefetch(100);
            yield this.incomingChannel.consume(queue.queue, (msg) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const order = JSON.parse(msg.content.toString());
                    order.created_at = new Date(order.created_at);
                    // console.log('matcher: ', order.id);
                    yield this.processOrder(order);
                    this.incomingChannel.ack(msg);
                }
                catch (e) {
                    console.log(e);
                }
            }));
        });
    }
    closeOrder(order) {
        order.closed_at = new Date();
        order.status = order_1.OrderStatus.COMPLETED;
        order.amount = 0;
        this.removeInMemOrder(order);
        // console.log('matcher -> persistence (close): ', order.id);
        if (this.mode === 'emitter') {
            this.transactionEmitter.emit(TransactionEmitterEvents.CLOSED, order);
        }
        else {
            const message = {
                OpType: 'CLOSE',
                data: order,
            };
            return this.outgoingChannel.publish(amqpRoutes_1.AmqpExchange.ORDERS_PERSISTENCE, amqpRoutes_1.OrdersPersistenceKeys.ORDER, Buffer.from(JSON.stringify(message), 'utf8'));
        }
    }
    updateOrder(order) {
        // console.log('matcher -> persistence (update): ', order.id);
        if (this.mode === 'emitter') {
            this.transactionEmitter.emit(TransactionEmitterEvents.UPDATED, order);
        }
        else {
            const message = {
                OpType: 'UPDATE',
                data: order,
            };
            return this.outgoingChannel.publish(amqpRoutes_1.AmqpExchange.ORDERS_PERSISTENCE, amqpRoutes_1.OrdersPersistenceKeys.ORDER, Buffer.from(JSON.stringify(message), 'utf8'));
        }
    }
    processTransaction({ buyer, seller, amount }) {
        const orderTransaction = {
            buyer, seller, amount, price: seller.price, time: new Date(),
        };
        if (this.mode === 'emitter') {
            this.transactionEmitter.emit(TransactionEmitterEvents.TRANSACTION, orderTransaction);
        }
        else {
            this.outgoingChannel.publish(amqpRoutes_1.AmqpExchange.ORDERS_PERSISTENCE, amqpRoutes_1.OrdersPersistenceKeys.ORDER_BOOK, Buffer.from(JSON.stringify(orderTransaction), 'utf8'));
        }
    }
    processOrder(order) {
        switch (order.type) {
            case order_1.OrderType.BUY:
                this.processBuyOrder(order);
                break;
            case order_1.OrderType.SELL:
                this.processSellOrder(order);
                break;
        }
    }
    processSellOrder(order) {
        order.status = order_1.OrderStatus.PROCESSING;
        while (true) {
            // console.log('loop');
            const item = this.buyOrderStorage.maximum();
            if (!item) {
                break;
            }
            // console.log('  found item');
            if (item.price < order.price) {
                break;
            }
            // console.log('  processing item');
            while (!item.data.isEmpty()) {
                const minimumTimed = item.data.minimum();
                // console.log('    found minimum timed: ', minimumTimed.data.size);
                for (const buyOrder of minimumTimed.data.values()) {
                    // threadsafe kinda
                    if (buyOrder.status === order_1.OrderStatus.NEW) {
                        buyOrder.status = order_1.OrderStatus.PROCESSING;
                        if (buyOrder.amount > order.amount) {
                            buyOrder.amount = buyOrder.amount - order.amount;
                            this.processTransaction({
                                buyer: buyOrder, seller: order, amount: order.amount,
                            });
                            this.closeOrder(order);
                            // console.log('      buy > sell');
                            buyOrder.status = order_1.OrderStatus.NEW;
                            this.updateOrder(buyOrder);
                            return;
                        }
                        if (buyOrder.amount === order.amount) {
                            // console.log('      buy = sell');
                            this.processTransaction({
                                buyer: buyOrder, seller: order, amount: buyOrder.amount,
                            });
                            // console.log('      buy = sell: transaction');
                            this.closeOrder(order);
                            this.closeOrder(buyOrder);
                            return;
                        }
                        if (buyOrder.amount < order.amount) {
                            // console.log('      buy < sell');
                            order.amount = order.amount - buyOrder.amount;
                            this.processTransaction({
                                buyer: buyOrder, seller: order, amount: buyOrder.amount,
                            });
                            // console.log('      buy > sell : transaction');
                            this.closeOrder(buyOrder);
                            // console.log('      buy > sell : close');
                        }
                    }
                }
            }
        }
        if (order.amount > 0) {
            order.status = order_1.OrderStatus.NEW;
            this.updateOrder(order);
            this.persistInMemOrder(order);
        }
    }
    processBuyOrder(order) {
        // fetching orders from storage unless the max price hit
        order.status = order_1.OrderStatus.PROCESSING;
        while (true) {
            const item = this.sellOrderStorage.minimum();
            if (!item) {
                break;
            }
            if (item.price > order.price) {
                break;
            }
            while (!item.data.isEmpty()) {
                // time sorted
                const minimumTimed = item.data.minimum();
                for (const sellOrder of minimumTimed.data.values()) {
                    // threadsafe kinda
                    if (sellOrder.status === order_1.OrderStatus.NEW) {
                        sellOrder.status = order_1.OrderStatus.PROCESSING;
                        if (sellOrder.amount > order.amount) {
                            sellOrder.amount = sellOrder.amount - order.amount;
                            this.processTransaction({
                                buyer: order, seller: sellOrder, amount: order.amount,
                            });
                            this.closeOrder(order);
                            sellOrder.status = order_1.OrderStatus.NEW;
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
            order.status = order_1.OrderStatus.NEW;
            this.persistInMemOrder(order);
            if (order.amount !== order.initial_amount) {
                this.updateOrder(order);
            }
        }
    }
    persistInMemOrder(order) {
        const storage = order.type === order_1.OrderType.BUY ? this.buyOrderStorage : this.sellOrderStorage;
        storage.persist(order);
    }
    removeInMemOrder(order) {
        const storage = order.type === order_1.OrderType.BUY ? this.buyOrderStorage : this.sellOrderStorage;
        storage.remove(order);
    }
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.incomingChannel.close();
            yield this.outgoingChannel.close();
        });
    }
}
exports.OrderMatcher = OrderMatcher;
//# sourceMappingURL=orderMatcher.js.map