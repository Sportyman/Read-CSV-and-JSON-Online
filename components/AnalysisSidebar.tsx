import React, { useState } from 'react';
import { Sheet } from '../types';
import { analyzeData } from '../services/geminiService';
import { X, Sparkles, Send, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AnalysisSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeSheet: Sheet | undefined;
}

const AnalysisSidebar: React.FC<AnalysisSidebarProps> = ({ isOpen, onClose, activeSheet }) => {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!activeSheet || !prompt.trim()) return;

    const userMsg = prompt;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setPrompt('');
    setLoading(true);

    const result = await analyzeData(activeSheet.data, activeSheet.columns, userMsg);
    
    setMessages(prev => [...prev, { role: 'ai', content: result }]);
    setLoading(false);
  };

  const handleInitialAnalysis = async () => {
    if (!activeSheet) return;
    setLoading(true);
    const result = await analyzeData(activeSheet.data, activeSheet.columns);
    setMessages([{ role: 'ai', content: result }]);
    setLoading(false);
  };

  // Auto-trigger analysis if empty
  React.useEffect(() => {
    if (messages.length === 0 && activeSheet) {
        // Optional: Auto welcome message
    }
  }, [messages.length, activeSheet]);

  return (
    <div className="w-96 bg-white border-r border-slate-200 shadow-xl flex flex-col h-full absolute top-0 right-0 z-30 transition-transform duration-300 ease-in-out">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-l from-blue-50 to-white">
        <div className="flex items-center gap-2 text-blue-700">
          <Sparkles size={20} />
          <h2 className="font-bold text-lg">ניתוח נתונים (AI)</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-500">
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {!activeSheet ? (
          <p className="text-center text-slate-500 mt-10">בחר גליון נתונים כדי להתחיל.</p>
        ) : (
          <>
            {messages.length === 0 && (
              <div className="text-center mt-10">
                 <div className="bg-blue-100 p-4 rounded-full inline-block mb-4">
                    <Sparkles size={32} className="text-blue-600" />
                 </div>
                 <h3 className="text-lg font-medium text-slate-800 mb-2">Gemini Data Assistant</h3>
                 <p className="text-slate-500 text-sm mb-6">
                   אני יכול לנתח את הנתונים בטבלה "{activeSheet.name}", למצוא מגמות או לענות על שאלות.
                 </p>
                 <button 
                   onClick={handleInitialAnalysis}
                   className="px-4 py-2 bg-white border border-slate-300 shadow-sm text-slate-700 rounded-lg hover:bg-slate-50 hover:border-blue-400 transition-all text-sm font-medium"
                 >
                   בצע ניתוח מהיר
                 </button>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div 
                  className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none prose prose-sm'
                  }`}
                >
                  {msg.role === 'ai' ? (
                     <div className="markdown-body">
                         <ReactMarkdown>{msg.content}</ReactMarkdown>
                     </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            
            {loading && (
               <div className="flex justify-end">
                 <div className="bg-white border border-slate-200 rounded-2xl p-3 rounded-bl-none shadow-sm flex items-center gap-2 text-slate-500 text-sm">
                   <Loader2 size={16} className="animate-spin" />
                   <span>Gemini חושב...</span>
                 </div>
               </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      {activeSheet && (
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="שאל שאלה על הנתונים..."
              className="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none text-sm"
              disabled={loading}
            />
            <button 
              onClick={handleSend}
              disabled={loading || !prompt.trim()}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisSidebar;
