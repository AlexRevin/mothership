
exports.up = async (knex, Promise) => {
  await knex.schema.createTable('order_list', function (table) {
    table.uuid('id').notNull();
    table.string('type', 4);
    table.integer('price');
    table.integer('amount');
    table.integer('initial_amount');
    table.integer('status');
    table.timestamps(true, false);
    table.datetime('closed_at');

    // table.index(['status', 'price', 'type']);
    // table.index(['status', 'type']);
    // table.index(['price']);
  })
};

exports.down = async (knex, Promise) => {
  await knex.schema.dropTable('order_list');
};
