
import React, { useState, useRef, useEffect } from 'react';
import { VOICES, TEMPLATES } from './constants';
import { GenerationStatus, VoiceOption, HistoryItem, StoreProfile } from './types';
import { refineTextForRetail, generateRetailAudio, generateRetailCopy } from './services/geminiService';
import { decode, pcmToWav } from './utils/audioUtils';

const App: React.FC = () => {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICES[0]);
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const [activeTab, setActiveTab] = useState<'studio' | 'copywriter'>('studio');
  const [studioTool, setStudioTool] = useState<'voice' | 'config' | 'templates'>('voice');
  
  const [briefing, setBriefing] = useState('');
  const [copyStyle, setCopyStyle] = useState('vendedor');
  const [generatedCopy, setGeneratedCopy] = useState('');
  const [isCopying, setIsCopying] = useState(false);
  
  const [profiles, setProfiles] = useState<StoreProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileSector, setNewProfileSector] = useState('');
  
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [style, setStyle] = useState('vendedor');
  const [favorites, setFavorites] = useState<string[]>([]);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioContextRef = useRef<AudioContext | null>(null);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const savedProfiles = localStorage.getItem('vv_store_profiles');
    if (savedProfiles) {
      try {
        const parsed = JSON.parse(savedProfiles) as StoreProfile[];
        setProfiles(parsed);
        const lastUsed = parsed.sort((a, b) => b.lastUsed - a.lastUsed)[0];
        if (lastUsed) setSelectedProfileId(lastUsed.id);
      } catch (e) {}
    }
    const savedFavs = localStorage.getItem('vv_favorites');
    if (savedFavs) {
      try { setFavorites(JSON.parse(savedFavs)); } catch (e) {}
    }
    const savedHistory = localStorage.getItem('vv_history_meta');
    if (savedHistory) {
      try { 
        const meta = JSON.parse(savedHistory);
        setHistory(meta.map((item: any) => ({ ...item, audioBlobUrl: '' })));
      } catch (e) {}
    }
  }, []);

  const saveProfiles = (newProfiles: StoreProfile[]) => {
    setProfiles(newProfiles);
    localStorage.setItem('vv_store_profiles', JSON.stringify(newProfiles));
  };

  const handleAddProfile = () => {
    if (!newProfileName.trim() || !newProfileSector.trim()) return;
    const newProfile: StoreProfile = {
      id: Date.now().toString(),
      name: newProfileName,
      sector: newProfileSector,
      lastUsed: Date.now()
    };
    saveProfiles([newProfile, ...profiles]);
    setSelectedProfileId(newProfile.id);
    setNewProfileName(''); setNewProfileSector(''); setIsAddingProfile(false);
  };

  const selectProfile = (id: string) => {
    setSelectedProfileId(id);
    saveProfiles(profiles.map(p => p.id === id ? { ...p, lastUsed: Date.now() } : p));
  };

  const currentProfile = profiles.find(p => p.id === selectedProfileId);

  const toggleFavorite = (e: React.MouseEvent, voiceId: string) => {
    e.stopPropagation();
    const newFavs = favorites.includes(voiceId) ? favorites.filter(id => id !== voiceId) : [...favorites, voiceId];
    setFavorites(newFavs);
    localStorage.setItem('vv_favorites', JSON.stringify(newFavs));
  };

  const handleApplyTemplate = (templateText: string) => {
    setText(templateText);
    setAudioBlobUrl(null);
  };

  const clearAudio = () => {
    setAudioBlobUrl(null); setIsPlaying(false); setCurrentTime(0); setDuration(0);
  };

  const handleRefineText = async () => {
    if (!text.trim()) return;
    setStatus(GenerationStatus.REFINING);
    try {
      const refined = await refineTextForRetail(text);
      setText(refined);
      setStatus(GenerationStatus.IDLE);
    } catch (error) { setStatus(GenerationStatus.ERROR); }
  };

  const handleCreateCopy = async () => {
    if (!briefing.trim()) return;
    setIsCopying(true);
    try {
      const result = await generateRetailCopy(briefing, currentProfile?.name, currentProfile?.sector, copyStyle);
      setGeneratedCopy(result);
    } catch (error) { setErrorMessage('Erro ao gerar roteiro.'); } finally { setIsCopying(false); }
  };

  const handleGenerateAudio = async () => {
    if (!text.trim()) return;
    setStatus(GenerationStatus.GENERATING_AUDIO);
    try {
      const base64Audio = await generateRetailAudio(text, selectedVoice.id, speed, pitch, style);
      const pcmData = decode(base64Audio);
      const url = URL.createObjectURL(pcmToWav(pcmData, 24000));
      setAudioBlobUrl(url);
      setStatus(GenerationStatus.SUCCESS);
      const newItem: HistoryItem = { id: Date.now().toString(), text, voiceId: selectedVoice.id, voiceName: selectedVoice.name, speed, pitch, date: Date.now(), audioBlobUrl: url };
      const newHistory = [newItem, ...history].slice(0, 15);
      setHistory(newHistory);
      localStorage.setItem('vv_history_meta', JSON.stringify(newHistory.map(({ audioBlobUrl, ...meta }) => meta)));
      setTimeout(() => audioRef.current?.play(), 100);
    } catch (error) { setStatus(GenerationStatus.ERROR); }
  };

  const handlePreviewVoice = async (e: React.MouseEvent, voice: VoiceOption) => {
    e.stopPropagation(); if (previewingVoiceId) return;
    setPreviewingVoiceId(voice.id);
    try {
      const base64Audio = await generateRetailAudio(`Olá! Eu sou a voz do ${voice.name}.`, voice.id, 1.0, 0, 'amigavel');
      if (!previewAudioContextRef.current) previewAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const ctx = previewAudioContextRef.current;
      const { decodeAudioData: decodeData } = await import('./utils/audioUtils');
      const audioBuffer = await decodeData(decode(base64Audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer; source.connect(ctx.destination); source.start();
    } catch (e) {} finally { setPreviewingVoiceId(null); }
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Header Compacto */}
      <header className="bg-red-600 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-2">
          <i className="fas fa-bullhorn text-lg"></i>
          <h1 className="text-sm font-black uppercase tracking-tighter">VarejoVoice AI</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowHistory(true)} className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center"><i className="fas fa-history text-xs"></i></button>
        </div>
      </header>

      {/* Navegação Principal */}
      <div className="bg-white border-b border-slate-200 p-1 flex shrink-0">
        <button onClick={() => setActiveTab('studio')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${activeTab === 'studio' ? 'bg-red-50 text-red-600' : 'text-slate-400'}`}>Estúdio</button>
        <button onClick={() => setActiveTab('copywriter')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${activeTab === 'copywriter' ? 'bg-red-50 text-red-600' : 'text-slate-400'}`}>Copywriter</button>
      </div>

      <main className="flex-1 overflow-hidden flex flex-col p-3 space-y-3">
        {activeTab === 'studio' ? (
          <>
            {/* Editor Fixo */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col shrink-0">
              <div className="px-3 py-2 border-b border-slate-50 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Roteiro SSML</span>
                <button onClick={handleRefineText} disabled={!text || status === GenerationStatus.REFINING} className="text-[9px] font-black text-red-600 uppercase flex items-center gap-1">
                  <i className="fas fa-magic"></i> {status === GenerationStatus.REFINING ? '...' : 'Otimizar 35s'}
                </button>
              </div>
              <textarea value={text} onChange={(e) => { setText(e.target.value); clearAudio(); }} className="w-full h-24 p-3 text-xs font-mono focus:outline-none resize-none" placeholder="Digite ou gere um roteiro..."/>
            </div>

            {/* Abas de Ferramentas (Resolve o Scroll) */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
              <div className="flex border-b border-slate-100 shrink-0">
                <button onClick={() => setStudioTool('voice')} className={`flex-1 py-3 text-[9px] font-bold uppercase border-b-2 transition-all ${studioTool === 'voice' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-400'}`}>Vozes</button>
                <button onClick={() => setStudioTool('config')} className={`flex-1 py-3 text-[9px] font-bold uppercase border-b-2 transition-all ${studioTool === 'config' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-400'}`}>Ajustes</button>
                <button onClick={() => setStudioTool('templates')} className={`flex-1 py-3 text-[9px] font-bold uppercase border-b-2 transition-all ${studioTool === 'templates' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-400'}`}>Modelos</button>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {studioTool === 'voice' && (
                  <div className="space-y-2">
                    {VOICES.sort((a,b) => (favorites.includes(b.id)?1:0) - (favorites.includes(a.id)?1:0)).map(v => (
                      <div key={v.id} onClick={() => { setSelectedVoice(v); clearAudio(); }} className={`flex items-center gap-3 p-2 rounded-xl border-2 transition-all ${selectedVoice.id === v.id ? 'border-red-500 bg-red-50' : 'border-slate-50 bg-slate-50'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${v.gender === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}><i className={`fas ${v.gender === 'male' ? 'fa-user' : 'fa-user-female'}`}></i></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold truncate">{v.name}</p>
                          <p className="text-[9px] text-slate-400 truncate italic">{v.description}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={(e) => toggleFavorite(e, v.id)} className={`text-[10px] ${favorites.includes(v.id) ? 'text-red-500' : 'text-slate-300'}`}><i className="fas fa-heart"></i></button>
                          <button onClick={(e) => handlePreviewVoice(e, v)} className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-[10px] text-slate-400"><i className="fas fa-play"></i></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {studioTool === 'config' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-2">
                      {['vendedor', 'urgencia', 'amigavel', 'institucional'].map(s => (
                        <button key={s} onClick={() => setStyle(s)} className={`py-2 px-1 rounded-lg border-2 text-[9px] font-bold uppercase transition-all ${style === s ? 'border-red-500 bg-red-50 text-red-600' : 'border-slate-100 text-slate-400'}`}>{s}</button>
                      ))}
                    </div>
                    <div className="space-y-4 px-1">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase"><span>Velocidade</span> <span className="text-red-600">{speed}x</span></div>
                        <input type="range" min="0.5" max="1.5" step="0.1" value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} className="w-full h-1 bg-slate-100 rounded-lg appearance-none accent-red-600"/>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase"><span>Tom (Pitch)</span> <span className="text-red-600">{pitch}</span></div>
                        <input type="range" min="-5" max="5" step="1" value={pitch} onChange={e => setPitch(parseInt(e.target.value))} className="w-full h-1 bg-slate-100 rounded-lg appearance-none accent-red-600"/>
                      </div>
                    </div>
                  </div>
                )}

                {studioTool === 'templates' && (
                  <div className="grid grid-cols-2 gap-2">
                    {TEMPLATES.map(tpl => (
                      <button key={tpl.id} onClick={() => handleApplyTemplate(tpl.text)} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-left hover:border-red-200 transition-all">
                        <i className={`fas ${tpl.icon} text-red-500 text-[10px] mb-1`}></i>
                        <p className="text-[10px] font-bold text-slate-700 leading-tight">{tpl.title}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Aba Copywriter Compacta */
          <div className="flex-1 overflow-hidden flex flex-col space-y-3">
             <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Setores Ativos</span>
                  <button onClick={() => setIsAddingProfile(!isAddingProfile)} className="text-[9px] font-bold text-red-600">{isAddingProfile ? 'Cancelar' : '+ Novo'}</button>
                </div>
                {isAddingProfile ? (
                  <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                    <input value={newProfileSector} onChange={e => setNewProfileSector(e.target.value)} placeholder="Setor" className="flex-1 p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs"/>
                    <button onClick={handleAddProfile} className="px-3 bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase">OK</button>
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {profiles.map(p => (
                      <button key={p.id} onClick={() => selectProfile(p.id)} className={`shrink-0 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all ${selectedProfileId === p.id ? 'bg-red-600 border-red-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>{p.sector}</button>
                    ))}
                  </div>
                )}
             </div>

             <div className="flex-1 bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="flex gap-1 mb-3 bg-slate-50 p-1 rounded-lg">
                  {['vendedor', 'gourmet', 'familia', 'urgencia'].map(s => (
                    <button key={s} onClick={() => setCopyStyle(s)} className={`flex-1 py-1.5 text-[8px] font-bold uppercase rounded-md transition-all ${copyStyle === s ? 'bg-white shadow-sm text-red-600' : 'text-slate-400'}`}>{s}</button>
                  ))}
                </div>
                <textarea value={briefing} onChange={e => setBriefing(e.target.value)} placeholder="O que vamos anunciar?" className="flex-1 w-full p-3 bg-slate-50 rounded-xl text-xs focus:outline-none resize-none border-0 mb-3"/>
                <button onClick={handleCreateCopy} disabled={!briefing || isCopying} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                  {isCopying ? 'Criando Roteiro...' : 'Gerar Texto de 35s'}
                </button>
             </div>

             {generatedCopy && (
               <div className="bg-red-600 rounded-xl p-3 text-white flex items-center justify-between shrink-0 shadow-lg animate-in zoom-in-95">
                 <p className="text-[10px] font-bold uppercase">Roteiro Gerado!</p>
                 <button onClick={() => { setText(generatedCopy); setActiveTab('studio'); setGeneratedCopy(''); }} className="bg-white text-red-600 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase">Editar no Estúdio</button>
               </div>
             )}
          </div>
        )}
      </main>

      {/* Ações Fixas (Sem Scroll) */}
      <footer className="p-3 bg-white border-t border-slate-200 shrink-0">
        {!audioBlobUrl ? (
          <button onClick={handleGenerateAudio} disabled={!text || status === GenerationStatus.GENERATING_AUDIO} className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 ${status === GenerationStatus.GENERATING_AUDIO ? 'bg-slate-100 text-slate-300' : 'bg-red-600 text-white active:scale-95 shadow-red-200'}`}>
            {status === GenerationStatus.GENERATING_AUDIO ? <div className="w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></div> : <><i className="fas fa-play"></i> Renderizar Locução Profissional</>}
          </button>
        ) : (
          <div className="bg-slate-900 rounded-2xl p-3 flex items-center gap-4 animate-in slide-in-from-bottom-2">
            <button onClick={() => isPlaying ? audioRef.current?.pause() : audioRef.current?.play()} className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg"><i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} ${!isPlaying && 'ml-1'}`}></i></button>
            <div className="flex-1 min-w-0">
              <input type="range" min="0" max={duration || 0} step="0.01" value={currentTime} onChange={e => { if(audioRef.current) audioRef.current.currentTime = parseFloat(e.target.value); }} className="w-full h-1 bg-slate-700 rounded-lg appearance-none accent-red-600 mb-1"/>
              <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase"><span>{selectedVoice.name}</span> <span>{Math.floor(currentTime)}s / {Math.floor(duration)}s</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { const link = document.createElement('a'); link.href = audioBlobUrl; link.download = 'locucao.wav'; link.click(); }} className="text-white/50 hover:text-white"><i className="fas fa-download text-sm"></i></button>
              <button onClick={clearAudio} className="text-white/50 hover:text-red-500"><i className="fas fa-times text-sm"></i></button>
            </div>
            <audio ref={audioRef} src={audioBlobUrl} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)} onLoadedMetadata={e => setDuration(e.currentTarget.duration)} className="hidden"/>
          </div>
        )}
      </footer>

      {/* Histórico Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-end">
          <div className="w-full bg-white rounded-t-3xl p-4 animate-in slide-in-from-bottom-5 duration-300 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Histórico de Locuções</h3>
              <button onClick={() => setShowHistory(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pb-6">
              {history.length === 0 ? <p className="text-center py-10 text-[10px] text-slate-300 font-bold uppercase">Nenhuma locução anterior</p> : history.map(item => (
                <div key={item.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex justify-between mb-2">
                    <span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase">{item.voiceName}</span>
                    <span className="text-[9px] text-slate-300">{new Date(item.date).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[10px] text-slate-600 italic line-clamp-2 mb-3">"{item.text.replace(/<[^>]*>/g, '')}"</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setText(item.text); setSpeed(item.speed); setPitch(item.pitch); setShowHistory(false); clearAudio(); }} className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-[8px] font-bold uppercase">Editar e Regravar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #dc2626; border: 2px solid white; cursor: pointer; }
        .animate-in { animation-duration: 0.3s; animation-fill-mode: both; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-bottom { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes zoom-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default App;
