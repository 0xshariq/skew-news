/**
 * Hand-written Supabase types mirroring `supabase/schema.sql` (AGENTS.md §7).
 * Keep this file, the schema, and `.env.example` in sync when fields change.
 * The `embedding` column on `article_analyses` is added in §20, not here.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SentimentLabelValue = "positive" | "neutral" | "negative";
export type BiasLabelValue = "left" | "center" | "right" | "mixed" | "unclear";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Database {
  public: {
    Tables: {
      sources: {
        Row: {
          id: string;
          name: string;
          listing_url: string;
          parser_strategy: string | null;
          active: boolean;
          logo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          listing_url: string;
          parser_strategy?: string | null;
          active?: boolean;
          logo_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          listing_url?: string;
          parser_strategy?: string | null;
          active?: boolean;
          logo_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      articles: {
        Row: {
          id: string;
          source_id: string;
          url: string;
          canonical_url: string | null;
          title: string;
          image_url: string;
          published_at: string;
          raw_text: string;
          scraped_at: string;
          analyzed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          url: string;
          canonical_url?: string | null;
          title: string;
          image_url: string;
          published_at: string;
          raw_text?: string;
          scraped_at?: string;
          analyzed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_id?: string;
          url?: string;
          canonical_url?: string | null;
          title?: string;
          image_url?: string;
          published_at?: string;
          raw_text?: string;
          scraped_at?: string;
          analyzed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "articles_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      article_analyses: {
        Row: {
          id: string;
          article_id: string;
          summary: string;
          sentiment_score: number;
          sentiment_label: SentimentLabelValue;
          bias_score: number;
          bias_label: BiasLabelValue;
          left_percentage: number;
          center_percentage: number;
          right_percentage: number;
          confidence: number;
          framing_notes: string | null;
          loaded_terms: string[];
          disclaimer: string | null;
          model: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          summary: string;
          sentiment_score: number;
          sentiment_label: SentimentLabelValue;
          bias_score: number;
          bias_label: BiasLabelValue;
          left_percentage: number;
          center_percentage: number;
          right_percentage: number;
          confidence: number;
          framing_notes?: string | null;
          loaded_terms?: string[];
          disclaimer?: string | null;
          model: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          article_id?: string;
          summary?: string;
          sentiment_score?: number;
          sentiment_label?: SentimentLabelValue;
          bias_score?: number;
          bias_label?: BiasLabelValue;
          left_percentage?: number;
          center_percentage?: number;
          right_percentage?: number;
          confidence?: number;
          framing_notes?: string | null;
          loaded_terms?: string[];
          disclaimer?: string | null;
          model?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "article_analyses_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: true;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
      };
      logs: {
        Row: {
          id: string;
          level: LogLevel;
          event: string;
          message: string | null;
          context: Json | null;
          source_id: string | null;
          article_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          level?: LogLevel;
          event: string;
          message?: string | null;
          context?: Json | null;
          source_id?: string | null;
          article_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          level?: LogLevel;
          event?: string;
          message?: string | null;
          context?: Json | null;
          source_id?: string | null;
          article_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "logs_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "logs_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
      };
      oxylabs_schedules: {
        Row: {
          id: string;
          schedule_id: string;
          source_id: string;
          cron: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          source_id: string;
          cron: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          schedule_id?: string;
          source_id?: string;
          cron?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oxylabs_schedules_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      oxylabs_schedule_runs: {
        Row: {
          id: string;
          schedule_id: string;
          run_id: string;
          job_id: string | null;
          result_status: string | null;
          processed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          run_id: string;
          job_id?: string | null;
          result_status?: string | null;
          processed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          schedule_id?: string;
          run_id?: string;
          job_id?: string | null;
          result_status?: string | null;
          processed?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oxylabs_schedule_runs_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "oxylabs_schedules";
            referencedColumns: ["schedule_id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
  };
}

// Row convenience types
export type Source = Database["public"]["Tables"]["sources"]["Row"];
export type Article = Database["public"]["Tables"]["articles"]["Row"];
export type ArticleAnalysis =
  Database["public"]["Tables"]["article_analyses"]["Row"];
export type Log = Database["public"]["Tables"]["logs"]["Row"];
export type OxylabsSchedule =
  Database["public"]["Tables"]["oxylabs_schedules"]["Row"];
export type OxylabsScheduleRun =
  Database["public"]["Tables"]["oxylabs_schedule_runs"]["Row"];

// Insert convenience types
export type SourceInsert = Database["public"]["Tables"]["sources"]["Insert"];
export type ArticleInsert = Database["public"]["Tables"]["articles"]["Insert"];
export type ArticleAnalysisInsert =
  Database["public"]["Tables"]["article_analyses"]["Insert"];
export type LogInsert = Database["public"]["Tables"]["logs"]["Insert"];
export type OxylabsScheduleInsert =
  Database["public"]["Tables"]["oxylabs_schedules"]["Insert"];
export type OxylabsScheduleRunInsert =
  Database["public"]["Tables"]["oxylabs_schedule_runs"]["Insert"];
