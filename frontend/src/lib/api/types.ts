export type UUID = string;

// ---- Auth ----

export interface User {
  id: UUID;
  username: string;
  display_name: string;
  is_admin: boolean;
  is_active?: boolean;
  storage_quota_bytes?: number | null;
  ai_monthly_request_quota?: number | null;
}

export interface Session {
  user: User;
  csrf_token: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  display_name?: string;
  invite_token?: string;
}

export interface ProfileUpdateRequest {
  username?: string;
  display_name?: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

export interface UserUsage {
  storage_used_bytes: number;
  storage_quota_bytes: number | null;
  ai_requests_this_month: number;
  ai_monthly_request_quota: number | null;
}

export interface UserAdmin extends User {
  created_at: string;
  storage_used_bytes: number;
  ai_requests_this_month: number;
}

export interface Invite {
  id: UUID;
  expires_at: string;
  used_at: string | null;
  storage_quota_bytes: number | null;
  ai_monthly_request_quota: number | null;
  created_at: string;
  invite_url_token?: string | null;
}

// ---- Folders ----

export interface Folder {
  id: UUID;
  name: string;
  parent_id: UUID | null;
  kind: "root" | "inbox" | "trash" | "normal";
  sort_order: number;
  path_cache: string;
  is_trashed?: boolean;
  trashed_at?: string | null;
  purge_after?: string | null;
  created_at: string;
  updated_at: string;
  children_count: number;
  document_count: number;
}

export interface FolderCreate {
  name: string;
  parent_id?: UUID | null;
}

export interface FolderUpdate {
  name?: string;
  parent_id?: UUID | null;
  sort_order?: number;
}

export type FolderDeleteStrategy =
  | "move_to_parent"
  | "move_to_inbox"
  | "delete_documents"
  | "trash";

export interface FolderDeleteRequest {
  strategy: FolderDeleteStrategy;
  confirm_destructive?: boolean;
}

// ---- Tags / types / correspondents ----

export interface Tag {
  id: UUID;
  name: string;
  color: string;
  slug: string;
  document_count: number;
}

export interface TagBrief {
  id: UUID;
  name: string;
  color: string;
}

export interface TagCreate {
  name: string;
  color?: string;
}

export interface TagUpdate {
  name?: string;
  color?: string;
}

export interface NamedEntity {
  id: UUID;
  name: string;
  slug: string;
}

export interface NamedEntityCreate {
  name: string;
}

// ---- Documents ----

export interface Document {
  id: UUID;
  title: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  page_count: number | null;
  language: string | null;
  notes: string | null;
  archive_serial: string | null;
  folder_id: UUID;
  folder_path: string | null;
  document_type_id: UUID | null;
  document_type_name: string | null;
  correspondent_id: UUID | null;
  correspondent_name: string | null;
  tags: TagBrief[];
  created_date: string | null;
  effective_date: string | null;
  added_date: string;
  modified_date: string;
  indexed_at: string | null;
  processing_status: "pending" | "processing" | "ready" | "failed" | "partial";
  ocr_completed: boolean;
  text_extracted: boolean;
  document_indexed: boolean;
  has_embeddings: boolean;
  processing_error: string | null;
  is_archived: boolean;
  is_trashed: boolean;
  trashed_at: string | null;
  trashed_from_folder_id?: UUID | null;
  purge_after?: string | null;
  inbox: boolean;
  needs_review: boolean;
  custom_fields: Record<string, unknown>;
  ai_summary: string | null;
  ai_summary_meta: Record<string, unknown> | null;
  has_thumbnail: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentList {
  items: Document[];
  total: number;
  page: number;
  page_size: number;
}

export interface DocumentMetadataUpdate {
  title?: string;
  folder_id?: UUID;
  document_type_id?: UUID | null;
  correspondent_id?: UUID | null;
  tag_ids?: UUID[];
  created_date?: string | null;
  effective_date?: string | null;
  language?: string | null;
  notes?: string | null;
  custom_fields?: Record<string, unknown>;
  inbox?: boolean;
  is_archived?: boolean;
  needs_review?: boolean;
}

export interface DocumentMoveRequest {
  folder_id: UUID;
}

export type BulkAction =
  | "tag"
  | "untag"
  | "move"
  | "trash"
  | "restore"
  | "archive"
  | "unarchive";

export interface BulkActionRequest {
  document_ids: UUID[];
  action: BulkAction;
  tag_ids?: UUID[];
  folder_id?: UUID;
}

export interface DocumentListParams {
  folder_id?: UUID;
  include_descendants?: boolean;
  inbox?: boolean;
  trashed?: boolean;
  tag_ids?: UUID[];
  q?: string;
  page?: number;
  page_size?: number;
  sort?: "added_date" | "title" | "modified_date" | "created_date";
  order?: "asc" | "desc";
}

export interface DocumentPageContent {
  page_number: number;
  text: string;
}

export interface DuplicateError {
  duplicate: boolean;
  existing_document_id: UUID;
  message: string;
}

export interface UploadResult {
  status: "duplicate";
  duplicate: true;
  existing_document_id: UUID;
  message: string;
  relative_path?: string | null;
}

// ---- Search ----

export type SearchMode = "keyword" | "semantic" | "hybrid";

export interface SearchRequest {
  query?: string;
  mode?: SearchMode;
  folder_id?: UUID;
  include_descendants?: boolean;
  folder_ids?: UUID[];
  tag_ids?: UUID[];
  document_type_id?: UUID;
  correspondent_id?: UUID;
  mime_type?: string;
  is_archived?: boolean;
  inbox?: boolean;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface SearchHit {
  document: Document;
  score: number;
  snippet: string | null;
  page_number: number | null;
  chunk_id: UUID | null;
}

export interface SearchResponse {
  items: SearchHit[];
  total: number;
  mode: string;
  semantic_available: boolean;
}

// ---- Ask / RAG ----

export type AskScope =
  | "document"
  | "documents"
  | "folder"
  | "folder_tree"
  | "search"
  | "library";

export interface AskRequest {
  question: string;
  scope?: AskScope;
  document_id?: UUID;
  document_ids?: UUID[];
  folder_id?: UUID;
  search_query?: string;
  confirm_remote?: boolean;
}

export interface Citation {
  document_id: UUID;
  page_number: number | null;
  chunk_id: UUID;
  title: string;
  quote: string | null;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
  passages: Citation[];
  provider: string | null;
  model: string | null;
  privacy_mode: string;
  is_local: boolean;
  insufficient_evidence: boolean;
}

// ---- Jobs ----

export interface Job {
  id: UUID;
  job_type: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  document_id: UUID | null;
  priority: number;
  retry_count: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// ---- AI ----

export type AIProviderKind =
  | "openai_compatible"
  | "openai"
  | "openrouter"
  | "ollama"
  | "anthropic"
  | "gemini";

export interface AIProvider {
  id: UUID;
  name: string;
  kind: AIProviderKind;
  base_url: string;
  has_api_key: boolean;
  api_key_masked: string | null;
  is_local: boolean;
  enabled: boolean;
  chat_model: string | null;
  embedding_model: string | null;
  vision_model: string | null;
  context_window: number | null;
  max_output_tokens: number | null;
  supports_tools: boolean;
  supports_vision: boolean;
  supports_structured_output: boolean;
  supports_embeddings: boolean;
  no_training: boolean;
  zero_retention: boolean;
}

export interface AIProviderCreate {
  name: string;
  kind: AIProviderKind;
  base_url: string;
  api_key?: string;
  is_local?: boolean;
  chat_model?: string;
  embedding_model?: string;
  vision_model?: string;
  context_window?: number;
  max_output_tokens?: number;
  supports_tools?: boolean;
  supports_vision?: boolean;
  supports_structured_output?: boolean;
  supports_embeddings?: boolean;
  no_training?: boolean;
  zero_retention?: boolean;
}

export interface AIProviderUpdate {
  name?: string;
  base_url?: string;
  api_key?: string;
  clear_api_key?: boolean;
  is_local?: boolean;
  enabled?: boolean;
  chat_model?: string;
  embedding_model?: string;
  vision_model?: string;
  context_window?: number;
  max_output_tokens?: number;
  supports_tools?: boolean;
  supports_vision?: boolean;
  supports_structured_output?: boolean;
  supports_embeddings?: boolean;
  no_training?: boolean;
  zero_retention?: boolean;
}

export type PrivacyMode = "local_only" | "private_hybrid" | "standard";
export type AIProfile = "lightweight" | "balanced" | "quality" | "custom";

export interface AIPolicy {
  privacy_mode: PrivacyMode;
  profile: AIProfile;
  chat_provider_id: UUID | null;
  embedding_provider_id: UUID | null;
  vision_provider_id: UUID | null;
  allow_remote_embeddings: boolean;
  allow_remote_qa: boolean;
  allow_remote_vision: boolean;
  warn_before_remote: boolean;
  block_remote_ai: boolean;
  auto_enrichment: boolean;
  auto_tagging: boolean;
  retrieved_chunks: number;
  max_context_tokens: number;
  max_output_tokens: number;
  conversation_history_tokens: number;
  parallel_llm_calls: number;
  active_embedding_provider: string | null;
  active_embedding_model: string | null;
  active_embedding_dimension: number | null;
  enforcement_note: string;
}

export interface AIPolicyUpdate {
  privacy_mode?: PrivacyMode;
  profile?: AIProfile;
  chat_provider_id?: UUID | null;
  embedding_provider_id?: UUID | null;
  vision_provider_id?: UUID | null;
  allow_remote_embeddings?: boolean;
  allow_remote_qa?: boolean;
  allow_remote_vision?: boolean;
  warn_before_remote?: boolean;
  block_remote_ai?: boolean;
  auto_enrichment?: boolean;
  auto_tagging?: boolean;
  retrieved_chunks?: number;
  max_context_tokens?: number;
  max_output_tokens?: number;
  conversation_history_tokens?: number;
  parallel_llm_calls?: number;
}

export interface AIUsageSummary {
  today: Record<string, unknown>;
  this_month: Record<string, unknown>;
  by_provider: Record<string, unknown>[];
  by_model: Record<string, unknown>[];
  by_operation: Record<string, unknown>[];
}

export interface Suggestion {
  id: UUID;
  document_id: UUID;
  field: string;
  value: Record<string, unknown>;
  status: string;
  provider: string | null;
  model: string | null;
  confidence: number | null;
}

export interface Health {
  status: string;
  version: string;
}

export interface StorageHealth {
  status: string;
  documents_ok: boolean;
  consume_ok: boolean;
  export_ok: boolean;
  documents_path: string;
  consume_path: string;
  export_path: string;
  message: string;
}

export interface Message {
  message: string;
}

export interface TestConnectionResult {
  message: string;
}
