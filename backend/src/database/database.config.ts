import * as dotenv from 'dotenv';
import type { Dialect } from 'sequelize';
dotenv.config();

export interface IDbConf {
  username: string;
  password: string;
  database: string;
  host: string;
  port: number;
  dialect: Dialect;
  logging?: boolean;
  storage?: string;
}

export const dbConf: IDbConf = {
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'ai-admin',
  host: process.env.DB_HOST || 'localhost',
  port: +(process.env.DB_PORT || 5432),
  dialect: (process.env.DB_DIALECT as Dialect) || 'postgres',
  logging: process.env.NODE_ENV === 'development',
  ...(process.env.DB_DIALECT === 'sqlite' && {
    storage: process.env.DB_STORAGE || ':memory:',
  }),
};
