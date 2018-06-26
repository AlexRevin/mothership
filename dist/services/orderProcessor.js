"use strict";
// This service implements the following strategy:
// - Reads the order from the processing queue
// - Persists it to database
// - Sends it to the OrderBook processor
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const amqpRoutes_1 = require("../types/amqpRoutes");
exports.orderProcessor = ({ amqpClient, db }) => __awaiter(this, void 0, void 0, function* () {
    const emitter = new events_1.EventEmitter();
    const ordersStack = [];
    let channel;
    function startProcessing() {
        return __awaiter(this, void 0, void 0, function* () {
            batchPoller();
            channel = yield amqpClient.createChannel();
            const queue = yield channel.assertQueue('processor', { exclusive: true });
            yield channel.bindQueue(queue.queue, amqpRoutes_1.AmqpExchange.ORDERS, '');
            yield channel.prefetch(100);
            yield channel.consume(queue.queue, (msg) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const order = JSON.parse(msg.content.toString());
                    ordersStack.push(order);
                    channel.ack(msg);
                }
                catch (e) {
                    console.log(e);
                }
            }));
        });
    }
    function batchPoller() {
        return __awaiter(this, void 0, void 0, function* () {
            const orders = ordersStack.splice(0, 100);
            if (orders.length) {
                console.log('processing orders with ids: ', orders.map(o => o.id));
                yield persistOrders({ orders });
                orders.map(o => emitter.emit('order_persisted', o));
            }
            setTimeout(batchPoller, 20);
        });
    }
    return Object.freeze({
        persistOrders,
        shutdown,
        emitter,
        ordersStack,
        startProcessing,
    });
    function shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            emitter.removeAllListeners();
            if (channel) {
                return channel.close();
            }
        });
    }
    // TODO: we might not need to return order from here
    function persistOrders({ orders }) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return db.batchInsert('order_list', orders);
            }
            catch (e) {
                console.log(e);
            }
        });
    }
});
//# sourceMappingURL=orderProcessor.js.map