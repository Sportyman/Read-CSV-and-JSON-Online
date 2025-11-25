import { DataRow, Sheet } from '../types';
import * as XLSX from 'xlsx';
import yaml from 'js-yaml';
import { XMLParser } from 'fast-xml-parser';
import mammoth from 'mammoth';

export const generateId = (): string => Math.random().toString(36).substring(2, 9);

// Helper to flatten nested objects for grid display
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

const processDataArray = (dataArray: any[]): { data: DataRow[], columns: string[] } => {
  if (!Array.isArray(dataArray) || dataArray.length === 0) return { data: [], columns: [] };

  const flatData = dataArray.map(item => {
    if (typeof item === 'object' && item !== null) {
      return flattenObject(item);
    }
    return { value: item }; // Handle primitives
  });
  
  const columnsSet = new Set<string>();
  flatData.forEach(row => Object.keys(row).forEach(k => columnsSet.add(k)));
  const columns = Array.from(columnsSet);

  return { data: flatData, columns };
};

export const parseCSV = (content: string): { data: DataRow[], columns: string[] } => {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) return { data: [], columns: [] };

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
      dataArray = [parsed];
    }

    return processDataArray(dataArray);

  } catch (e) {
    console.error("Invalid JSON", e);
    return { data: [], columns: [] };
  }
};

export const parseYAML = (content: string): { data: DataRow[], columns: string[] } => {
  try {
    const parsed = yaml.load(content);
    let dataArray: any[] = [];
    if (Array.isArray(parsed)) {
      dataArray = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      dataArray = [parsed];
    }
    return processDataArray(dataArray);
  } catch (e) {
    console.error("Invalid YAML", e);
    return { data: [], columns: [] };
  }
};

export const parseXML = (content: string): { data: DataRow[], columns: string[] } => {
  try {
    const parser = new XMLParser();
    const parsed = parser.parse(content);
    // XML usually has a root element, try to find the array
    let dataArray: any[] = [];
    
    // Naive attempt to find the list in XML
    const rootKeys = Object.keys(parsed);
    if (rootKeys.length > 0) {
       const root = parsed[rootKeys[0]];
       if (Array.isArray(root)) {
         dataArray = root;
       } else if (typeof root === 'object') {
         // Check if any child is an array
         const arrayChild = Object.values(root).find(v => Array.isArray(v));
         if (arrayChild && Array.isArray(arrayChild)) {
           dataArray = arrayChild;
         } else {
           dataArray = [root];
         }
       }
    }

    return processDataArray(dataArray);
  } catch (e) {
    console.error("Invalid XML", e);
    return { data: [], columns: [] };
  }
};

export const parseXLSX = (buffer: ArrayBuffer): { data: DataRow[], columns: string[] } => {
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json(ws);
    return processDataArray(rawData);
  } catch (e) {
    console.error("Invalid Excel", e);
    return { data: [], columns: [] };
  }
};

export const parseDOCX = async (buffer: ArrayBuffer): Promise<{ data: DataRow[], columns: string[] }> => {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    const text = result.value;
    // For DOCX, we treat paragraphs as lines.
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const data = lines.map((line, index) => ({
      Line: index + 1,
      Content: line
    }));
    return { data, columns: ['Line', 'Content'] };
  } catch (e) {
    console.error("Invalid DOCX", e);
    return { data: [], columns: [] };
  }
};

export const parseTXT = (content: string): { data: DataRow[], columns: string[] } => {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  const data = lines.map((line, index) => ({
    Line: index + 1,
    Content: line
  }));
  return { data, columns: ['Line', 'Content'] };
};

export const exportToCSV = (data: DataRow[], columns: string[]): string => {
  const headerRow = columns.join(',');
  const rows = data.map(row => {
    return columns.map(col => {
      let val = row[col];
      if (val === null || val === undefined) val = '';
      val = String(val);
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',');
  });
  return [headerRow, ...rows].join('\n');
};

export const exportToExcel = (data: DataRow[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  if (!filename.endsWith('.xlsx')) filename += '.xlsx';
  XLSX.writeFile(wb, filename);
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