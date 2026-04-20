import { Sequelize } from 'sequelize-typescript';
import * as bcrypt from 'bcryptjs';
import { dbConf } from './database.config';
import { DatabaseModels } from './database.models';
import { UserModel } from 'src/users/entities/user.model';
import { AiModelModel } from 'src/ai-models/ai-model.model';

export const databaseProviders = [
  {
    provide: 'SEQUELIZE',
    useFactory: async () => {
      const sequelize = new Sequelize(dbConf);
      sequelize.addModels(DatabaseModels);
      await sequelize.sync({
        alter: process.env.DB_SYNC_ALTER === 'true',
      });

      const isPostgres = dbConf.dialect === 'postgres';

      // pgvector setup — postgres-only
      if (isPostgres) {
        await sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
        await sequelize.query('CREATE EXTENSION IF NOT EXISTS vector');
        await sequelize.query(
          'ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536)',
        );
        await sequelize.query(
          `CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding
           ON document_chunks USING ivfflat (embedding vector_cosine_ops)
           WITH (lists = 100)`,
        );
      }

      // Seed default admin user if enabled (disabled by default in production)
      const seedAdminOverride = process.env.SEED_DEFAULT_ADMIN;
      const seedAdminEnabled =
        seedAdminOverride === 'true' ||
        (seedAdminOverride == null && process.env.NODE_ENV !== 'production');
      if (seedAdminEnabled) {
        const existing = await UserModel.findOne({ where: { email: 'admin' } });
        if (!existing) {
          await UserModel.create({
            email: 'admin',
            password: bcrypt.hashSync('admin', 10),
          } as any);
          console.log('Seeded default admin user (admin / admin)');
        }
      }

      // Seed default AI models if none exist
      const modelCount = await AiModelModel.count();
      if (modelCount === 0) {
        await AiModelModel.bulkCreate([
          {
            model_id: 'openai/gpt-5.1-chat',
            display_name: 'GPT-5.1 Chat',
            is_active: false,
          },
          {
            model_id: 'openai/gpt-5-nano',
            display_name: 'GPT-5 Nano',
            is_active: false,
          },
          {
            model_id: 'openai/gpt-4.1',
            display_name: 'GPT-4.1',
            is_active: true,
          },
          {
            model_id: 'openai/gpt-4.1-mini',
            display_name: 'GPT-4.1 Mini',
            is_active: false,
          },
        ] as any);
        console.log('Seeded default AI models (GPT-4.1 active)');
      }

      return sequelize;
    },
  },
];
