import * as amqplib from 'amqplib';
import * as Knex from 'knex';
import { config } from '../config';
import { connectAmqp } from '../connectors/amqp';
import { connectDatabase } from './../connectors/database';

export let amqp: amqplib.Connection;
export let db: Knex;

beforeAll(async () => {
  amqp = await connectAmqp(config.RABBIT_URL);
  db = await connectDatabase(config.POSTGRES_URL);
});

afterAll(async () => {
  await db.destroy();
  await amqp.close();
});
