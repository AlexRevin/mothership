module.exports = {

  development: {
    client: 'postgresql',
    connection: {
      database: 'orders',
      pool: {
        min: 1,
        max: 10
      },
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  },
};
