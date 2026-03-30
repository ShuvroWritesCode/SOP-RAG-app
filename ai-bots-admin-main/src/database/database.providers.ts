import { Sequelize } from 'sequelize-typescript';
import { dbConf } from './database.config';
import { DatabaseModels } from './database.models';

export const databaseProviders = [
  {
    provide: 'SEQUELIZE',
    useFactory: async () => {
      const sequelize = new Sequelize(dbConf);
      sequelize.addModels(DatabaseModels);
      await sequelize.sync({ alter: true });

      // pgvector setup — must run after sync so the table exists
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS vector');
      await sequelize.query(
        'ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536)',
      );
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding
         ON document_chunks USING ivfflat (embedding vector_cosine_ops)
         WITH (lists = 100)`,
      );

      return sequelize;
    },
  },
];
