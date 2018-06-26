require('dotenv').config();

export type UUID = string;
export interface ExtendedProcessEnvs extends NodeJS.ProcessEnv {
  REDIS_URL: string;
  RABBIT_URL: string;
  POSTGRES_URL: string;
  PORT: string;
  SERVICE_NAME: 'matcher' | 'persister' | 'processor' | 'receiver' | 'transactionPersister';
}
export const config = <ExtendedProcessEnvs>process.env;
