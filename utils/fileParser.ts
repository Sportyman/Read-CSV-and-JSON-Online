import { DataRow, Sheet } from '../types';

export const generateId = (): string => Math.random().toString(36).substring(2, 9);

export const parseCSV = (content: string): { data: DataRow[], columns: string[] } => {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) return { data: [], columns: [] };

  // Simple CSV parser handling quotes
  const parseLine = (text: string) => {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const data: DataRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === headers.length) {
      const row: DataRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push(row);
    }
  }

  return { data, columns: headers };
};

export const parseJSON = (content: string): { data: DataRow[], columns: string[] } => {
  try {
    const parsed = JSON.parse(content);
    let dataArray: any[] = [];

    if (Array.isArray(parsed)) {
      dataArray = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      // If it's a single object, wrap it in an array
      dataArray = [parsed];
    } else {
      return { data: [], columns: [] };
    }

    if (dataArray.length === 0) return { data: [], columns: [] };

    // Flatten logic for simple 1-level depth needed for grid
    const flattenObject = (obj: any, prefix = '', res: any = {}) => {
      for (const key in obj) {
        const val = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          flattenObject(val, newKey, res);
        } else {
          res[newKey] = Array.isArray(val) ? JSON.stringify(val) : val;
        }
      }
      return res;
    };

    const flatData = dataArray.map(item => flattenObject(item));
    
    // Collect all unique keys for columns
    const columnsSet = new Set<string>();
    flatData.forEach(row => Object.keys(row).forEach(k => columnsSet.add(k)));
    const columns = Array.from(columnsSet);

    return { data: flatData, columns };

  } catch (e) {
    console.error("Invalid JSON", e);
    return { data: [], columns: [] };
  }
};

export const exportToCSV = (data: DataRow[], columns: string[]): string => {
  const headerRow = columns.join(',');
  const rows = data.map(row => {
    return columns.map(col => {
      let val = row[col];
      if (val === null || val === undefined) val = '';
      val = String(val);
      // Escape quotes and wrap in quotes if contains comma or quote
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',');
  });
  return [headerRow, ...rows].join('\n');
};

export const downloadFile = (content: string, filename: string, type: 'csv' | 'json') => {
  const blob = new Blob([content], { type: type === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};