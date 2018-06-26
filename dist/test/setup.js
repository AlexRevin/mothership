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
const config_1 = require("../config");
const amqp_1 = require("../connectors/amqp");
const database_1 = require("./../connectors/database");
beforeAll(() => __awaiter(this, void 0, void 0, function* () {
    exports.amqp = yield amqp_1.connectAmqp(config_1.config.RABBIT_URL);
    exports.db = yield database_1.connectDatabase(config_1.config.POSTGRES_URL);
}));
afterAll(() => __awaiter(this, void 0, void 0, function* () {
    yield exports.db.destroy();
    yield exports.amqp.close();
}));
//# sourceMappingURL=setup.js.map