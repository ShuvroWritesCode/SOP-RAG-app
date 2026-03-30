import { Injectable, Inject } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { Response } from 'express';
import OpenAI from 'openai';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

@Injectable()
export class RagService {
  private readonly openai: OpenAI;

  constructor(@Inject('SEQUELIZE') private readonly sequelize: Sequelize) {
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': 'https://sop-rag-app.local',
        'X-Title': 'SOP RAG App',
      },
    });
  }

  async extractText(buffer: Buffer, filename: string): Promise<string> {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      const data = await pdfParse(buffer);
      return data.text;
    }
    if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    // plain text / txt / csv / etc.
    return buffer.toString('utf-8');
  }

  chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const chunks: string[] = [];
    let i = 0;
    while (i < words.length) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      if (chunk.trim().length > 0) chunks.push(chunk);
      i += chunkSize - overlap;
    }
    return chunks;
  }

  async embedText(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'openai/text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }

  async storeChunks(
    chunks: string[],
    fileId: string,
    projectId: string | null,
    userId: string,
  ): Promise<void> {
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.embedText(chunks[i]);
      const vectorLiteral = `[${embedding.join(',')}]`;
      await this.sequelize.query(
        `INSERT INTO document_chunks
           (id, file_id, project_id, user_id, chunk_text, chunk_index, embedding, "createdAt", "updatedAt")
         VALUES
           (gen_random_uuid(), $1, $2, $3, $4, $5, $6::vector, NOW(), NOW())`,
        {
          bind: [fileId, projectId, userId, chunks[i], i, vectorLiteral],
        },
      );
    }
  }

  async deleteChunksForFile(fileId: string): Promise<void> {
    await this.sequelize.query(
      'DELETE FROM document_chunks WHERE file_id = $1',
      { bind: [fileId] },
    );
  }

  async retrieveChunks(
    query: string,
    projectId: string | null,
    userId: string,
    topK = 5,
  ): Promise<{ chunk_text: string; similarity: number }[]> {
    const queryEmbedding = await this.embedText(query);
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;

    let sql: string;
    let bind: (string | number | null)[];

    if (projectId) {
      sql = `
        SELECT chunk_text, 1 - (embedding <=> $1::vector) AS similarity
        FROM document_chunks
        WHERE (project_id = $2 OR (project_id IS NULL AND user_id = $3))
        ORDER BY embedding <=> $1::vector
        LIMIT $4
      `;
      bind = [vectorLiteral, projectId, userId, topK];
    } else {
      sql = `
        SELECT chunk_text, 1 - (embedding <=> $1::vector) AS similarity
        FROM document_chunks
        WHERE user_id = $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `;
      bind = [vectorLiteral, userId, topK];
    }

    const [rows] = await this.sequelize.query(sql, { bind });
    return rows as { chunk_text: string; similarity: number }[];
  }

  async streamTokens(
    userMessage: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    projectId: string | null,
    userId: string,
    promptPrefix: string,
    res: Response,
  ): Promise<string> {
    const chunks = await this.retrieveChunks(userMessage, projectId, userId);

    const context = chunks
      .map((c, i) => `[Source ${i + 1}]\n${c.chunk_text}`)
      .join('\n\n');

    const systemPrompt = [
      promptPrefix || 'You are a helpful assistant.',
      context.length > 0
        ? `\n\nUse the following context to answer the user's question:\n\n${context}`
        : '',
    ]
      .join('')
      .trim();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    const stream = await this.openai.chat.completions.create({
      model: 'openai/gpt-4o',
      messages,
      stream: true,
    });

    let fullAnswer = '';
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        fullAnswer += token;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    return fullAnswer;
  }

  async ingestFile(
    buffer: Buffer,
    filename: string,
    fileId: string,
    projectId: string | null,
    userId: string,
  ): Promise<void> {
    const text = await this.extractText(buffer, filename);
    const chunks = this.chunkText(text);
    await this.storeChunks(chunks, fileId, projectId, userId);
  }
}
