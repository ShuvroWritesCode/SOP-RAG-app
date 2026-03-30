import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

// NOTE: The 'embedding' column (vector(1536)) is NOT defined here.
// It is added via raw SQL after sequelize.sync() to avoid type conflicts.
@Table({ tableName: 'document_chunks', timestamps: true })
export class DocumentChunkModel extends Model<DocumentChunkModel> {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  file_id: string;

  @Column({ type: DataType.UUID, allowNull: true })
  project_id: string | null;

  @Column({ type: DataType.UUID, allowNull: false })
  user_id: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  chunk_text: string;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  chunk_index: number;
}
