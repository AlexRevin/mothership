import * as Knex from 'knex';

const connections: {
  [key: string]: {
    instance: Knex,
  };
} = {};

const defaultOpts: Partial<Knex.Config> = {
  pool: {
    min: 1,
    max: 30,
  },
  client: 'postgresql',
};

export const connectDatabase = async (url, database = 'orders', debug = true): Promise<Knex> => {
  return new Promise<Knex>(async (res, rej) => {
    if (!connections[database]) {
      connections[database] = {
        instance: Knex({ ...defaultOpts, ...{ connection: url } }),
      };
      await connections[database].instance.raw('SET timezone="UTC";');
      connections[database].instance.on('query-error', console.error);
      res(connections[database].instance);
    }
    res(connections[database].instance);
  });
};
