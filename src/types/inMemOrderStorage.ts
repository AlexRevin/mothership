import { BSTreeKV } from 'typescript-collections';
import { Order } from './order';

type K = {
  price: number;
};

export type KK = {
  created_at: number;
};

type NestedValue = KK & {
  data: Map<string, Partial<Order>>;
};

export type BtreeValue = K & {
  data: BSTreeKV<KK, NestedValue>;
};

export const createInMemOrderStorage = () => {
  const storage =  new BSTreeKV<K, BtreeValue>((a, b): number => {
    if (a.price < b.price) { return -1; }
    if (a.price === b.price) { return 0; }
    return 1;
  });

  function persist(order: Partial<Order>) {
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
      storage.add(
        { price, data },
      );
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

  function remove(order: Partial<Order>) {
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
  return new BSTreeKV<KK, NestedValue>(
    (a, b): number => {
      if (a.created_at < b.created_at) { return -1; }
      if (a.created_at === b.created_at) { return 0; }
      return 1;
    });
};
