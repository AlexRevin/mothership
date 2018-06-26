
exports.up = async (knex, Promise) => {
  await knex.schema.createTable('transaction_log', function (table) {
    table.increments('id').primary();
    table.uuid('buyer');
    table.uuid('seller');
    table.integer('price');
    table.integer('amount');
    table.datetime('time');

    table.index(['buyer']);
    table.index(['seller']);
    table.index(['buyer', 'seller']);
  })
};

exports.down = async (knex, Promise) => {
  await knex.schema.dropTable('transaction_log');
};
