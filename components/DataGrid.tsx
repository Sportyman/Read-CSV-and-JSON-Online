import React, { useRef, useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import { Sheet } from '../types';
import { ArrowUpDown, AlertCircle } from 'lucide-react';

interface DataGridProps {
  sheet: Sheet;
  zoomLevel: number;
  compareSheet?: Sheet | null;
  onCellEdit: (rowIndex: number, colKey: string, value: string) => void;
}

export interface DataGridHandle {
  autoSizeColumns: () => void;
}

// Estimated row height for virtualization calculation
const ROW_HEIGHT_BASE = 36; 

const DataGrid = forwardRef<DataGridHandle, DataGridProps>(({ sheet, zoomLevel, compareSheet, onCellEdit }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  
  // Editing State
  const [editingCell, setEditingCell] = useState<{ row: number, col: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Store base widths (at 100% zoom)
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  // Reset widths when sheet changes
  useEffect(() => {
    const initialWidths: Record<string, number> = {};
    sheet.columns.forEach(c => initialWidths[c] = 150); // Default width
    setColWidths(initialWidths);
    setEditingCell(null); // Clear edit state on sheet change
  }, [sheet.id, sheet.columns]);

  // Handle Resize for virtualization
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    
    // Initial measure
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Expose autoSize function to parent
  useImperativeHandle(ref, () => ({
    autoSizeColumns: () => {
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return;
      
      // Approximate font style for measurement
      ctx.font = '14px "Segoe UI", Tahoma, sans-serif'; 

      const newWidths: Record<string, number> = {};

      sheet.columns.forEach(col => {
        // Measure header
        let maxWidth = ctx.measureText(col).width + 40; // +40 for sorting icon and padding

        // Measure data (sample first 200 rows for performance)
        const sampleLimit = Math.min(sheet.data.length, 200);
        for (let i = 0; i < sampleLimit; i++) {
          const val = sheet.data[i][col];
          const txt = val !== null && val !== undefined ? String(val) : '';
          const w = ctx.measureText(txt).width + 24; // +24 for padding
          if (w > maxWidth) maxWidth = w;
        }

        // Constraints
        newWidths[col] = Math.min(Math.max(maxWidth, 60), 600);
      });
      
      setColWidths(newWidths);
    }
  }));

  // Update scroll position for virtualization
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Virtualization Logic
  const rowHeight = ROW_HEIGHT_BASE * (zoomLevel / 100);
  const totalRows = sheet.data.length;
  const totalHeight = totalRows * rowHeight;
  
  // Calculate visible range with buffer
  const buffer = 10;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
  const endIndex = Math.min(totalRows, Math.ceil((scrollTop + containerHeight) / rowHeight) + buffer);
  
  const visibleRows = useMemo(() => {
    return sheet.data.slice(startIndex, endIndex).map((row, index) => ({
      data: row,
      absoluteIndex: startIndex + index
    }));
  }, [sheet.data, startIndex, endIndex]);

  // Spacer heights to simulate full scroll
  const topSpacerHeight = startIndex * rowHeight;
  const bottomSpacerHeight = (totalRows - endIndex) * rowHeight;

  // Comparison Logic Helpers
  const getCellClass = (rowIdx: number, colName: string, val: any) => {
    if (!compareSheet) return '';
    
    const compareRow = compareSheet.data[rowIdx];
    
    // Case 1: Row doesn't exist in comparison sheet (New Row)
    if (!compareRow) {
      return 'bg-green-50 text-green-700';
    }

    // Case 2: Value differs
    const compareVal = compareRow[colName];
    // Loose equality check for string/number differences
    if (String(val) !== String(compareVal ?? '')) {
      return 'bg-amber-50 text-amber-800 font-medium';
    }

    return '';
  };

  const getScaledColWidth = (col: string) => {
    const base = colWidths[col] || 150;
    return base * (zoomLevel / 100);
  };

  // Editing Handlers
  const startEditing = (rowIdx: number, col: string, val: any) => {
    setEditingCell({ row: rowIdx, col });
    setEditValue(val !== null && val !== undefined ? String(val) : '');
  };

  const saveEdit = () => {
    if (editingCell) {
      onCellEdit(editingCell.row, editingCell.col, editValue);
      setEditingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  if (sheet.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <AlertCircle size={48} className="mb-4 opacity-50" />
        <p className="text-lg">הקובץ ריק או שלא ניתן היה לפענח אותו.</p>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 overflow-auto w-full h-full bg-white relative scroll-smooth"
      ref={containerRef}
      onScroll={onScroll}
    >
      <div style={{ height: totalHeight + 40 }} className="relative"> {/* +40 for header */}
        <table 
          className="w-full text-right border-collapse table-fixed"
          style={{ fontSize: `${zoomLevel}%` }}
        >
          <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm h-10">
            <tr style={{ height: 40 }}> 
              <th 
                 className="border border-slate-300 bg-slate-100 p-2 text-center text-slate-500 select-none font-normal"
                 style={{ width: 60 * (zoomLevel / 100) }}
              >
                #
              </th>
              {sheet.columns.map((col, idx) => (
                <th
                  key={idx}
                  className="border border-slate-300 p-2 font-semibold text-slate-700 overflow-hidden text-ellipsis whitespace-nowrap group hover:bg-slate-200 transition-colors cursor-pointer relative"
                  style={{ width: getScaledColWidth(col) }} 
                  title={col}
                >
                  <div className="flex items-center justify-between gap-1 w-full overflow-hidden">
                    <span className="truncate">{col}</span>
                    <ArrowUpDown size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody>
            {/* Top Spacer */}
            {topSpacerHeight > 0 && (
              <tr style={{ height: topSpacerHeight }}>
                <td colSpan={sheet.columns.length + 1} />
              </tr>
            )}

            {/* Rendered Rows */}
            {visibleRows.map(({ data: row, absoluteIndex }) => (
              <tr 
                key={absoluteIndex} 
                className="hover:bg-blue-50 transition-colors border-b border-slate-200"
                style={{ height: rowHeight }}
              >
                <td className="border-l border-slate-300 bg-slate-50 p-2 text-center text-slate-500 font-mono select-none text-xs">
                  {absoluteIndex + 1}
                </td>
                {sheet.columns.map((col, colIndex) => {
                  const val = row[col];
                  const displayVal = val !== undefined && val !== null ? String(val) : '';
                  const diffClass = getCellClass(absoluteIndex, col, val);
                  const isEditing = editingCell?.row === absoluteIndex && editingCell?.col === col;
                  
                  return (
                    <td
                      key={`${absoluteIndex}-${colIndex}`}
                      className={`border-l border-slate-300 px-2 py-0 truncate cursor-default ${diffClass} ${isEditing ? 'p-0' : ''}`}
                      title={displayVal}
                      onDoubleClick={() => startEditing(absoluteIndex, col, val)}
                    >
                      {isEditing ? (
                        <input 
                          type="text" 
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyDown}
                          className="w-full h-full bg-blue-100 px-1 outline-none text-blue-900 border-2 border-blue-400"
                          style={{ height: '100%' }}
                        />
                      ) : (
                        displayVal
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Bottom Spacer */}
            {bottomSpacerHeight > 0 && (
              <tr style={{ height: bottomSpacerHeight }}>
                <td colSpan={sheet.columns.length + 1} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

DataGrid.displayName = 'DataGrid';

export default DataGrid;