# 3-Minute Explanatory Script: Private RAG Web App

Hi everyone. In this quick walkthrough, I’ll explain how this web app works end-to-end, starting from sign-up and login, then moving through project creation, document upload, training, and chat.

When a new user opens the app, they first sign up with email and password, then log in. Authentication is handled by a NestJS backend using JWT, so every protected action like file upload, project access, and chat history is scoped to the authenticated user.

After login, the user lands in the main workspace. From here, the normal flow is:

1. Create a project.
2. Upload one or more documents.
3. Train knowledge.
4. Ask questions in chat.

On project creation, the app initializes a project-specific context and prompt settings. Files can also be uploaded to a general, non-project context if needed.

During upload, files are stored in the database as project files, then processed by the RAG pipeline. The backend extracts text from PDF and DOCX files, and also supports plain text-style files such as TXT and CSV. The text is chunked, embedded, and indexed for semantic retrieval.

At training/query time, the app retrieves the most relevant chunks using pgvector cosine similarity, builds a grounded system prompt from those chunks, and streams the model response token-by-token back to the frontend over SSE. That means users get near real-time answers while the model is still generating.

From a user perspective, this gives a simple experience: upload internal documents once, then ask natural language questions and get context-aware answers based on your own data.

Now the tech stack:

- Frontend: Vue 3, Vue Router, Vuex, Axios, SCSS.
- Backend: NestJS + TypeScript, Sequelize ORM, JWT auth.
- Database: PostgreSQL 16 with pgvector extension.
- AI provider path: OpenRouter-compatible OpenAI SDK integration.
- Deployment: Docker Compose with separate frontend, backend, and database services.

Supported seeded chat models in this codebase are:

- `openai/gpt-4.1` (default active)
- `openai/gpt-4.1-mini`
- `openai/gpt-5.1-chat`
- `openai/gpt-5-nano`

Embedding model used for retrieval is:

- `openai/text-embedding-3-small`

Important implementation details for developers:

- User isolation is enforced with `user_id` filtering for files, projects, and conversations.
- Conversation history is persisted and can be listed, renamed, and deleted.
- CORS is configured to support localhost, server IP access, and domain-based reverse proxy setups.
- The app degrades safely when AI keys are missing by returning a clear unavailable message instead of crashing.
- Production deployment is straightforward: configure `.env`, then `docker compose up -d --build`.

In short, this is a production-oriented Private RAG platform: secure sign-in, project-based knowledge spaces, document-grounded answers, model flexibility, and simple Docker deployment.
