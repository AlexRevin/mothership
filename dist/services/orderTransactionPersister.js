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
const amqpRoutes_1 = require("../types/amqpRoutes");
const events_1 = require("events");
exports.orderTransactionPersister = ({ db, amqpClient }) => __awaiter(this, void 0, void 0, function* () {
    const orderTransactionStack = [];
    const emitter = new events_1.EventEmitter();
    let channel;
    batchPoller();
    channel = yield amqpClient.createChannel();
    const queue = yield channel.assertQueue('transaction_persister', { exclusive: true });
    yield channel.bindQueue(queue.queue, amqpRoutes_1.AmqpExchange.ORDERS_PERSISTENCE, amqpRoutes_1.OrdersPersistenceKeys.ORDER_BOOK);
    yield channel.prefetch(100);
    yield channel.consume(queue.queue, (msg) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { buyer, seller, amount, price, time } = JSON.parse(msg.content.toString());
            console.log(`transaction: ${seller.id} -> ${buyer.id}`);
            orderTransactionStack.push({
                amount, price, time,
                buyer: buyer.id,
                seller: seller.id,
            });
            channel.ack(msg);
        }
        catch (e) {
            console.log(e);
        }
    }));
    function batchPoller() {
        return __awaiter(this, void 0, void 0, function* () {
            const transactions = orderTransactionStack.splice(0, 100);
            if (transactions.length) {
                yield persistOrderTransactions(transactions);
            }
            transactions.map(o => emitter.emit('transaction_persisted', o));
            setTimeout(batchPoller, 20);
        });
    }
    function persistOrderTransactions(transactions) {
        return __awaiter(this, void 0, void 0, function* () {
            return db.batchInsert('transaction_log', transactions);
        });
    }
});
//# sourceMappingURL=orderTransactionPersister.js.map