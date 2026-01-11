/**
 * API request/response types matching context.md contract
 */

export interface AnalyzeRequest {
  url: string;
}

export interface BatchAnalyzeRequest {
  urls: string[];
}

export interface BatchAnalyzeItemResult {
  url: string;
  success: boolean;
  data?: AnalyzeResponse;
  error?: string;
}

export interface BatchAnalyzeResponse {
  results: BatchAnalyzeItemResult[];
  total: number;
  successful: number;
  failed: number;
}

export interface FormatInfo {
  format_id: string;
  ext: string;
  resolution: string;
  filesize: string;
  type: 'audio' | 'video';
}

export interface AnalyzeResponse {
  title: string;
  thumbnail: string;
  duration: string;
  formats: FormatInfo[];
}

