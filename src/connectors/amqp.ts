import * as amqp from 'amqplib';

export const connectAmqp = async (url: string): Promise<​​amqp.Connection> => {
  return amqp.connect(url);
};
