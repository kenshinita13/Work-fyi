export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";
export type TaskStatus =
  "todo" | "in_progress" | "review" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type AiTaskPlanMode = "task_plan" | "subtasks";
export type AiTaskPlanDraftStatus = "pending" | "approved" | "expired";
export type DocumentMimeType =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "text/plain"
  | "text/markdown";
export type DocumentSummary = {
  summary: string;
  highlights: string[];
};
type AiMessageRole = "user" | "assistant" | "system" | "tool";
export type PrimaryRole =
  | "virtual_assistant"
  | "freelancer"
  | "cybersecurity_specialist"
  | "project_manager"
  | "administrator"
  | "other";
export type PrimaryUseCase =
  | "virtual_assistance"
  | "freelancing"
  | "cybersecurity"
  | "project_management"
  | "administration"
  | "personal_productivity";

type Timestamped = {
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Timestamped & {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          timezone: string;
          primary_role: PrimaryRole | null;
          primary_use_case: PrimaryUseCase | null;
          active_workspace_id: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          primary_role?: PrimaryRole | null;
          primary_use_case?: PrimaryUseCase | null;
          active_workspace_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<Database["public"]["Tables"]["profiles"]["Insert"], "id">
        >;
        Relationships: [];
      };
      workspaces: {
        Row: Timestamped & {
          id: string;
          name: string;
          slug: string;
          owner_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<
            Database["public"]["Tables"]["workspaces"]["Insert"],
            "id" | "owner_id"
          >
        >;
        Relationships: [];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at?: string;
        };
        Update: Partial<
          Pick<
            Database["public"]["Tables"]["workspace_members"]["Insert"],
            "role"
          >
        >;
        Relationships: [];
      };
      projects: {
        Row: Timestamped & {
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          status: ProjectStatus;
          created_by: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          description?: string | null;
          status?: ProjectStatus;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<
            Database["public"]["Tables"]["projects"]["Insert"],
            "id" | "workspace_id" | "created_by"
          >
        >;
        Relationships: [];
      };
      tasks: {
        Row: Timestamped & {
          id: string;
          workspace_id: string;
          project_id: string | null;
          parent_task_id: string | null;
          title: string;
          description: string | null;
          status: TaskStatus;
          priority: TaskPriority;
          assigned_to: string | null;
          due_at: string | null;
          completed_at: string | null;
          created_by: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id?: string | null;
          parent_task_id?: string | null;
          title: string;
          description?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority;
          assigned_to?: string | null;
          due_at?: string | null;
          completed_at?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<
            Database["public"]["Tables"]["tasks"]["Insert"],
            "id" | "workspace_id" | "created_by"
          >
        >;
        Relationships: [];
      };
      task_comments: {
        Row: Timestamped & {
          id: string;
          workspace_id: string;
          task_id: string;
          author_id: string;
          body: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          task_id: string;
          author_id: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Pick<Database["public"]["Tables"]["task_comments"]["Insert"], "body">
        >;
        Relationships: [];
      };
      activity_logs: {
        Row: {
          id: string;
          workspace_id: string;
          actor_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          actor_id?: string | null;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      ai_conversations: {
        Row: Timestamped & {
          id: string;
          workspace_id: string;
          user_id: string;
          title: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Pick<
            Database["public"]["Tables"]["ai_conversations"]["Insert"],
            "title"
          >
        >;
        Relationships: [];
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          workspace_id: string;
          user_id: string | null;
          role: AiMessageRole;
          content: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          workspace_id: string;
          user_id?: string | null;
          role: AiMessageRole;
          content: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      ai_usage: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          feature: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          estimated_cost: number | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          feature: string;
          model: string;
          input_tokens?: number;
          output_tokens?: number;
          estimated_cost?: number | null;
          status: string;
          created_at?: string;
        };
        Update: Partial<
          Pick<
            Database["public"]["Tables"]["ai_usage"]["Insert"],
            | "model"
            | "input_tokens"
            | "output_tokens"
            | "estimated_cost"
            | "status"
          >
        >;
        Relationships: [];
      };
      ai_task_plan_drafts: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          project_id: string | null;
          parent_task_id: string | null;
          mode: AiTaskPlanMode;
          plan: Json;
          status: AiTaskPlanDraftStatus;
          expires_at: string;
          approved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          project_id?: string | null;
          parent_task_id?: string | null;
          mode: AiTaskPlanMode;
          plan: Json;
          status?: AiTaskPlanDraftStatus;
          expires_at?: string;
          approved_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Pick<
            Database["public"]["Tables"]["ai_task_plan_drafts"]["Insert"],
            "status" | "approved_at"
          >
        >;
        Relationships: [];
      };
      documents: {
        Row: Timestamped & {
          id: string;
          workspace_id: string;
          project_id: string | null;
          task_id: string | null;
          uploaded_by: string;
          file_name: string;
          storage_path: string;
          mime_type: DocumentMimeType;
          file_size: number;
          summary_draft: DocumentSummary | null;
          summary_model: string | null;
          summary_generated_at: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id?: string | null;
          task_id?: string | null;
          uploaded_by: string;
          file_name: string;
          storage_path: string;
          mime_type: DocumentMimeType;
          file_size: number;
          summary_draft?: DocumentSummary | null;
          summary_model?: string | null;
          summary_generated_at?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Pick<
            Database["public"]["Tables"]["documents"]["Insert"],
            | "project_id"
            | "task_id"
            | "summary_draft"
            | "summary_model"
            | "summary_generated_at"
            | "deleted_at"
            | "deleted_by"
          >
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_workspace_member: {
        Args: { target_workspace: string };
        Returns: boolean;
      };
      has_workspace_role: {
        Args: { target_workspace: string; accepted_roles: WorkspaceRole[] };
        Returns: boolean;
      };
      complete_onboarding: {
        Args: {
          input_full_name: string;
          input_workspace_name: string;
          input_primary_role: PrimaryRole;
          input_primary_use_case: PrimaryUseCase;
          input_timezone: string;
        };
        Returns: string;
      };
      reserve_ai_task_plan_usage: {
        Args: {
          input_workspace_id: string;
          input_user_id: string;
          input_model: string;
        };
        Returns: string;
      };
      approve_ai_task_plan: {
        Args: { input_draft_id: string };
        Returns: number;
      };
      reserve_document_summary_usage: {
        Args: {
          input_workspace_id: string;
          input_user_id: string;
          input_model: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Document = Database["public"]["Tables"]["documents"]["Row"];
