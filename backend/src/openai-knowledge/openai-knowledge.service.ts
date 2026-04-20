import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { ProjectFileModel } from './entities/project-file.model';
import { ProjectModel } from 'src/projects/entities/projects.model';
import { RagService } from 'src/rag/rag.service';

@Injectable()
export class OpenaiKnowledgeService {
  private readonly logger = new Logger(OpenaiKnowledgeService.name);
  private projectFileModel: typeof ProjectFileModel;
  private projectModel: typeof ProjectModel;

  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
    private readonly ragService: RagService,
  ) {
    this.projectFileModel = this.sequelize.models
      .ProjectFileModel as typeof ProjectFileModel;
    this.projectModel = this.sequelize.models.ProjectModel as typeof ProjectModel;
  }

  // No-op stub — called by ProjectsService on project creation
  async createOrGetAssistant(
    _projectId: string | null,
    _customInstructions?: string,
    _userId?: string,
  ) {
    return { assistantId: null, dbId: null, vectorStoreId: null };
  }

  // No-op stub — now handled automatically by the shared-query RAG logic
  async trainNewProjectWithSharedFiles(
    _projectId: string,
    _userId: string,
  ) {
    return { success: true, message: 'Shared files included automatically via RAG query', trainedCount: 0, failedCount: 0 };
  }

  async uploadFileForRetrieval(
    projectId: string | null,
    fileBuffer: Buffer,
    filename: string,
    userId: string,
  ) {
    try {
      const dbFile = await this.projectFileModel.create({
        project_id: projectId,
        user_id: userId,
        filename,
        file_type: filename.split('.').pop()?.toLowerCase() || 'unknown',
        file_size: fileBuffer.length,
        status: 'processing',
        shared: projectId === null,
      } as any);

      try {
        await this.ragService.ingestFile(
          fileBuffer,
          filename,
          dbFile.id,
          projectId,
          userId,
        );
        await dbFile.update({ status: 'completed' });
      } catch (err) {
        await dbFile.update({ status: 'failed' });
        throw err;
      }

      await this.updateProjectFilesCount(projectId);
      return { fileId: dbFile.id, dbFileId: dbFile.id };
    } catch (error) {
      this.logger.error('Error uploading file:', error);
      throw new HttpException('Failed to upload file', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async trainUploadedFiles(projectId: string | null, userId?: string) {
    try {
      const where: any = { status: 'uploaded' };
      if (projectId) {
        where.project_id = projectId;
      } else {
        where.user_id = userId;
        where.project_id = null;
      }

      const files = await this.projectFileModel.findAll({ where });
      let trainedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      for (const file of files) {
        try {
          // Ingestion happens at upload-time. Keep status unchanged here to avoid
          // false "completed" transitions when source buffer is unavailable.
          if (file.status === 'uploaded') {
            skippedCount++;
            continue;
          }
          trainedCount++;
        } catch (err) {
          await file.update({ status: 'failed' });
          failedCount++;
        }
      }

      if (projectId) await this.updateProjectFilesCount(projectId);
      return {
        success: true,
        message: `Trained ${trainedCount} files`,
        trainedCount,
        failedCount,
        skippedCount,
      };
    } catch (error) {
      throw new HttpException('Failed to train files', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getProjectFiles(projectId: string | null, userId?: string) {
    const where: any = {};
    if (projectId) {
      where.project_id = projectId;
      if (userId) where.user_id = userId;
    } else {
      where.user_id = userId;
      where.project_id = null;
    }
    return this.projectFileModel.findAll({ where });
  }

  async deleteFile(projectId: string | null, fileId: string, userId?: string) {
    try {
      if (!fileId || fileId === 'undefined') {
        throw new HttpException('File id is required', HttpStatus.BAD_REQUEST);
      }

      const dbFile = await this.projectFileModel.findOne({
        where: {
          id: fileId,
          ...(userId ? { user_id: userId } : {}),
        },
      });
      if (!dbFile) {
        throw new HttpException('File not found', HttpStatus.NOT_FOUND);
      }

      await this.ragService.deleteChunksForFile(fileId);
      await dbFile.destroy();

      if (projectId) await this.updateProjectFilesCount(projectId);
      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Error deleting file:', error);
      throw new HttpException('Failed to delete file', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async retryFailedFiles(projectId: string | null, userId?: string) {
    const where: any = { status: 'failed' };
    if (projectId) {
      where.project_id = projectId;
    } else {
      where.user_id = userId;
      where.project_id = null;
    }

    const files = await this.projectFileModel.findAll({ where });
    let trainedCount = 0;
    let failedCount = 0;

    for (const file of files) {
      try {
        await file.update({ status: 'processing' });
        // Buffer not available at retry time; mark as pending for manual re-upload
        await file.update({ status: 'uploaded' });
        trainedCount++;
      } catch {
        await file.update({ status: 'failed' });
        failedCount++;
      }
    }

    return { success: true, message: `Reset ${trainedCount} files for re-upload`, trainedCount, failedCount };
  }

  async updateAssistantInstructions(_projectId: string, _instructions: string) {
    return { success: true };
  }

  async getFilesByStatus(projectId: string, status: string, userId?: string) {
    return this.projectFileModel.findAll({
      where: {
        project_id: projectId,
        status,
        ...(userId ? { user_id: userId } : {}),
      },
    });
  }

  async getFilesByStatusAndUser(projectId: string | null, status: string, userId: string) {
    const where: any = { status, user_id: userId };
    if (projectId) {
      where.project_id = projectId;
    }
    return this.projectFileModel.findAll({ where });
  }

  async getAllUserFiles(userId: string) {
    return this.projectFileModel.findAll({
      where: { user_id: userId },
      order: [['createdAt', 'DESC']],
    });
  }

  async getFileById(fileId: string, userId?: string) {
    return this.projectFileModel.findOne({
      where: {
        id: fileId,
        ...(userId ? { user_id: userId } : {}),
      },
    });
  }

  async updateFileProject(fileId: string, projectId: string | null, userId?: string) {
    const file = await this.projectFileModel.findOne({
      where: {
        id: fileId,
        ...(userId ? { user_id: userId } : {}),
      },
    });
    if (!file) throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    await file.update({ project_id: projectId, shared: projectId === null });
    return file;
  }

  async getSharedTrainingStatus(projectId: string, userId: string) {
    const sharedFiles = await this.projectFileModel.findAll({
      where: { user_id: userId, shared: true, status: 'completed' },
    });
    return {
      needsSharedTraining: false,
      sharedFilesCount: sharedFiles.length,
      trainedSharedFilesCount: sharedFiles.length,
    };
  }

  async getCompiledKnowledge(projectId: string | null, userId: string) {
    const where: any = { user_id: userId, status: 'completed' };
    if (projectId) {
      where.project_id = projectId;
    } else {
      where.project_id = null;
    }

    const files = await this.projectFileModel.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    if (!files.length) return '';

    const fileIds = files.map((f) => f.id);
    const [rows] = await this.sequelize.query(
      `SELECT file_id, chunk_text, chunk_index
       FROM document_chunks
       WHERE file_id = ANY($1)
       ORDER BY file_id, chunk_index ASC`,
      { bind: [fileIds] },
    );

    const chunksByFile = new Map<string, string[]>();
    (rows as any[]).forEach((r) => {
      const list = chunksByFile.get(r.file_id) || [];
      list.push(r.chunk_text);
      chunksByFile.set(r.file_id, list);
    });

    return files
      .map((file) => {
        const text = (chunksByFile.get(file.id) || []).join('\n');
        return `# ${file.filename}\n${text}`.trim();
      })
      .join('\n\n');
  }

  private async updateProjectFilesCount(projectId: string | null) {
    if (!projectId) return;
    try {
      const count = await this.projectFileModel.count({
        where: { project_id: projectId, status: 'completed' },
      });
      await this.projectModel.update({ files: count }, { where: { id: projectId } });
    } catch (error) {
      this.logger.error(`Error updating file count for project ${projectId}:`, error);
    }
  }
}
