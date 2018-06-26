import * as Knex from 'knex';
import { connectAmqp } from './connectors/amqp';
import { config } from './config';
import { connectDatabase } from './connectors/database';
import { OrderMatcher } from './services/orderMatcher';
import { Connection } from 'amqplib';
import { orderProcessor } from './services/orderProcessor';
import { orderReceiver } from './services/orderReceiver';
import { orderTransactionPersister } from './services/orderTransactionPersister';

interface ServiceParams {
  amqpClient: Connection;
  db: Knex;
}
const services = ({ amqpClient, db }: ServiceParams) => {
  return {
    matcher: async () => {
      const matcher = new OrderMatcher({ amqpClient, mode: 'amqp' });
      await matcher.startService();
    },
    processor: async () => {
      orderProcessor({ amqpClient, db }).then(processor => processor.startProcessing());
    },
    receiver: async () => await orderReceiver({ amqpClient }),
    transactionPersister: async () => {
      await orderTransactionPersister({ db, amqpClient });
    },
  };
};

const bootstrap = async () => {
  const amqp = await connectAmqp(config.RABBIT_URL);
  const db = await connectDatabase(config.POSTGRES_URL);
  const service = services({ db, amqpClient: amqp })[config.SERVICE_NAME];
  if (service) {
    console.log(`starting ${config.SERVICE_NAME}`);
  } else {
    throw 'service not found';
  }
  await service();
};

bootstrap().then(() => {
  console.log('app started');
});
