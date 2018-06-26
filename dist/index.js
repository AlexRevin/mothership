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
const amqp_1 = require("./connectors/amqp");
const config_1 = require("./config");
const database_1 = require("./connectors/database");
const orderMatcher_1 = require("./services/orderMatcher");
const orderPersister_1 = require("./services/orderPersister");
const orderProcessor_1 = require("./services/orderProcessor");
const orderReceiver_1 = require("./services/orderReceiver");
const orderTransactionPersister_1 = require("./services/orderTransactionPersister");
const services = ({ amqpClient, db }) => {
    return {
        matcher: () => __awaiter(this, void 0, void 0, function* () {
            const matcher = new orderMatcher_1.OrderMatcher({ amqpClient, mode: 'amqp' });
            yield matcher.startService();
        }),
        persister: () => __awaiter(this, void 0, void 0, function* () { return orderPersister_1.orderPersister({ db, amqpClient }); }),
        processor: () => __awaiter(this, void 0, void 0, function* () {
            orderProcessor_1.orderProcessor({ amqpClient, db }).then(processor => processor.startProcessing());
        }),
        receiver: () => __awaiter(this, void 0, void 0, function* () { return yield orderReceiver_1.orderReceiver({ amqpClient }); }),
        transactionPersister: () => __awaiter(this, void 0, void 0, function* () {
            yield orderTransactionPersister_1.orderTransactionPersister({ db, amqpClient });
        }),
    };
};
const bootstrap = () => __awaiter(this, void 0, void 0, function* () {
    const amqp = yield amqp_1.connectAmqp(config_1.config.RABBIT_URL);
    const db = yield database_1.connectDatabase(config_1.config.POSTGRES_URL);
    const service = services({ db, amqpClient: amqp })[config_1.config.SERVICE_NAME];
    if (service) {
        console.log(`starting ${config_1.config.SERVICE_NAME}`);
    }
    else {
        throw 'service not found';
    }
    yield service();
});
bootstrap().then(() => {
    console.log('app started');
});
//# sourceMappingURL=index.js.map