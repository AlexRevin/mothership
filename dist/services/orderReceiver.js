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
const config_1 = require("./../config");
const uuid = require("uuid");
const express = require("express");
const bodyParser = require("body-parser");
const order_1 = require("../types/order");
const amqpRoutes_1 = require("../types/amqpRoutes");
exports.orderReceiver = ({ amqpClient }) => __awaiter(this, void 0, void 0, function* () {
    const channel = yield amqpClient.createChannel();
    yield channel.assertExchange(amqpRoutes_1.AmqpExchange.ORDERS, 'fanout');
    console.log('receiver started');
    createPair();
    const app = express();
    app.use(bodyParser.json());
    app.post('/', (req, res) => __awaiter(this, void 0, void 0, function* () {
        yield processOrder({ order: req.body });
        return res.json({ received: true });
    }));
    app.listen(+config_1.config.PORT || 8080);
    return Object.freeze({
        processOrder,
        shutdown,
        app,
    });
    function shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            yield channel.close();
        });
    }
    function createPair() {
        return __awaiter(this, void 0, void 0, function* () {
            yield processOrder({ order: {
                    type: order_1.OrderType.SELL,
                    amount: 1,
                    price: 100,
                } });
            yield processOrder({ order: {
                    type: order_1.OrderType.BUY,
                    amount: 1,
                    price: 100,
                } });
            setTimeout(createPair, 1);
        });
    }
    function processOrder({ order }) {
        return __awaiter(this, void 0, void 0, function* () {
            order.id = order.id || uuid.v4();
            order.status = order_1.OrderStatus.NEW;
            order.initial_amount = order.amount;
            order.created_at = new Date();
            const stringifiedOrder = JSON.stringify(order);
            return channel.publish(amqpRoutes_1.AmqpExchange.ORDERS, ``, Buffer.from(stringifiedOrder, 'utf8'));
        });
    }
});
//# sourceMappingURL=orderReceiver.js.map