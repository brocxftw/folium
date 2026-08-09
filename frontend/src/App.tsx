import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthGuard, GuestGuard } from "@/features/auth/AuthGuard";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { InboxPage } from "@/features/inbox/InboxPage";
import { DocumentsPage } from "@/features/documents/DocumentsPage";
import { LegacyDocumentsRedirect } from "@/features/documents/LegacyDocumentsRedirect";
import { SearchPage } from "@/features/search/SearchPage";
import { AskPage } from "@/features/ask/AskPage";
import { JobsPage } from "@/features/jobs/JobsPage";
import {
  SettingsLayout,
  ProfileSettingsPage,
  UsersSettingsPage,
  StorageSettingsPage,
  AIProvidersSettingsPage,
  AIPolicySettingsPage,
  AIProfilesSettingsPage,
  SystemSettingsPage,
} from "@/features/settings/SettingsLayout";
import { TrashPage } from "@/features/trash/TrashPage";
import { NotFoundPage } from "@/features/not-found/NotFoundPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<GuestGuard />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          <Route element={<AuthGuard />}>
            <Route path="/" element={<Navigate to="/documents" replace />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route
              path="/documents/folder/:folderId"
              element={<LegacyDocumentsRedirect />}
            />
            <Route
              path="/documents/folder/:folderId/:documentId"
              element={<LegacyDocumentsRedirect />}
            />
            <Route
              path="/documents/:documentId"
              element={<LegacyDocumentsRedirect />}
            />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/ask" element={<AskPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/trash" element={<TrashPage />} />
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<ProfileSettingsPage />} />
              <Route path="users" element={<UsersSettingsPage />} />
              <Route path="storage" element={<StorageSettingsPage />} />
              <Route path="ai-providers" element={<AIProvidersSettingsPage />} />
              <Route path="ai-policy" element={<AIPolicySettingsPage />} />
              <Route path="ai-profiles" element={<AIProfilesSettingsPage />} />
              <Route path="system" element={<SystemSettingsPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
