"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var AmqpExchange;
(function (AmqpExchange) {
    AmqpExchange["ORDERS"] = "orders";
    AmqpExchange["ORDERS_PERSISTENCE"] = "orders_persistence";
})(AmqpExchange = exports.AmqpExchange || (exports.AmqpExchange = {}));
var OrdersPersistenceKeys;
(function (OrdersPersistenceKeys) {
    OrdersPersistenceKeys["ORDER"] = "order.tr";
    OrdersPersistenceKeys["ORDER_BOOK"] = "order_book.tr";
})(OrdersPersistenceKeys = exports.OrdersPersistenceKeys || (exports.OrdersPersistenceKeys = {}));
//# sourceMappingURL=amqpRoutes.js.map