import React, { useState, useRef, useCallback } from 'react';
import { Sheet } from './types';
import { 
  generateId, 
  parseCSV, 
  parseJSON, 
  parseXLSX, 
  parseDOCX, 
  parseXML, 
  parseYAML,
  exportToCSV, 
  exportToExcel, 
  downloadFile 
} from './utils/fileParser';
import DataGrid, { DataGridHandle } from './components/DataGrid';
import AnalysisSidebar from './components/AnalysisSidebar';
import { 
  Plus, 
  Upload, 
  FileSpreadsheet, 
  FileJson, 
  FileText,
  FileCode,
  X, 
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  GitCompare,
  Maximize,
  Download,
  ChevronDown
} from 'lucide-react';

const App: React.FC = () => {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [compareSheetId, setCompareSheetId] = useState<string | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataGridRef = useRef<DataGridHandle>(null);

  const activeSheet = sheets.find(s => s.id === activeSheetId);
  const comparisonSheet = isCompareMode && compareSheetId 
    ? sheets.find(s => s.id === compareSheetId) 
    : null;

  const handleFileUpload = async (file: File) => {
    const name = file.name.toLowerCase();
    const id = generateId();
    let newSheet: Sheet | null = null;
    let type: 'csv' | 'json' = 'csv'; // Default UI icon type

    try {
      if (name.endsWith('.csv')) {
        const text = await file.text();
        const { data, columns } = parseCSV(text);
        newSheet = { id, name: file.name, data, columns, type: 'csv' };
      } else if (name.endsWith('.json')) {
        const text = await file.text();
        const { data, columns } = parseJSON(text);
        newSheet = { id, name: file.name, data, columns, type: 'json' };
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const { data, columns } = parseXLSX(buffer);
        newSheet = { id, name: file.name, data, columns, type: 'csv' }; // Treat as grid
      } else if (name.endsWith('.docx')) {
        const buffer = await file.arrayBuffer();
        const { data, columns } = await parseDOCX(buffer);
        newSheet = { id, name: file.name, data, columns, type: 'csv' };
      } else if (name.endsWith('.xml')) {
        const text = await file.text();
        const { data, columns } = parseXML(text);
        newSheet = { id, name: file.name, data, columns, type: 'json' };
      } else if (name.endsWith('.yaml') || name.endsWith('.yml')) {
        const text = await file.text();
        const { data, columns } = parseYAML(text);
        newSheet = { id, name: file.name, data, columns, type: 'json' };
      } else {
        alert("פורמט לא נתמך. אנא השתמש ב-CSV, JSON, Excel, Word, XML או YAML.");
        return;
      }

      if (newSheet && newSheet.data.length > 0) {
        setSheets(prev => [...prev, newSheet!]);
        setActiveSheetId(id);
      } else {
        alert("לא נמצא מידע בקובץ או שהקריאה נכשלה.");
      }
    } catch (e) {
      console.error("Error parsing file", e);
      alert("שגיאה בקריאת הקובץ.");
    }
  };

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      files.forEach((file) => handleFileUpload(file as File));
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((file) => handleFileUpload(file as File));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSheets(prev => {
      const newSheets = prev.filter(s => s.id !== id);
      if (activeSheetId === id) {
        setActiveSheetId(newSheets.length > 0 ? newSheets[newSheets.length - 1].id : null);
      }
      return newSheets;
    });
    if (compareSheetId === id) {
      setCompareSheetId(null);
      setIsCompareMode(false);
    }
  };

  const createEmptySheet = () => {
    const id = generateId();
    const newSheet: Sheet = {
      id,
      name: `New Sheet ${sheets.length + 1}`,
      data: [],
      columns: [],
      type: 'csv'
    };
    setSheets(prev => [...prev, newSheet]);
    setActiveSheetId(id);
  };

  const adjustZoom = (delta: number) => {
    setZoomLevel(prev => Math.min(Math.max(20, prev + delta), 200));
  };

  const handleAutoResize = () => {
    if (dataGridRef.current) {
      dataGridRef.current.autoSizeColumns();
    }
  };

  const handleCellEdit = (rowIndex: number, colKey: string, value: string) => {
    if (!activeSheetId) return;

    setSheets(prevSheets => prevSheets.map(sheet => {
      if (sheet.id === activeSheetId) {
        const newData = [...sheet.data];
        newData[rowIndex] = { ...newData[rowIndex], [colKey]: value };
        return { ...sheet, data: newData };
      }
      return sheet;
    }));
  };

  const handleSave = (format: 'original' | 'excel') => {
    if (!activeSheet) return;
    setShowSaveMenu(false);

    if (format === 'excel') {
        exportToExcel(activeSheet.data, activeSheet.name);
        return;
    }

    // Original Format export logic
    let content = '';
    let filename = activeSheet.name;
    const type = activeSheet.type;

    if (type === 'json') {
      content = JSON.stringify(activeSheet.data, null, 2);
      if (!filename.toLowerCase().endsWith('.json')) filename += '.json';
    } else {
      content = exportToCSV(activeSheet.data, activeSheet.columns);
      if (!filename.toLowerCase().endsWith('.csv')) filename += '.csv';
    }

    downloadFile(content, filename, type);
  };

  // Helper to render icon
  const getIconForSheet = (name: string, type: 'csv' | 'json') => {
    if (name.endsWith('.docx')) return <FileText size={14} className="ml-2 opacity-70" />;
    if (name.endsWith('.xml') || name.endsWith('.yaml') || name.endsWith('.yml')) return <FileCode size={14} className="ml-2 opacity-70" />;
    if (type === 'json') return <FileJson size={14} className="ml-2 opacity-70" />;
    return <FileSpreadsheet size={14} className="ml-2 opacity-70" />;
  };

  return (
    <div 
      className="flex flex-col h-screen w-full relative"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/20 z-50 flex items-center justify-center backdrop-blur-sm border-4 border-blue-500 border-dashed m-4 rounded-xl pointer-events-none">
          <div className="text-blue-600 font-bold text-2xl flex flex-col items-center bg-white/50 p-6 rounded-2xl shadow-lg backdrop-blur-md">
            <Upload size={48} className="mb-4" />
            <span>שחרר קבצים כאן לפתיחה (CSV, JSON, Excel, Word, XML)</span>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="h-12 bg-slate-800 flex items-end px-2 space-x-1 space-x-reverse overflow-x-auto select-none shadow-md z-20 shrink-0">
        <div className="flex items-center text-white px-4 h-full font-bold tracking-wider text-lg min-w-max">
          <FileSpreadsheet className="ml-2 text-green-400" />
          Read CSV & JSON Online
        </div>

        {sheets.map(sheet => (
          <div
            key={sheet.id}
            onClick={() => setActiveSheetId(sheet.id)}
            className={`
              group relative flex items-center min-w-[120px] max-w-[200px] h-9 px-3 rounded-t-lg text-sm cursor-pointer transition-all duration-200 border-b-0
              ${activeSheetId === sheet.id 
                ? 'bg-slate-50 text-slate-800 font-semibold shadow-[0_-2px_10px_rgba(0,0,0,0.1)]' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }
            `}
          >
            {getIconForSheet(sheet.name, sheet.type)}
            <span className="truncate flex-1">{sheet.name}</span>
            <button 
              onClick={(e) => closeTab(e, sheet.id)}
              className={`mr-2 p-0.5 rounded-full hover:bg-red-100 hover:text-red-500 transition-opacity ${activeSheetId === sheet.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            >
              <X size={12} />
            </button>
          </div>
        ))}

        <button 
          onClick={createEmptySheet}
          className="h-8 w-8 mb-0.5 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0 overflow-x-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3 ml-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleInputChange}
              className="hidden"
              multiple
              accept=".csv,.json,.xlsx,.xls,.docx,.xml,.yaml,.yml"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
            >
              <Upload size={16} />
              פתח קובץ
            </button>
            
            {activeSheet && (
              <div className="relative">
                <button 
                  onClick={() => setShowSaveMenu(!showSaveMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-200 transition-colors shadow-sm whitespace-nowrap"
                >
                  <Download size={16} />
                  שמור / הורד
                  <ChevronDown size={12} />
                </button>
                
                {showSaveMenu && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-48 overflow-hidden">
                    <button 
                       onClick={() => handleSave('original')} 
                       className="w-full text-right px-4 py-2 hover:bg-blue-50 text-slate-700 text-sm flex items-center gap-2"
                    >
                      <FileJson size={14} />
                      פורמט מקורי
                    </button>
                    <button 
                       onClick={() => handleSave('excel')} 
                       className="w-full text-right px-4 py-2 hover:bg-blue-50 text-slate-700 text-sm flex items-center gap-2"
                    >
                      <FileSpreadsheet size={14} />
                      Excel (.xlsx)
                    </button>
                  </div>
                )}
                {showSaveMenu && (
                    <div className="fixed inset-0 z-40" onClick={() => setShowSaveMenu(false)}></div>
                )}
              </div>
            )}
          </div>

          {activeSheet && (
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
              <button onClick={() => adjustZoom(-10)} className="p-1 hover:bg-white rounded text-slate-600" title="הקטן תצוגה">
                <ZoomOut size={16} />
              </button>
              <span className="text-xs font-mono w-10 text-center select-none">{zoomLevel}%</span>
              <button onClick={() => adjustZoom(10)} className="p-1 hover:bg-white rounded text-slate-600" title="הגדל תצוגה">
                <ZoomIn size={16} />
              </button>
              <button onClick={() => setZoomLevel(100)} className="p-1 hover:bg-white rounded text-slate-600 ml-1 border-r border-slate-200 pr-1" title="אפס זום">
                <RotateCcw size={14} />
              </button>
              
              <button 
                onClick={handleAutoResize}
                className="flex items-center gap-1 px-2 py-1 hover:bg-white rounded text-slate-700 text-xs font-medium ml-1"
                title="התאמת רוחב עמודות לתוכן"
              >
                <Maximize size={14} />
                <span className="hidden xl:inline">התאם רוחב</span>
              </button>
            </div>
          )}
          
          {activeSheet && sheets.length > 1 && (
             <div className="flex items-center gap-2 mr-2 bg-slate-50 p-1 px-2 rounded-lg border border-slate-200">
               <div className="flex items-center gap-1 text-slate-600">
                 <GitCompare size={16} />
                 <span className="text-sm font-medium hidden md:inline">השוואה:</span>
               </div>
               <select 
                 className="text-sm bg-white border border-slate-300 rounded px-2 py-1 outline-none focus:border-blue-500 max-w-[150px]"
                 value={isCompareMode && compareSheetId ? compareSheetId : ''}
                 onChange={(e) => {
                   if (e.target.value) {
                     setCompareSheetId(e.target.value);
                     setIsCompareMode(true);
                   } else {
                     setIsCompareMode(false);
                     setCompareSheetId(null);
                   }
                 }}
               >
                 <option value="">-- כבוי --</option>
                 {sheets.filter(s => s.id !== activeSheetId).map(s => (
                   <option key={s.id} value={s.id}>{s.name}</option>
                 ))}
               </select>
             </div>
          )}
        </div>

        {activeSheet && (
           <div className="flex items-center gap-2">
             <div className="text-xs text-slate-500 ml-4 hidden md:block">
               {activeSheet.data.length} שורות | {activeSheet.columns.length} עמודות
             </div>
             <button
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm font-medium transition-all shadow-sm whitespace-nowrap
                  ${isSidebarOpen 
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                    : 'bg-white border-slate-300 text-slate-700 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
             >
               <Sparkles size={16} />
               ניתוח AI
             </button>
           </div>
        )}
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
           {sheets.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                  <Upload size={40} className="text-slate-300" />
                </div>
                <h1 className="text-2xl font-bold text-slate-600 mb-2">אין קבצים פתוחים</h1>
                <p className="text-slate-500 mb-8">גרור קבצי CSV, JSON, Excel, Word או XML לכאן</p>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-slate-700 hover:bg-slate-50 hover:border-blue-400 transition-all"
                >
                  בחר קבצים מהמחשב
                </button>
             </div>
           ) : (
             activeSheet && (
               <DataGrid 
                 ref={dataGridRef}
                 sheet={activeSheet} 
                 zoomLevel={zoomLevel} 
                 compareSheet={comparisonSheet}
                 onCellEdit={handleCellEdit}
               />
             )
           )}
        </div>

        <AnalysisSidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
          activeSheet={activeSheet} 
        />
      </div>
    </div>
  );
};

export default App;