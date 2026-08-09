import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { api, clearSession, handleSessionResponse } from "./client";
import type {
  AIProvider,
  AIProviderCreate,
  AIProviderUpdate,
  AIPolicy,
  AIPolicyUpdate,
  AIUsageSummary,
  AskRequest,
  AskResponse,
  BulkActionRequest,
  Document,
  DocumentList,
  DocumentListParams,
  DocumentMetadataUpdate,
  DocumentMoveRequest,
  DocumentPageContent,
  Folder,
  FolderCreate,
  FolderDeleteRequest,
  FolderUpdate,
  Job,
  LoginRequest,
  Message,
  NamedEntity,
  NamedEntityCreate,
  PasswordChangeRequest,
  ProfileUpdateRequest,
  RegisterRequest,
  SearchRequest,
  SearchResponse,
  Session,
  StorageHealth,
  Tag,
  TagCreate,
  TagUpdate,
  TestConnectionResult,
  User,
  UserAdmin,
  UserUsage,
  Invite,
  PasswordResetRequest,
} from "./types";

// ---- Query keys ----

export const queryKeys = {
  session: ["session"] as const,
  folders: ["folders"] as const,
  folder: (id: string) => ["folders", id] as const,
  tags: ["tags"] as const,
  documentTypes: ["document-types"] as const,
  correspondents: ["correspondents"] as const,
  documents: (params: DocumentListParams) => ["documents", params] as const,
  document: (id: string) => ["documents", id] as const,
  documentContent: (id: string) => ["documents", id, "content"] as const,
  folderDocuments: (folderId: string, params: DocumentListParams) =>
    ["folders", folderId, "documents", params] as const,
  search: (req: SearchRequest) => ["search", req] as const,
  jobs: (status?: string) => ["jobs", status] as const,
  job: (id: string) => ["jobs", id] as const,
  aiProviders: ["ai", "providers"] as const,
  aiPolicy: ["ai", "policy"] as const,
  aiUsage: ["ai", "usage"] as const,
  storageHealth: ["storage", "health"] as const,
  health: ["health"] as const,
};

// ---- Auth ----

export function useSession(options?: Partial<UseQueryOptions<Session | null>>) {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: async () => {
      try {
        const session = await api.get<Session>("/api/auth/me");
        handleSessionResponse(session);
        return session;
      } catch {
        clearSession();
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      const session = await api.post<Session>("/api/auth/login", data);
      handleSessionResponse(session);
      return session;
    },
    onSuccess: (session) => {
      qc.setQueryData(queryKeys.session, session);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Message>("/api/auth/logout"),
    onSuccess: () => {
      clearSession();
      qc.setQueryData(queryKeys.session, null);
      qc.clear();
    },
  });
}

export function useRegistrationStatus() {
  return useQuery({
    queryKey: ["auth", "registration-status"] as const,
    queryFn: () =>
      api.get<{ allow_registration: boolean }>("/api/auth/registration-status"),
    staleTime: 60_000,
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: RegisterRequest) => {
      const session = await api.post<Session>("/api/auth/register", data);
      handleSessionResponse(session);
      return session;
    },
    onSuccess: (session) => {
      qc.setQueryData(queryKeys.session, session);
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProfileUpdateRequest) =>
      api.patch<User>("/api/auth/me", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.session }),
  });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PasswordChangeRequest) =>
      api.post<Message>("/api/auth/me/password", data),
    onSuccess: () => {
      clearSession();
      qc.setQueryData(queryKeys.session, null);
      qc.clear();
    },
  });
}

export function useMyUsage() {
  return useQuery({
    queryKey: ["auth", "usage"] as const,
    queryFn: () => api.get<UserUsage>("/api/auth/me/usage"),
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload<User>("/api/auth/me/avatar", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.session }),
  });
}

export function useDeleteAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<User>("/api/auth/me/avatar"),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.session }),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (username: string) =>
      api.post<{ message: string }>("/api/auth/forgot-password", { username }),
  });
}

export function useValidateResetToken(token: string | null) {
  return useQuery({
    queryKey: ["auth", "reset-validate", token] as const,
    queryFn: () =>
      api.get<{ valid: boolean; username: string | null }>(
        "/api/auth/reset-password/validate",
        { token },
      ),
    enabled: !!token,
    retry: false,
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (data: { token: string; new_password: string }) =>
      api.post<{ message: string }>("/api/auth/reset-password", data),
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["users"] as const,
    queryFn: () => api.get<UserAdmin[]>("/api/users"),
  });
}

export function usePasswordResetRequests(enabled = true) {
  return useQuery({
    queryKey: ["password-resets"] as const,
    queryFn: () => api.get<PasswordResetRequest[]>("/api/users/password-resets"),
    refetchInterval: enabled ? 30_000 : false,
    enabled,
  });
}

