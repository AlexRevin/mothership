import * as Redis from 'ioredis';

export const connectRedis = async (url: string): Promise<Redis.Redis> => {
  return new Promise<Redis.Redis>((res, rej) => {
    const redis = new Redis(url);
    redis.on('ready', () => res(redis));
  });
};
