import React, { useState, useRef, useCallback } from 'react';
import { Sheet } from './types';
import { generateId, parseCSV, parseJSON, exportToCSV, downloadFile } from './utils/fileParser';
import DataGrid, { DataGridHandle } from './components/DataGrid';
import AnalysisSidebar from './components/AnalysisSidebar';
import { 
  Plus, 
  Upload, 
  FileSpreadsheet, 
  FileJson, 
  X, 
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  GitCompare,
  ArrowRightLeft,
  Maximize,
  Save,
  Download
} from 'lucide-react';

const App: React.FC = () => {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [compareSheetId, setCompareSheetId] = useState<string | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataGridRef = useRef<DataGridHandle>(null);

  const activeSheet = sheets.find(s => s.id === activeSheetId);
  // Get the comparison sheet object if mode is active
  const comparisonSheet = isCompareMode && compareSheetId 
    ? sheets.find(s => s.id === compareSheetId) 
    : null;

  const handleFileUpload = async (file: File) => {
    const text = await file.text();
    let newSheet: Sheet | null = null;
    const name = file.name;
    const id = generateId();

    if (file.type === 'text/csv' || name.endsWith('.csv')) {
      const { data, columns } = parseCSV(text);
      newSheet = { id, name, data, columns, type: 'csv' };
    } else if (file.type === 'application/json' || name.endsWith('.json')) {
      const { data, columns } = parseJSON(text);
      newSheet = { id, name, data, columns, type: 'json' };
    }

    if (newSheet) {
      setSheets(prev => [...prev, newSheet!]);
      setActiveSheetId(id);
    } else {
      alert("Format not supported. Please use CSV or JSON.");
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => handleFileUpload(file as File));
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((file) => handleFileUpload(file as File));
    }
    // Reset value to allow re-uploading same file if deleted
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
    // Reset compare if closed
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
        // Create a copy of the data array
        const newData = [...sheet.data];
        // Create a copy of the specific row
        newData[rowIndex] = { ...newData[rowIndex], [colKey]: value };
        
        return { ...sheet, data: newData };
      }
      return sheet;
    }));
  };

  const handleSave = () => {
    if (!activeSheet) return;

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

  return (
    <div 
      className="flex flex-col h-screen w-full relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/20 z-50 flex items-center justify-center backdrop-blur-sm border-4 border-blue-500 border-dashed m-4 rounded-xl">
          <div className="text-blue-600 font-bold text-2xl flex flex-col items-center">
            <Upload size={48} className="mb-4" />
            <span>שחרר קבצים כאן לפתיחה</span>
          </div>
        </div>
      )}

      {/* Top Bar / Navigation */}
      <div className="h-12 bg-slate-800 flex items-end px-2 space-x-1 space-x-reverse overflow-x-auto select-none shadow-md z-20 shrink-0">
        
        {/* Logo / Brand */}
        <div className="flex items-center text-white px-4 h-full font-bold tracking-wider text-lg">
          <FileSpreadsheet className="ml-2 text-green-400" />
          DataView
        </div>

        {/* Tabs */}
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
            {sheet.type === 'json' ? <FileJson size={14} className="ml-2 opacity-70" /> : <FileSpreadsheet size={14} className="ml-2 opacity-70" />}
            <span className="truncate flex-1">{sheet.name}</span>
            <button 
              onClick={(e) => closeTab(e, sheet.id)}
              className={`mr-2 p-0.5 rounded-full hover:bg-red-100 hover:text-red-500 transition-opacity ${activeSheetId === sheet.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {/* Add Button */}
        <button 
          onClick={createEmptySheet}
          className="h-8 w-8 mb-0.5 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          title="הוסף גליון חדש"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0 overflow-x-auto">
        <div className="flex items-center gap-3">
          {/* File Actions */}
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3 ml-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleInputChange}
              className="hidden"
              multiple
              accept=".csv, .json"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm active:transform active:scale-95 whitespace-nowrap"
            >
              <Upload size={16} />
              פתח קובץ
            </button>
            
            {activeSheet && (
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-200 transition-colors shadow-sm whitespace-nowrap"
                title="שמור והורד קובץ"
              >
                <Download size={16} />
                שמור
              </button>
            )}
          </div>

          {/* Zoom Controls */}
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
          
          {/* Compare Controls */}
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
               
               {isCompareMode && (
                 <div className="flex gap-2 text-xs mr-2">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> חדש</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> שונה</span>
                 </div>
               )}
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
                <p className="text-slate-500 mb-8">גרור קבצי CSV או JSON לכאן או לחץ על כפתור הפתיחה</p>
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

        {/* AI Sidebar */}
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