export function useApprovePasswordReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<PasswordResetRequest>(`/api/users/password-resets/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["password-resets"] }),
  });
}

export function useRejectPasswordReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ message: string }>(`/api/users/password-resets/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["password-resets"] }),
  });
}

export function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        is_admin?: boolean;
        is_active?: boolean;
        storage_quota_bytes?: number | null;
        ai_monthly_request_quota?: number | null;
        clear_storage_quota?: boolean;
        clear_ai_quota?: boolean;
      };
    }) => api.patch<UserAdmin>(`/api/users/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Message>(`/api/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useAdminSetPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.post<Message>(`/api/users/${id}/password`, { password }),
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: {
      expires_in_hours?: number;
      storage_quota_bytes?: number | null;
      ai_monthly_request_quota?: number | null;
    }) => api.post<Invite>("/api/users/invites", data ?? {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });
}

export function useInvites() {
  return useQuery({
    queryKey: ["invites"] as const,
    queryFn: () => api.get<Invite[]>("/api/users/invites"),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Message>(`/api/users/invites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });
}

// ---- Folders ----

export function useFolders(trashed = false) {
  return useQuery({
    queryKey: trashed ? (["folders", "trashed"] as const) : queryKeys.folders,
    queryFn: () =>
      api.get<Folder[]>("/api/folders", trashed ? { trashed: true } : undefined),
  });
}

export function useFolder(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.folder(id ?? ""),
    queryFn: () => api.get<Folder>(`/api/folders/${id}`),
    enabled: !!id,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FolderCreate) => api.post<Folder>("/api/folders", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.folders }),
  });
}

export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FolderUpdate }) =>
      api.patch<Folder>(`/api/folders/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.folders }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FolderDeleteRequest }) =>
      api.delete<void>(`/api/folders/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}

export function useTrashFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Folder>(`/api/folders/${id}/trash`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}

export function useRestoreFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Folder>(`/api/folders/${id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}

export function usePurgeFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ message: string }>(`/api/folders/${id}/purge`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}

export function useTrashCount() {
  return useQuery({
    queryKey: ["trash", "count"] as const,
    queryFn: () =>
      api.get<{ documents: number; folders: number; total: number; retention_days: number }>(
        "/api/trash/count",
      ),
    refetchInterval: 15_000,
  });
}

export function useEmptyTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ message: string }>("/api/trash/empty"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}

// ---- Tags ----

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags,
    queryFn: () => api.get<Tag[]>("/api/tags"),
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TagCreate) => api.post<Tag>("/api/tags", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tags }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TagUpdate }) =>
      api.patch<Tag>(`/api/tags/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tags }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/tags/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tags }),
  });
}

export function useDocumentTypes() {
  return useQuery({
    queryKey: queryKeys.documentTypes,
    queryFn: () => api.get<NamedEntity[]>("/api/document-types"),
  });
}

export function useCorrespondents() {
  return useQuery({
    queryKey: queryKeys.correspondents,
    queryFn: () => api.get<NamedEntity[]>("/api/correspondents"),
  });
}

export function useCreateDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NamedEntityCreate) =>
      api.post<NamedEntity>("/api/document-types", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.documentTypes }),
  });
}

export function useCreateCorrespondent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NamedEntityCreate) =>
      api.post<NamedEntity>("/api/correspondents", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.correspondents }),
  });
}

// ---- Documents ----

function documentParamsToQuery(params: DocumentListParams): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = {};
  if (params.folder_id) q.folder_id = params.folder_id;
  if (params.include_descendants) q.include_descendants = true;
  if (params.inbox !== undefined) q.inbox = params.inbox;
  if (params.trashed) q.trashed = true;
  if (params.tag_ids?.length) q.tag_ids = params.tag_ids.join(",");
  if (params.q) q.q = params.q;
  if (params.page) q.page = params.page;
  if (params.page_size) q.page_size = params.page_size;
  if (params.sort) q.sort = params.sort;
  if (params.order) q.order = params.order;
  return q;
}

export function useDocuments(params: DocumentListParams = {}) {
  return useQuery({
    queryKey: queryKeys.documents(params),
    queryFn: () =>
      api.get<DocumentList>("/api/documents", documentParamsToQuery(params)),
  });
}

export function useFolderDocuments(folderId: string | undefined, params: DocumentListParams = {}) {
  const merged = { ...params, folder_id: folderId };
  return useQuery({
    queryKey: queryKeys.folderDocuments(folderId ?? "", merged),
    queryFn: () =>
      api.get<DocumentList>(
        `/api/folders/${folderId}/documents`,
        documentParamsToQuery(params),
      ),
    enabled: !!folderId,
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.document(id ?? ""),
    queryFn: () => api.get<Document>(`/api/documents/${id}`),
    enabled: !!id,
  });
}

export function useDocumentContent(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.documentContent(id ?? ""),
    queryFn: () => api.get<DocumentPageContent[]>(`/api/documents/${id}/content`),
    enabled: !!id,
  });
}

export function useUpdateDocumentMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DocumentMetadataUpdate }) =>
      api.patch<Document>(`/api/documents/${id}/metadata`, data),
    onSuccess: (doc) => {
      qc.setQueryData(queryKeys.document(doc.id), doc);
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useMoveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DocumentMoveRequest }) =>
      api.post<Document>(`/api/documents/${id}/move`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: queryKeys.folders });
    },
  });
}

export function useTrashDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Document>(`/api/documents/${id}/trash`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: queryKeys.folders });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}

export function useRestoreDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Document>(`/api/documents/${id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: queryKeys.folders });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/documents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}

