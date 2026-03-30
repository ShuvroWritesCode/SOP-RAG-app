import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({
  tableName: 'project_files',
  timestamps: true,
  paranoid: true,
})
export class ProjectFileModel extends Model<ProjectFileModel> {
  @PrimaryKey
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4 })
  id: string;

  @Column({ type: DataType.UUID, allowNull: true })
  project_id: string | null;

  @Column({ type: DataType.UUID, allowNull: false })
  user_id: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  filename: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  file_type: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  file_size: number;

  @Column({
    type: DataType.ENUM('uploaded', 'processing', 'completed', 'failed'),
    defaultValue: 'uploaded',
  })
  status: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  shared: boolean;
}
