export interface DataRow {
  [key: string]: string | number | boolean | null;
}

export interface Sheet {
  id: string;
  name: string;
  data: DataRow[];
  columns: string[];
  type: 'csv' | 'json';
}

export interface AnalysisResult {
  summary: string;
  insights: string[];
}