export function useBulkAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkActionRequest) =>
      api.post<Message>("/api/documents/bulk", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: queryKeys.folders });
      qc.invalidateQueries({ queryKey: queryKeys.tags });
      qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, folderId }: { file: File; folderId?: string }) => {
      const form = new FormData();
      form.append("file", file);
      if (folderId) form.append("folder_id", folderId);
      return api.upload<Document>("/api/documents/upload", form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: queryKeys.folders });
    },
  });
}

// ---- Search ----

export function useSearch(request: SearchRequest, enabled = true) {
  return useQuery({
    queryKey: queryKeys.search(request),
    queryFn: () => api.post<SearchResponse>("/api/search", request),
    enabled: enabled && !!request.query?.trim(),
  });
}

export function useSearchMutation() {
  return useMutation({
    mutationFn: (request: SearchRequest) =>
      api.post<SearchResponse>("/api/search", request),
  });
}

// ---- Ask ----

export function useAskDocument() {
  return useMutation({
    mutationFn: ({ documentId, ...body }: AskRequest & { documentId: string }) =>
      api.post<AskResponse>(`/api/documents/${documentId}/ask`, body),
  });
}

export function useAsk() {
  return useMutation({
    mutationFn: (body: AskRequest) => api.post<AskResponse>("/api/ask", body),
  });
}

// ---- Jobs ----

export function useJobs(status?: string) {
  return useQuery({
    queryKey: queryKeys.jobs(status),
    queryFn: () => api.get<Job[]>("/api/jobs", status ? { status } : undefined),
    refetchInterval: 5000,
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.job(id ?? ""),
    queryFn: () => api.get<Job>(`/api/jobs/${id}`),
    enabled: !!id,
    refetchInterval: 3000,
  });
}

export function useCancelJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Job>(`/api/jobs/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

// ---- AI ----

export function useAIProviders() {
  return useQuery({
    queryKey: queryKeys.aiProviders,
    queryFn: () => api.get<AIProvider[]>("/api/ai/providers"),
  });
}

export function useCreateAIProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AIProviderCreate) =>
      api.post<AIProvider>("/api/ai/providers", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.aiProviders }),
  });
}

export function useUpdateAIProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AIProviderUpdate }) =>
      api.patch<AIProvider>(`/api/ai/providers/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.aiProviders }),
  });
}

export function useDeleteAIProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/ai/providers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.aiProviders }),
  });
}

export function useTestAIProvider() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<TestConnectionResult>(`/api/ai/providers/${id}/test`),
  });
}

export function useAIPolicy() {
  return useQuery({
    queryKey: queryKeys.aiPolicy,
    queryFn: () => api.get<AIPolicy>("/api/ai/policy"),
  });
}

export function useUpdateAIPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AIPolicyUpdate) =>
      api.patch<AIPolicy>("/api/ai/policy", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.aiPolicy }),
  });
}

export function useAIUsage() {
  return useQuery({
    queryKey: queryKeys.aiUsage,
    queryFn: () => api.get<AIUsageSummary>("/api/ai/usage"),
  });
}

// ---- Health / Storage ----

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.get<{ status: string; version: string }>("/health"),
    retry: 1,
  });
}

export function useStorageHealth() {
  return useQuery({
    queryKey: queryKeys.storageHealth,
    queryFn: () => api.get<StorageHealth>("/health/storage"),
  });
}

// ---- Inbox count ----

export function useInboxCount() {
  return useQuery({
    queryKey: ["inbox-count"],
    queryFn: async () => {
      const result = await api.get<DocumentList>("/api/documents", {
        inbox: true,
        page_size: 1,
      });
      return result.total;
    },
    staleTime: 30_000,
  });
}
