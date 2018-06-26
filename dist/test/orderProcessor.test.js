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
const setup_1 = require("./setup");
const orderReceiver_1 = require("../services/orderReceiver");
const order_1 = require("../types/order");
const orderProcessor_1 = require("../services/orderProcessor");
describe('Processor', () => __awaiter(this, void 0, void 0, function* () {
    const order = {
        type: order_1.OrderType.BUY,
        price: 100,
        amount: 1,
    };
    it('should fetch messages', (done) => __awaiter(this, void 0, void 0, function* () {
        const processor = yield orderProcessor_1.orderProcessor({ db: setup_1.db, amqpClient: setup_1.amqp });
        processor.emitter.on('order_persisted', (processedOrder) => __awaiter(this, void 0, void 0, function* () {
            expect(processedOrder.amount).toBe(order.amount);
            yield processor.shutdown();
            done();
        }));
        const receiver = yield orderReceiver_1.orderReceiver({ amqpClient: setup_1.amqp });
        yield receiver.processOrder({ order });
        yield receiver.shutdown();
    }));
}));
//# sourceMappingURL=orderProcessor.test.js.map