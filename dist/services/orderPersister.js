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
exports.orderPersister = ({ db, amqpClient }) => __awaiter(this, void 0, void 0, function* () {
    let channel;
    channel = yield amqpClient.createChannel();
    const queue = yield channel.assertQueue('persister', { exclusive: true });
    yield channel.bindQueue(queue.queue, amqpRoutes_1.AmqpExchange.ORDERS_PERSISTENCE, amqpRoutes_1.OrdersPersistenceKeys.ORDER);
    yield channel.prefetch(10);
    yield channel.consume(queue.queue, (msg) => __awaiter(this, void 0, void 0, function* () {
        try {
            const order = JSON.parse(msg.content.toString());
            yield processOrderUpdate(order);
            channel.ack(msg);
        }
        catch (e) {
            console.log(e);
        }
    }));
    function processOrderUpdate(orderMsg) {
        return __awaiter(this, void 0, void 0, function* () {
            const { amount, status, id, closed_at } = orderMsg.data;
            const updateFields = {
                amount, status, updated_at: new Date(),
            };
            if (orderMsg.OpType === 'CLOSE') {
                updateFields.closed_at = closed_at;
            }
            console.log(`persister -> ${orderMsg.OpType}: `, id);
            yield db('order_list').where({ id }).update(updateFields);
        });
    }
});
//# sourceMappingURL=orderPersister.js.map