import { Sequelize } from 'sequelize-typescript';
import * as bcrypt from 'bcryptjs';
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

      // Seed default admin user if it doesn't exist
      const [existing] = await sequelize.query(
        `SELECT id FROM users WHERE email = 'admin' LIMIT 1`,
      );
      if (existing.length === 0) {
        const hashedPassword = bcrypt.hashSync('admin', 10);
        await sequelize.query(
          `INSERT INTO users (id, email, password, "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), 'admin', '${hashedPassword}', NOW(), NOW())`,
        );
        console.log('Seeded default admin user (admin / admin)');
      }

      // Seed default AI models if none exist
      const [modelRows] = await sequelize.query(
        `SELECT count(*)::int as cnt FROM ai_models`,
      );
      if ((modelRows as any)[0].cnt === 0) {
        await sequelize.query(
          `INSERT INTO ai_models (id, model_id, display_name, is_active, "createdAt", "updatedAt") VALUES
           (gen_random_uuid(), 'openai/gpt-5.1-chat', 'GPT-5.1 Chat', false, NOW(), NOW()),
           (gen_random_uuid(), 'openai/gpt-5-nano', 'GPT-5 Nano', false, NOW(), NOW()),
           (gen_random_uuid(), 'openai/gpt-4.1', 'GPT-4.1', true, NOW(), NOW()),
           (gen_random_uuid(), 'openai/gpt-4.1-mini', 'GPT-4.1 Mini', false, NOW(), NOW())`,
        );
        console.log('Seeded default AI models (GPT-4.1 active)');
      }

      return sequelize;
    },
  },
];
