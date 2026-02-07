import React, { useState, useRef, useEffect } from 'react';
import { generateLorebookEntry, generateCharacterList } from './services/geminiService';
import { Lorebook, LorebookEntry, AppStatus, ApiProvider, ApiConfig, GenerationMode, LorebookTemplate } from './types';
import { Spinner } from './components/Spinner';
import { Button } from './components/Button';
import { Modal } from './components/Modal';

// Helper for generating IDs safely in all environments
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Default Template for a new entry
const DEFAULT_ENTRY_TEMPLATE: LorebookEntry = {
  uid: 0,
  key: [],
  keysecondary: [],
  comment: "New Entry",
  content: "",
  constant: false,
  vectorized: false,
  selective: true,
  selectiveLogic: 0,
  addMemo: true,
  order: 100,
  position: 1,
  disable: false,
  ignoreBudget: false,
  excludeRecursion: false,
  preventRecursion: false,
  delayUntilRecursion: false,
  probability: 100,
  useProbability: true,
  depth: 4,
  group: "",
  groupOverride: false,
  groupWeight: 100,
  sticky: 0,
  cooldown: 0,
  delay: 0,
  displayIndex: 0
};

const App: React.FC = () => {
  // --- Data State ---
  const [lorebook, setLorebook] = useState<Lorebook>({ entries: {} });
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // --- UI/API State ---
  const [showApiConfig, setShowApiConfig] = useState<boolean>(false);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [generationPrompt, setGenerationPrompt] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- Template State ---
  const [customTemplates, setCustomTemplates] = useState<LorebookTemplate[]>(() => {
    try { 
      const saved = localStorage.getItem('lorebook_templates');
      return saved ? JSON.parse(saved) : []; 
    } catch { return []; }
  });
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => 
    localStorage.getItem('lorebook_selected_template_id') || 'brief'
  );
  
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");

  // --- Batch Generation State ---
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchWorld, setBatchWorld] = useState("");
  const [batchQuantity, setBatchQuantity] = useState(5);

  // --- API Configuration State (Persistent) ---
  const [apiProvider, setApiProvider] = useState<ApiProvider>(() => 
    (localStorage.getItem('lorebook_api_provider') as ApiProvider) || 'gemini'
  );
  const [customApiUrl, setCustomApiUrl] = useState<string>(() => 
    localStorage.getItem('lorebook_custom_url') || ''
  );
  const [customApiKey, setCustomApiKey] = useState<string>(() => 
    localStorage.getItem('lorebook_custom_key') || ''
  );
  const [customModels, setCustomModels] = useState<string[]>([]);
  const [selectedCustomModel, setSelectedCustomModel] = useState<string>(() => 
    localStorage.getItem('lorebook_custom_model') || ''
  );
  const [isApiConnected, setIsApiConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Persistence Effects ---
  
  // Save Templates
  useEffect(() => { 
    try {
      localStorage.setItem('lorebook_templates', JSON.stringify(customTemplates)); 
    } catch (e) { console.error("Failed to save templates", e); }
  }, [customTemplates]);

  // Save Selected Template ID
  useEffect(() => {
    localStorage.setItem('lorebook_selected_template_id', selectedTemplateId);
  }, [selectedTemplateId]);

  // Save API Provider
  useEffect(() => {
    localStorage.setItem('lorebook_api_provider', apiProvider);
  }, [apiProvider]);

  // Save Custom API Settings (Debounced)
  useEffect(() => {
     const timer = setTimeout(() => {
         localStorage.setItem('lorebook_custom_url', customApiUrl);
         localStorage.setItem('lorebook_custom_key', customApiKey);
         if(selectedCustomModel) localStorage.setItem('lorebook_custom_model', selectedCustomModel);
     }, 500);
     return () => clearTimeout(timer);
  }, [customApiUrl, customApiKey, selectedCustomModel]);

  // --- API Handlers ---
  const handleConnectApi = async () => {
    if (!customApiUrl) return setErrorMsg("Please enter an API URL.");
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      const url = customApiUrl.replace(/\/$/, '') + '/models';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (customApiKey) headers['Authorization'] = `Bearer ${customApiKey}`;

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed to connect to API');
      
      const data = await res.json();
      const modelsData = data.data || data.models || [];
      const modelIds: string[] = modelsData.map((m: any) => typeof m === 'string' ? m : (m.id || m.name));

      if (modelIds.length === 0) throw new Error('No models found');
      setCustomModels(modelIds);
      if (selectedCustomModel && modelIds.includes(selectedCustomModel)) {
        setSelectedCustomModel(selectedCustomModel);
      } else {
        setSelectedCustomModel(modelIds[0]);
      }
      setIsApiConnected(true);
    } catch (err: any) {
      setErrorMsg(`Connection failed: ${err.message}`);
      setIsApiConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const getApiConfig = (): ApiConfig => ({
    provider: apiProvider,
    baseUrl: customApiUrl,
    apiKey: customApiKey,
    model: selectedCustomModel
  });

  // --- File Handlers ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string) as Lorebook;
        if (json.entries) {
          setLorebook(json);
          // Select first entry if available
          const entries = Object.values(json.entries) as LorebookEntry[];
          const firstUid = entries[0]?.uid;
          if (firstUid !== undefined) setSelectedUid(firstUid);
        } else {
          setErrorMsg("Invalid Lorebook format: missing 'entries' object.");
        }
      } catch (err) {
        setErrorMsg("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleExport = () => {
    const jsonString = JSON.stringify(lorebook, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lorebook_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Entry Management ---
  const handleAddEntry = () => {
    const entriesVal = Object.values(lorebook.entries) as LorebookEntry[];
    const uids = entriesVal.map(e => e.uid);
    const newUid = uids.length > 0 ? Math.max(...uids) + 1 : 0;
    
    const newEntry: LorebookEntry = {
      ...DEFAULT_ENTRY_TEMPLATE,
      uid: newUid,
      displayIndex: newUid
    };

    setLorebook(prev => ({
      ...prev,
      entries: { ...prev.entries, [newUid]: newEntry }
    }));
    setSelectedUid(newUid);
  };

  const handleDeleteEntry = (uid: number) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    
    const newEntries = { ...lorebook.entries };
    delete newEntries[uid];
    
    setLorebook(prev => ({ ...prev, entries: newEntries }));
    if (selectedUid === uid) {
      setSelectedUid(null);
    }
  };

  const handleUpdateEntry = (uid: number, field: keyof LorebookEntry, value: any) => {
    setLorebook(prev => ({
      ...prev,
      entries: {
        ...prev.entries,
        [uid]: {
          ...prev.entries[uid],
          [field]: value
        }
      }
    }));
  };

  // --- Template Management ---
  const handleSaveTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateContent.trim()) {
      alert("Name and Content are required!");
      return;
    }
    const newTemplate: LorebookTemplate = {
      id: generateId(),
      name: newTemplateName.trim(),
      content: newTemplateContent
    };
    setCustomTemplates(prev => [...prev, newTemplate]);
    setSelectedTemplateId(newTemplate.id);
    setIsTemplateModalOpen(false);
    setNewTemplateName("");
    setNewTemplateContent("");
  };

  const handleDeleteTemplate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Delete this template?")) {
      setCustomTemplates(prev => prev.filter(t => t.id !== id));
      if (selectedTemplateId === id) setSelectedTemplateId('brief');
    }
  }

  // --- AI Generation ---
  const handleAiGenerate = async () => {
    if (!generationPrompt.trim()) return;
    if (apiProvider === 'custom' && !isApiConnected) return setErrorMsg("Connect to Custom API first");
    if (selectedUid === null) return;

    setStatus(AppStatus.GENERATING);
    try {
      const config = getApiConfig();
      
      let mode: GenerationMode = 'brief';
      let customTemplateContent: string | undefined = undefined;

      if (selectedTemplateId === 'detailed') {
        mode = 'detailed';
      } else if (selectedTemplateId === 'brief') {
        mode = 'brief';
      } else {
        const found = customTemplates.find(t => t.id === selectedTemplateId);
        if (found) {
          customTemplateContent = found.content;
        }
      }

      // We pass a callback to stream updates directly to the content field
      const result = await generateLorebookEntry(
          generationPrompt, 
          config, 
          mode, 
          customTemplateContent,
          (streamedText) => {
              // Real-time update
              setLorebook(prev => ({
                ...prev,
                entries: {
                    ...prev.entries,
                    [selectedUid]: {
                        ...prev.entries[selectedUid],
                        content: streamedText
                    }
                }
              }));
          }
      );
      
      if (result) {
        setLorebook(prev => {
           const entry = prev.entries[selectedUid];
           return {
             ...prev,
             entries: {
               ...prev.entries,
               [selectedUid]: {
                 ...entry,
                 // Only update metadata if it was successfully parsed, otherwise keep existing
                 comment: result.comment && result.comment !== "Generated Character" ? result.comment : entry.comment,
                 key: result.key && result.key.length > 0 ? result.key : entry.key,
                 // Final clean content
                 content: result.content || entry.content
               }
             }
           }
        });
        setGenerationPrompt("");
      } else {
        setErrorMsg("AI failed to generate content.");
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setStatus(AppStatus.IDLE);
    }
  };

  const handleBatchGenerate = async () => {
    if (!batchWorld.trim()) return alert("Vui lòng nhập tên Thế giới");
    if (apiProvider === 'custom' && !isApiConnected) return setErrorMsg("Connect to Custom API first");
    
    setIsBatchModalOpen(false);
    setStatus(AppStatus.GENERATING);
    setErrorMsg(null);

    try {
      const config = getApiConfig();
      
      // 1. Gather existing names/keys to avoid duplicates
      const existingEntries = Object.values(lorebook.entries) as LorebookEntry[];
      const existingNames = new Set<string>();
      existingEntries.forEach(e => {
        if (e.comment && e.comment !== "New Entry") existingNames.add(e.comment);
        if (e.key) e.key.forEach(k => existingNames.add(k));
      });

      // 2. Generate List of characters
      const characterList = await generateCharacterList(
          batchWorld, 
          batchQuantity, 
          config, 
          Array.from(existingNames) // Pass exclusion list
      );

      if (!characterList || characterList.length === 0) {
        throw new Error("Không tìm thấy nhân vật mới nào (có thể đã trùng hết hoặc AI không phản hồi).");
      }

      // 3. Prepare Template Mode
      let mode: GenerationMode = 'brief';
      let customTemplateContent: string | undefined = undefined;

      if (selectedTemplateId === 'detailed') mode = 'detailed';
      else if (selectedTemplateId === 'brief') mode = 'brief';
      else {
        const found = customTemplates.find(t => t.id === selectedTemplateId);
        if (found) customTemplateContent = found.content;
      }

      // 4. Process each character sequentially
      for (const charName of characterList) {
        // Create placeholder entry
        let newUid = 0;
        setLorebook(prev => {
          const entriesVal = Object.values(prev.entries) as LorebookEntry[];
          const uids = entriesVal.map(e => e.uid);
          newUid = uids.length > 0 ? Math.max(...uids) + 1 : 0;
          
          const newEntry: LorebookEntry = {
             ...DEFAULT_ENTRY_TEMPLATE,
             uid: newUid,
             displayIndex: newUid,
             comment: `Generating: ${charName}...`,
             content: "Chờ xử lý..."
          };
          return { ...prev, entries: { ...prev.entries, [newUid]: newEntry } };
        });

        // Generate content
        const prompt = `Character: ${charName} from the world of ${batchWorld}`;
        
        const result = await generateLorebookEntry(
            prompt, 
            config, 
            mode, 
            customTemplateContent,
            (streamedText) => {
                 setLorebook(prev => ({
                    ...prev,
                    entries: {
                        ...prev.entries,
                        [newUid]: {
                            ...prev.entries[newUid],
                            content: streamedText
                        }
                    }
                 }));
            }
        );

        // Update entry with final clean data
        if (result) {
           setLorebook(prev => {
             const entry = prev.entries[newUid];
             if(!entry) return prev;
             return {
               ...prev,
               entries: {
                 ...prev.entries,
                 [newUid]: {
                   ...entry,
                   comment: result.comment || charName,
                   key: result.key || [charName],
                   content: result.content || "Failed to content"
                 }
               }
             }
           });
        }
      }

    } catch (e: any) {
      setErrorMsg(`Batch Error: ${e.message}`);
    } finally {
      setStatus(AppStatus.IDLE);
    }
  };

  // --- Render Helpers ---
  const entriesList = (Object.values(lorebook.entries) as LorebookEntry[])
    .sort((a, b) => (a.displayIndex || 0) - (b.displayIndex || 0))
    .filter(e => e.comment.toLowerCase().includes(searchQuery.toLowerCase()) || e.content.toLowerCase().includes(searchQuery.toLowerCase()));

  const activeEntry = selectedUid !== null ? lorebook.entries[selectedUid] : null;

  return (
    <div className="h-screen flex flex-col bg-gray-100 text-gray-800 font-sans overflow-hidden">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">L</div>
          <h1 className="text-xl font-bold text-gray-800">Lorebook Maker</h1>
        </div>
        
        <div className="flex items-center gap-3">
           <Button variant="secondary" className="!py-2 !px-4 text-sm" onClick={() => fileInputRef.current?.click()}>
             Import JSON
           </Button>
           <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
           
           <Button variant="primary" className="!py-2 !px-4 text-sm" onClick={handleExport}>
             Export JSON
           </Button>

           <button 
            onClick={() => setShowApiConfig(!showApiConfig)}
            className={`p-2 rounded-full transition-colors ${showApiConfig ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}
            title="API Settings"
           >
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
           </button>
        </div>
      </header>

      {/* API Config Modal/Panel */}
      {showApiConfig && (
        <div className="bg-gray-50 border-b border-gray-200 p-6 animate-fade-in shadow-inner">
             <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">API Configuration</h3>
              </div>
              <div className="flex gap-4 mb-4">
                <button 
                  onClick={() => setApiProvider('gemini')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${apiProvider === 'gemini' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'}`}
                >
                  Google Gemini
                </button>
                <button 
                  onClick={() => setApiProvider('custom')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${apiProvider === 'custom' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'}`}
                >
                  Custom API
                </button>
              </div>

              {apiProvider === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end mb-4">
                   <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">API URL</label>
                      <input type="text" value={customApiUrl} onChange={(e) => setCustomApiUrl(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white" placeholder="https://api.openai.com/v1" />
                   </div>
                   <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">API Key</label>
                      <input type="password" value={customApiKey} onChange={(e) => setCustomApiKey(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white" placeholder="sk-..." />
                   </div>
                   <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Model</label>
                      <select value={selectedCustomModel} onChange={(e) => setSelectedCustomModel(e.target.value)} disabled={!isApiConnected} className="w-full p-2 border border-gray-300 rounded text-gray-900 bg-white">
                        {customModels.map(m => <option key={m} value={m}>{m}</option>)}
                        {!isApiConnected && <option>Connect first...</option>}
                      </select>
                   </div>
                   <Button onClick={handleConnectApi} disabled={isConnecting} className="h-[42px]">
                      {isConnecting ? <Spinner /> : isApiConnected ? "Connected" : "Connect"}
                   </Button>
                </div>
              )}
              
              <div className="flex justify-end pt-2 border-t border-gray-200">
                  <span className="text-gray-500 text-sm italic flex items-center">
                    <svg className="w-4 h-4 mr-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Settings saved automatically
                  </span>
              </div>
             </div>
        </div>
      )}

      {/* Main Content: Split View */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar: Entry List */}
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <input 
              type="text" 
              placeholder="Search entries..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2 bg-gray-100 border-none rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800"
            />
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {entriesList.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No entries found.</div>
            ) : (
              <ul>
                {entriesList.map(entry => (
                  <li key={entry.uid}>
                    <button
                      onClick={() => setSelectedUid(entry.uid)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex justify-between items-center group ${selectedUid === entry.uid ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'}`}
                    >
                      <div>
                        <div className={`font-medium ${selectedUid === entry.uid ? 'text-blue-800' : 'text-gray-700'}`}>
                          {entry.comment || `Entry #${entry.uid}`}
                        </div>
                        <div className="text-xs text-gray-400 truncate max-w-[180px]">
                          {entry.key.join(', ')}
                        </div>
                      </div>
                      <span 
                        onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry.uid); }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 space-y-2">
            <Button onClick={handleAddEntry} className="w-full !py-2" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>}>
              New Entry
            </Button>
            <Button 
                onClick={() => setIsBatchModalOpen(true)} 
                variant="secondary" 
                className="w-full !py-2 bg-purple-600 hover:bg-purple-700 text-white" 
                icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
            >
              Batch Generate
            </Button>
          </div>
        </aside>

        {/* Editor Area */}
        <main className="flex-1 bg-gray-50 flex flex-col h-full overflow-hidden">
          {activeEntry ? (
            <div className="flex-1 overflow-y-auto p-6 lg:p-10">
              <div className="max-w-4xl mx-auto space-y-6">
                
                {/* Error Banner */}
                {errorMsg && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded shadow-sm relative">
                    <span className="block sm:inline">{errorMsg}</span>
                    <button className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setErrorMsg(null)}>
                      <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                    </button>
                  </div>
                )}

                {/* AI Generator Box */}
                <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden">
                  <div className="bg-blue-50/50 px-4 py-3 border-b border-blue-100 flex items-center justify-between text-blue-800 text-sm font-semibold">
                    <div className="flex items-center gap-2">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                       AI Generator
                    </div>
                    {/* Template Selector */}
                    <div className="flex items-center gap-2">
                        <select 
                          value={selectedTemplateId} 
                          onChange={(e) => setSelectedTemplateId(e.target.value)}
                          className="px-2 py-1 text-xs rounded border border-blue-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[200px]"
                        >
                          <option value="brief">Đơn giản (Mặc định)</option>
                          <option value="detailed">Chi tiết (Mặc định)</option>
                          {customTemplates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <button 
                            onClick={() => setIsTemplateModalOpen(true)}
                            className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1"
                            title="Thêm mẫu hồ sơ"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Mẫu
                        </button>
                        {selectedTemplateId !== 'brief' && selectedTemplateId !== 'detailed' && (
                           <button 
                             onClick={(e) => handleDeleteTemplate(e, selectedTemplateId)}
                             className="text-red-400 hover:text-red-600"
                             title="Xóa mẫu này"
                           >
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                           </button>
                        )}
                    </div>
                  </div>
                  <div className="p-4 flex gap-3 items-start">
                    <textarea 
                      value={generationPrompt}
                      onChange={(e) => setGenerationPrompt(e.target.value)}
                      placeholder="Describe a character or idea (e.g., 'A cyberpunk hacker who hates technology')..."
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none h-20 text-gray-900 bg-white"
                    />
                    <Button 
                      onClick={handleAiGenerate}
                      disabled={status === AppStatus.GENERATING || !generationPrompt}
                      className="h-20 w-24 flex-col gap-1 !text-xs !px-2"
                    >
                      {status === AppStatus.GENERATING ? <Spinner /> : <><span className="text-xl">✨</span>Tạo</>}
                    </Button>
                  </div>
                </div>

                {/* Main Fields */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
                  
                  {/* Name / Comment */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Entry Name / Comment</label>
                    <input 
                      type="text" 
                      value={activeEntry.comment}
                      onChange={(e) => handleUpdateEntry(activeEntry.uid, 'comment', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-medium text-gray-900 bg-white"
                      placeholder="Character Name or Title"
                    />
                  </div>

                  {/* Keywords */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Activation Keys (comma separated)</label>
                    <input 
                      type="text" 
                      value={activeEntry.key.join(', ')}
                      onChange={(e) => handleUpdateEntry(activeEntry.uid, 'key', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm text-gray-900 bg-white"
                      placeholder="keyword1, keyword2"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Content</label>
                    <textarea 
                      value={activeEntry.content}
                      onChange={(e) => handleUpdateEntry(activeEntry.uid, 'content', e.target.value)}
                      className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-sans text-gray-900 bg-white leading-relaxed min-h-[300px] resize-y"
                      placeholder="Write your lore content here..."
                    />
                  </div>

                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
               <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
               <p className="text-lg font-medium">Select an entry or create a new one</p>
            </div>
          )}
        </main>
      </div>

      {/* Add Template Modal */}
      <Modal 
        isOpen={isTemplateModalOpen} 
        onClose={() => setIsTemplateModalOpen(false)} 
        title="Thêm mẫu hồ sơ mới"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên mẫu</label>
            <input 
              type="text" 
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ví dụ: Hồ sơ Dark Fantasy..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mẫu định dạng đầu ra (Output Format)
              <span className="block text-xs text-gray-500 font-normal mt-0.5">
                 Hệ thống sẽ giữ nguyên logic phân tích nhân vật mặc định. Bạn chỉ cần nhập cấu trúc YAML/XML mà bạn muốn AI xuất ra.
              </span>
            </label>
            <textarea 
              value={newTemplateContent}
              onChange={(e) => setNewTemplateContent(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none h-64 text-sm font-mono"
              placeholder={`Vui lòng xuất theo định dạng sau:

<{Tên_NPC}_Custom>
Name:
Role:
...
</{Tên_NPC}_Custom>`}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsTemplateModalOpen(false)}>Hủy</Button>
            <Button onClick={handleSaveTemplate}>Lưu mẫu</Button>
          </div>
        </div>
      </Modal>

      {/* Batch Generator Modal */}
      <Modal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title="Tạo nhân vật hàng loạt"
      >
        <div className="space-y-6">
           <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên Thế giới (Anime/Manga/Game...)</label>
              <input 
                type="text"
                value={batchWorld}
                onChange={(e) => setBatchWorld(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="Ví dụ: Naruto, Genshin Impact, Cyberpunk 2077..."
              />
           </div>

           <div>
              <div className="flex justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Số lượng nhân vật</label>
                <span className="text-sm font-bold text-purple-600">{batchQuantity}</span>
              </div>
              <input 
                type="range"
                min="1"
                max="10"
                value={batchQuantity}
                onChange={(e) => setBatchQuantity(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                 <span>1</span>
                 <span>5</span>
                 <span>10</span>
              </div>
           </div>

           <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mẫu hồ sơ sử dụng</label>
              <select 
                  value={selectedTemplateId} 
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                >
                  <option value="brief">Đơn giản (Mặc định)</option>
                  <option value="detailed">Chi tiết (Mặc định)</option>
                  {customTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
              </select>
           </div>

           <div className="bg-purple-50 p-4 rounded-lg text-sm text-purple-800 border border-purple-100">
              <h4 className="font-semibold mb-1">Quy trình xử lý:</h4>
              <ol className="list-decimal list-inside space-y-1">
                 <li>AI sẽ tạo danh sách {batchQuantity} nhân vật từ thế giới "{batchWorld || '...'}"</li>
                 <li>Hệ thống tự động tạo {batchQuantity} entry trống.</li>
                 <li>AI sẽ lần lượt viết hồ sơ chi tiết cho từng nhân vật.</li>
              </ol>
           </div>

           <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsBatchModalOpen(false)}>Hủy</Button>
            <Button 
                onClick={handleBatchGenerate}
                className="bg-purple-600 hover:bg-purple-700 text-white"
            >
                Bắt đầu tạo ({batchQuantity})
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default App;