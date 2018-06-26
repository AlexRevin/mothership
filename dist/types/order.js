"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var OrderType;
(function (OrderType) {
    OrderType["SELL"] = "sell";
    OrderType["BUY"] = "buy";
})(OrderType = exports.OrderType || (exports.OrderType = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus[OrderStatus["NEW"] = 0] = "NEW";
    OrderStatus[OrderStatus["PROCESSING"] = 1] = "PROCESSING";
    OrderStatus[OrderStatus["COMPLETED"] = 2] = "COMPLETED";
    OrderStatus[OrderStatus["VOID"] = 3] = "VOID";
})(OrderStatus = exports.OrderStatus || (exports.OrderStatus = {}));
//# sourceMappingURL=order.js.map