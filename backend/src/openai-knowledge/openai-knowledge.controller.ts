import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { OpenaiKnowledgeService } from './openai-knowledge.service';

@Controller('openai-knowledge')
export class OpenaiKnowledgeController {
  constructor(
    private readonly openaiKnowledgeService: OpenaiKnowledgeService,
  ) {}

  /**
   * Upload file for general knowledge (no project)
   */
  @Post('upload/general')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFileGeneral(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
    }

    const user = req.user as any;
    if (!user || !user.id) {
      throw new HttpException(
        'User not authenticated or missing ID',
        HttpStatus.UNAUTHORIZED,
      );
    }

    try {
      const result = await this.openaiKnowledgeService.uploadFileForRetrieval(
        null,
        file.buffer,
        file.originalname,
        user.id,
      );

      return {
        success: true,
        fileId: result.fileId,
        dbFileId: result.dbFileId,
        filename: file.originalname,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to upload file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Train general files (no project)
   */
  @Post('train/general')
  @UseGuards(JwtAuthGuard)
  async trainGeneralFiles(@Req() req: Request) {
    try {
      const user = req.user as any;
      if (!user || !user.id) {
        throw new HttpException(
          'User not authenticated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const result = await this.openaiKnowledgeService.trainUploadedFiles(
        null,
        user.id,
      );

      return {
        success: result.success,
        message: result.message,
        trainedCount: result.trainedCount,
        failedCount: result.failedCount,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to train files',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get general files (no project)
   */
  @Get('files/general')
  @UseGuards(JwtAuthGuard)
  async getGeneralFiles(@Req() req: Request) {
    try {
      const user = req.user as any;
      if (!user || !user.id) {
        throw new HttpException(
          'User not authenticated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const files = await this.openaiKnowledgeService.getProjectFiles(
        null,
        user.id,
      );

      return { success: true, files };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get files',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete general file (no project)
   */
  @Delete('file/general/:fileId')
  @UseGuards(JwtAuthGuard)
  async deleteGeneralFile(
    @Param('fileId') fileId: string,
    @Req() req: Request,
  ) {
    try {
      const user = req.user as any;
      if (!user || !user.id) {
        throw new HttpException(
          'User not authenticated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const result = await this.openaiKnowledgeService.deleteFile(
        null,
        fileId,
        user.id,
      );

      return { success: result.success, message: 'File deleted successfully' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Retry training failed general files
   */
  @Post('retry-train/general')
  @UseGuards(JwtAuthGuard)
  async retryTrainGeneralFiles(@Req() req: Request) {
    try {
      const user = req.user as any;
      if (!user || !user.id) {
        throw new HttpException(
          'User not authenticated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const result = await this.openaiKnowledgeService.retryFailedFiles(
        null,
        user.id,
      );

      return {
        success: result.success,
        message: result.message,
        trainedCount: result.trainedCount,
        failedCount: result.failedCount,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retry training general files',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Upload file for a project's knowledge base
   */
  @Post('upload/:projectId')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
    }

    const user = req.user as any;
    if (!user || !user.id) {
      throw new HttpException(
        'User not authenticated or missing ID',
        HttpStatus.UNAUTHORIZED,
      );
    }

    try {
      const result = await this.openaiKnowledgeService.uploadFileForRetrieval(
        projectId,
        file.buffer,
        file.originalname,
        user.id,
      );

      return {
        success: true,
        fileId: result.fileId,
        dbFileId: result.dbFileId,
        filename: file.originalname,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to upload file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all files for a project
   */
  @Get('files/:projectId')
  async getProjectFiles(@Param('projectId') projectId: string) {
    try {
      const files = await this.openaiKnowledgeService.getProjectFiles(
        projectId,
      );

      return { success: true, files };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get files',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update assistant instructions (no-op in RAG mode)
   */
  @Put('assistant/:projectId/instructions')
  async updateInstructions(
    @Param('projectId') projectId: string,
    @Body('instructions') instructions: string,
  ) {
    if (!instructions) {
      throw new HttpException(
        'Instructions are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result =
        await this.openaiKnowledgeService.updateAssistantInstructions(
          projectId,
          instructions,
        );

      return { success: result.success, message: 'Instructions updated successfully' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update instructions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete a file from a project's knowledge base
   */
  @Delete('file/:projectId/:fileId')
  async deleteFile(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
  ) {
    try {
      const result = await this.openaiKnowledgeService.deleteFile(
        projectId,
        fileId,
      );

      return { success: result.success, message: 'File deleted successfully' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Train all uploaded files for a project
   */
  @Post('train/:projectId')
  @UseGuards(JwtAuthGuard)
  async trainFiles(@Param('projectId') projectId: string, @Req() req: Request) {
    try {
      const user = req.user as any;
      let userId: string | undefined;

      if (user && user.id) {
        userId = user.id;
      }

      const result = await this.openaiKnowledgeService.trainUploadedFiles(
        projectId,
        userId,
      );

      return {
        success: result.success,
        message: result.message,
        trainedCount: result.trainedCount,
        failedCount: result.failedCount,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to train files',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Retry training failed files for a project
   */
  @Post('retry-train/:projectId')
  async retryTrainFiles(@Param('projectId') projectId: string) {
    try {
      const result = await this.openaiKnowledgeService.retryFailedFiles(
        projectId,
      );

      return {
        success: result.success,
        message: result.message,
        trainedCount: result.trainedCount,
        failedCount: result.failedCount,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retry training files',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get files by status for a project
   */
  @Get('files/:projectId/status/:status')
  async getFilesByStatus(
    @Param('projectId') projectId: string,
    @Param('status') status: string,
  ) {
    try {
      const files = await this.openaiKnowledgeService.getFilesByStatus(
        projectId,
        status,
      );

      return { success: true, files };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get files by status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Train project with shared files (no-op in RAG mode — shared files are auto-included via SQL)
   */
  @Post('train-shared-files/:projectId')
  @UseGuards(JwtAuthGuard)
  async trainProjectWithSharedFiles(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ) {
    try {
      const user = req.user as any;
      if (!user || !user.id) {
        throw new HttpException(
          'User not authenticated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const result =
        await this.openaiKnowledgeService.trainNewProjectWithSharedFiles(
          projectId,
          user.id,
        );

      return {
        success: result.success,
        message: result.message,
        trainedCount: result.trainedCount,
        failedCount: result.failedCount,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to train project with shared files',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
