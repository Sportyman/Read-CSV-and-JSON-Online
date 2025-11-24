import React, { useRef, useState, useEffect, useMemo, useImperativeHandle, forwardRef, useCallback } from 'react';
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

const ROW_HEIGHT_BASE = 36; 

const DataGrid = forwardRef<DataGridHandle, DataGridProps>(({ sheet, zoomLevel, compareSheet, onCellEdit }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  
  // State
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [editingCell, setEditingCell] = useState<{ row: number, col: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  
  // Selection State: { row: index, colIdx: index of column in sheet.columns }
  const [selectedCell, setSelectedCell] = useState<{ row: number, colIdx: number } | null>(null);

  // Resizing State
  const resizingRef = useRef<{ col: string, startX: number, startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Reset on sheet change
  useEffect(() => {
    const initialWidths: Record<string, number> = {};
    sheet.columns.forEach(c => initialWidths[c] = 150);
    setColWidths(initialWidths);
    setEditingCell(null);
    setSelectedCell(null);
    setScrollTop(0);
  }, [sheet.id, sheet.columns]);

  // Resize observer
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto Size Logic
  const performAutoSize = useCallback((specificCol?: string) => {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return;
    
    ctx.font = '14px "Segoe UI", Tahoma, sans-serif'; 

    const newWidths: Record<string, number> = { ...colWidths };
    const columnsToResize = specificCol ? [specificCol] : sheet.columns;

    columnsToResize.forEach(col => {
      // Measure header (important!)
      let maxWidth = ctx.measureText(col).width + 40; // +40 for icon/padding

      // Measure data (sample up to 500 rows)
      const sampleLimit = Math.min(sheet.data.length, 500);
      for (let i = 0; i < sampleLimit; i++) {
        const val = sheet.data[i][col];
        const txt = val !== null && val !== undefined ? String(val) : '';
        const w = ctx.measureText(txt).width + 24; // +24 padding
        if (w > maxWidth) maxWidth = w;
      }

      newWidths[col] = Math.min(Math.max(maxWidth, 60), 800);
    });
    
    setColWidths(newWidths);
  }, [sheet, colWidths]);

  useImperativeHandle(ref, () => ({
    autoSizeColumns: () => performAutoSize()
  }));

  // Virtualization
  const rowHeight = ROW_HEIGHT_BASE * (zoomLevel / 100);
  const totalRows = sheet.data.length;
  const totalHeight = totalRows * rowHeight;
  const buffer = 10;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
  const endIndex = Math.min(totalRows, Math.ceil((scrollTop + containerHeight) / rowHeight) + buffer);
  
  const visibleRows = useMemo(() => {
    return sheet.data.slice(startIndex, endIndex).map((row, index) => ({
      data: row,
      absoluteIndex: startIndex + index
    }));
  }, [sheet.data, startIndex, endIndex]);

  const topSpacerHeight = startIndex * rowHeight;
  const bottomSpacerHeight = (totalRows - endIndex) * rowHeight;

  // --- Resizing Logic ---
  const startResizing = (e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      col,
      startX: e.clientX,
      startWidth: colWidths[col] || 150
    };
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const { col, startX, startWidth } = resizingRef.current;
      const diff = (e.clientX - startX) * (100 / zoomLevel); // Adjust for zoom
      const newWidth = Math.max(50, startWidth - diff); // RTL direction: dragging left increases width? No, dragging left decreases in LTR, but RTL...
      // In RTL, dragging Left (smaller X) should usually increase width if we drag the left border, 
      // BUT we are dragging the left border of the column (which is visually on the left in RTL).
      // Actually in standard HTML table RTL, the "resize handle" is usually on the left side of the cell.
      // Let's assume standard behavior: dragging 'left' (smaller X) makes it wider? 
      // Let's try standard logic first: Dragging towards the direction of expansion.
      // In RTL, columns go Right -> Left. 
      // Handle is on the Left edge of the header.
      // Dragging Left (decreasing X) -> Increases Width.
      
      const adjustedDiff = (startX - e.clientX) * (100 / zoomLevel); // RTL logic
      const finalWidth = Math.max(50, startWidth + adjustedDiff);
      
      setColWidths(prev => ({ ...prev, [col]: finalWidth }));
    };

    const handleMouseUp = () => {
      if (resizingRef.current) {
        resizingRef.current = null;
        setIsResizing(false);
        document.body.style.cursor = '';
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, zoomLevel]);

  // --- Keyboard Navigation ---
  const scrollToCell = (row: number) => {
    // Simple check if row is out of view
    const rowTop = row * rowHeight;
    const rowBottom = rowTop + rowHeight;
    
    if (containerRef.current) {
       const viewTop = containerRef.current.scrollTop;
       const viewBottom = viewTop + containerRef.current.clientHeight;
       
       if (rowTop < viewTop) {
         containerRef.current.scrollTop = rowTop;
       } else if (rowBottom > viewBottom) {
         containerRef.current.scrollTop = rowBottom - containerRef.current.clientHeight;
       }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingCell) {
      if (e.key === 'Enter') saveEdit();
      if (e.key === 'Escape') setEditingCell(null);
      return; // Let input handle other keys
    }

    if (!selectedCell) return;

    const { row, colIdx } = selectedCell;
    let newRow = row;
    let newColIdx = colIdx;
    let handled = true;

    switch (e.key) {
      case 'ArrowUp':
        newRow = Math.max(0, row - 1);
        break;
      case 'ArrowDown':
        newRow = Math.min(sheet.data.length - 1, row + 1);
        break;
      case 'ArrowRight': // RTL: Right moves Previous
        newColIdx = Math.max(0, colIdx - 1);
        break;
      case 'ArrowLeft': // RTL: Left moves Next
        newColIdx = Math.min(sheet.columns.length - 1, colIdx + 1);
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          newColIdx = Math.max(0, colIdx - 1);
          if (newColIdx === 0 && row > 0) {
             newRow = row - 1;
             newColIdx = sheet.columns.length - 1;
          }
        } else {
          newColIdx = Math.min(sheet.columns.length - 1, colIdx + 1);
          if (newColIdx === sheet.columns.length - 1 && row < sheet.data.length - 1) {
             // Wrap to next row could be annoying, let's stick to row end
          }
        }
        break;
      case 'Enter':
        e.preventDefault();
        startEditing(row, sheet.columns[colIdx], sheet.data[row][sheet.columns[colIdx]]);
        return;
      default:
        handled = false;
    }

    if (handled) {
      e.preventDefault();
      setSelectedCell({ row: newRow, colIdx: newColIdx });
      scrollToCell(newRow);
    }
  };

  // --- Editing & Selection ---
  const handleCellClick = (rowIdx: number, colIdx: number) => {
    setSelectedCell({ row: rowIdx, colIdx });
  };

  const startEditing = (rowIdx: number, col: string, val: any) => {
    setEditingCell({ row: rowIdx, col });
    setEditValue(val !== null && val !== undefined ? String(val) : '');
  };

  const saveEdit = () => {
    if (editingCell) {
      onCellEdit(editingCell.row, editingCell.col, editValue);
      setEditingCell(null);
      // Keep selection on the edited cell
      const colIdx = sheet.columns.indexOf(editingCell.col);
      if (colIdx !== -1) setSelectedCell({ row: editingCell.row, colIdx });
      // Focus back to container
      containerRef.current?.focus();
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
      className="flex-1 overflow-auto w-full h-full bg-white relative scroll-smooth outline-none"
      ref={containerRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => { /* Focus handling if needed */ }}
    >
      <div style={{ height: totalHeight + 40 }} className="relative">
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
                  className="border border-slate-300 p-2 font-semibold text-slate-700 overflow-hidden text-ellipsis whitespace-nowrap group hover:bg-slate-200 transition-colors relative select-none"
                  style={{ width: (colWidths[col] || 150) * (zoomLevel / 100) }} 
                  title={col}
                >
                  <div className="flex items-center justify-between gap-1 w-full overflow-hidden">
                    <span className="truncate">{col}</span>
                    <ArrowUpDown size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                  </div>
                  
                  {/* Resizer Handle (Left side for RTL) */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 z-10 opacity-0 group-hover:opacity-50"
                    onMouseDown={(e) => startResizing(e, col)}
                    onDoubleClick={() => performAutoSize(col)}
                    title="גרור לשינוי רוחב, לחיצה כפולה להתאמה"
                  />
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody>
            {topSpacerHeight > 0 && (
              <tr style={{ height: topSpacerHeight }}>
                <td colSpan={sheet.columns.length + 1} />
              </tr>
            )}

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
                  
                  // Compare Logic
                  let cellClass = 'border-l border-slate-300 px-2 py-0 truncate cursor-default ';
                  if (compareSheet) {
                      const compareRow = compareSheet.data[absoluteIndex];
                      if (!compareRow) cellClass += 'bg-green-50 text-green-700 ';
                      else if (String(val) !== String(compareRow[col] ?? '')) cellClass += 'bg-amber-50 text-amber-800 font-medium ';
                  }

                  // Selection Logic
                  const isSelected = selectedCell?.row === absoluteIndex && selectedCell?.colIdx === colIndex;
                  if (isSelected) cellClass += 'ring-2 ring-inset ring-blue-500 z-10 ';

                  const isEditing = editingCell?.row === absoluteIndex && editingCell?.col === col;
                  
                  return (
                    <td
                      key={`${absoluteIndex}-${colIndex}`}
                      className={cellClass + (isEditing ? 'p-0' : '')}
                      title={displayVal}
                      onClick={() => handleCellClick(absoluteIndex, colIndex)}
                      onDoubleClick={() => startEditing(absoluteIndex, col, val)}
                    >
                      {isEditing ? (
                        <input 
                          type="text" 
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') setEditingCell(null);
                              e.stopPropagation(); 
                          }}
                          className="w-full h-full bg-white px-1 outline-none text-blue-900"
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