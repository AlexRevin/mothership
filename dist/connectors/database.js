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
const Knex = require("knex");
const connections = {};
const defaultOpts = {
    pool: {
        min: 1,
        max: 30,
    },
    client: 'postgresql',
};
exports.connectDatabase = (url, database = 'orders', debug = true) => __awaiter(this, void 0, void 0, function* () {
    return new Promise((res, rej) => __awaiter(this, void 0, void 0, function* () {
        if (!connections[database]) {
            connections[database] = {
                instance: Knex(Object.assign({}, defaultOpts, { connection: url })),
            };
            yield connections[database].instance.raw('SET timezone="UTC";');
            connections[database].instance.on('query-error', console.error);
            res(connections[database].instance);
        }
        res(connections[database].instance);
    }));
});
//# sourceMappingURL=database.js.map