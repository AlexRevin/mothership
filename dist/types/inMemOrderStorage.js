"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_collections_1 = require("typescript-collections");
exports.createInMemOrderStorage = () => {
    const storage = new typescript_collections_1.BSTreeKV((a, b) => {
        if (a.price < b.price) {
            return -1;
        }
        if (a.price === b.price) {
            return 0;
        }
        return 1;
    });
    function persist(order) {
        const { price, id, created_at } = order;
        const priceIndex = storage.search({ price });
        // creating secondary index on data
        if (!priceIndex) {
            const data = createInMemSecondaryStorage();
            const map = new Map();
            map.set(id, order);
            data.add({
                created_at: +order.created_at,
                data: map,
            });
            storage.add({ price, data });
            return;
        }
        const foundByTime = priceIndex.data.search({ created_at: +created_at });
        // unbelievable, same microsecond
        if (!foundByTime) {
            const map = new Map();
            map.set(id, order);
            priceIndex.data.add({
                created_at: +order.created_at,
                data: map,
            });
            return;
        }
        // found within the same microsecond
        foundByTime.data.set(id, order);
    }
    function remove(order) {
        const { price, created_at, id } = order;
        const priceIndex = storage.search({ price });
        // only one element and this should be us
        if (priceIndex && priceIndex.data) {
            const dateIndex = priceIndex.data.search({
                created_at: +created_at,
            });
            if (dateIndex) {
                if (dateIndex.data.has(id)) {
                    dateIndex.data.delete(id);
                }
                if (!dateIndex.data.size) {
                    priceIndex.data.remove({ created_at: +created_at });
                }
            }
            if (priceIndex.data.isEmpty()) {
                storage.remove({ price });
            }
        }
    }
    const minimum = () => storage.minimum();
    const maximum = () => storage.maximum();
    return Object.freeze({
        storage,
        persist,
        remove,
        minimum,
        maximum,
    });
};
const createInMemSecondaryStorage = () => {
    return new typescript_collections_1.BSTreeKV((a, b) => {
        if (a.created_at < b.created_at) {
            return -1;
        }
        if (a.created_at === b.created_at) {
            return 0;
        }
        return 1;
    });
};
//# sourceMappingURL=inMemOrderStorage.js.map