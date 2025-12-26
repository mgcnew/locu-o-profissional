
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
  
  const [briefing, setBriefing] = useState('');
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
  const profileScrollRef = useRef<HTMLDivElement>(null);

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
    const updated = [newProfile, ...profiles];
    saveProfiles(updated);
    setSelectedProfileId(newProfile.id);
    setNewProfileName('');
    setNewProfileSector('');
    setIsAddingProfile(false);
  };

  const selectProfile = (id: string) => {
    setSelectedProfileId(id);
    const updated = profiles.map(p => 
      p.id === id ? { ...p, lastUsed: Date.now() } : p
    );
    saveProfiles(updated);
  };

  const deleteProfile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Excluir este perfil?')) {
      const updated = profiles.filter(p => p.id !== id);
      saveProfiles(updated);
      if (selectedProfileId === id) setSelectedProfileId(updated[0]?.id || null);
    }
  };

  const currentProfile = profiles.find(p => p.id === selectedProfileId);

  const toggleFavorite = (e: React.MouseEvent, voiceId: string) => {
    e.stopPropagation();
    const newFavs = favorites.includes(voiceId) 
      ? favorites.filter(id => id !== voiceId)
      : [...favorites, voiceId];
    setFavorites(newFavs);
    localStorage.setItem('vv_favorites', JSON.stringify(newFavs));
  };

  const handleApplyTemplate = (templateText: string) => {
    setText(templateText);
    clearAudio();
  };

  const clearAudio = () => {
    setAudioBlobUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  };

  const handleRefineText = async () => {
    if (!text.trim()) return;
    setStatus(GenerationStatus.REFINING);
    try {
      const refined = await refineTextForRetail(text);
      setText(refined);
      setStatus(GenerationStatus.IDLE);
    } catch (error) {
      setErrorMessage('Erro ao refinar texto.');
      setStatus(GenerationStatus.ERROR);
    }
  };

  const handleCreateCopy = async () => {
    if (!briefing.trim()) return;
    setIsCopying(true);
    setErrorMessage('');
    try {
      const result = await generateRetailCopy(
        briefing, 
        currentProfile?.name, 
        currentProfile?.sector
      );
      setGeneratedCopy(result);
    } catch (error) {
      setErrorMessage('Erro ao gerar roteiro.');
    } finally {
      setIsCopying(false);
    }
  };

  const useCopyInStudio = () => {
    setText(generatedCopy);
    setActiveTab('studio');
    clearAudio();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGenerateAudio = async () => {
    if (!text.trim()) return;
    setStatus(GenerationStatus.GENERATING_AUDIO);
    setErrorMessage('');
    clearAudio();
    try {
      const base64Audio = await generateRetailAudio(text, selectedVoice.id, speed, pitch, style);
      const pcmData = decode(base64Audio);
      const wavBlob = pcmToWav(pcmData, 24000);
      const url = URL.createObjectURL(wavBlob);
      setAudioBlobUrl(url);
      setStatus(GenerationStatus.SUCCESS);
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        text: text,
        voiceId: selectedVoice.id,
        voiceName: selectedVoice.name,
        speed: speed,
        pitch: pitch,
        date: Date.now(),
        audioBlobUrl: url
      };
      const newHistory = [newItem, ...history].slice(0, 20);
      setHistory(newHistory);
      const metaToSave = newHistory.map(({ audioBlobUrl, ...meta }) => meta);
      localStorage.setItem('vv_history_meta', JSON.stringify(metaToSave));
      setTimeout(() => { if (audioRef.current) audioRef.current.play(); }, 100);
    } catch (error) {
      setErrorMessage('Falha ao gerar áudio.');
      setStatus(GenerationStatus.ERROR);
    }
  };

  const handlePreviewVoice = async (e: React.MouseEvent, voice: VoiceOption) => {
    e.stopPropagation();
    if (previewingVoiceId) return;
    setPreviewingVoiceId(voice.id);
    try {
      const previewText = `Olá! Eu sou a voz do ${voice.name}.`;
      const base64Audio = await generateRetailAudio(previewText, voice.id, speed, pitch, 'amigavel');
      if (!previewAudioContextRef.current) {
        previewAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = previewAudioContextRef.current;
      const { decodeAudioData: decodeData } = await import('./utils/audioUtils');
      const audioBuffer = await decodeData(decode(base64Audio), ctx, 24000, 1);
      if (previewSourceRef.current) { try { previewSourceRef.current.stop(); } catch (e) {} }
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
      previewSourceRef.current = source;
    } catch (error) { console.error(error); } finally { setPreviewingVoiceId(null); }
  };

  const handleDownload = (itemUrl?: string, name?: string) => {
    const url = itemUrl || audioBlobUrl;
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `locucao-${name || selectedVoice.name.toLowerCase()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadFromHistory = (item: HistoryItem) => {
    setText(item.text);
    setSpeed(item.speed);
    setPitch(item.pitch);
    const voice = VOICES.find(v => v.id === item.voiceId);
    if (voice) setSelectedVoice(voice);
    if (item.audioBlobUrl) {
      setAudioBlobUrl(item.audioBlobUrl);
      setTimeout(() => { if (audioRef.current) audioRef.current.play(); }, 100);
    } else { clearAudio(); }
    setShowHistory(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    isPlaying ? audioRef.current.pause() : audioRef.current.play();
  };

  const skipTime = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime += seconds;
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sortedVoices = [...VOICES].sort((a, b) => {
    const aFav = favorites.includes(a.id);
    const bFav = favorites.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-44">
      <header className="bg-red-600 text-white p-6 shadow-lg sticky top-0 z-50">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg text-red-600 shadow-inner">
              <i className="fas fa-bullhorn text-2xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">VarejoVoice AI</h1>
              <p className="text-[10px] text-red-100 uppercase font-semibold tracking-wider opacity-90">Locuções Comerciais</p>
            </div>
          </div>
          <button onClick={() => setShowHistory(!showHistory)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${showHistory ? 'bg-white text-red-600' : 'bg-red-700 text-white'}`}><i className="fas fa-history"></i></button>
        </div>
        {!showHistory && (
          <div className="max-w-md mx-auto mt-4 flex bg-red-700/50 rounded-xl p-1">
            <button onClick={() => setActiveTab('studio')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'studio' ? 'bg-white text-red-600 shadow-sm' : 'text-red-100'}`}>Estúdio</button>
            <button onClick={() => setActiveTab('copywriter')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'copywriter' ? 'bg-white text-red-600 shadow-sm' : 'text-red-100'}`}>Copywriter</button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-md mx-auto w-full p-4 space-y-6">
        {showHistory ? (
          <section className="animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-center mb-4 px-1">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Histórico Recente</h2>
              {history.length > 0 && <button onClick={() => { if(confirm('Limpar?')) {setHistory([]); localStorage.removeItem('vv_history_meta');}}} className="text-[10px] font-bold text-red-600 uppercase">Limpar Tudo</button>}
            </div>
            {history.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-slate-200">
                <i className="fas fa-folder-open text-slate-200 text-4xl mb-4"></i>
                <p className="text-sm text-slate-400 font-medium">Histórico vazio.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full uppercase">{item.voiceName}</span>
                        <span className="text-[10px] text-slate-400">{new Date(item.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-2">
                        {item.audioBlobUrl && <button onClick={() => handleDownload(item.audioBlobUrl, `locucao-${item.voiceName}`)} className="w-7 h-7 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:text-red-600 transition-colors"><i className="fas fa-download text-[10px]"></i></button>}
                      </div>
                    </div>
                    <p className="text-xs text-slate-700 line-clamp-2 italic mb-3">"{item.text}"</p>
                    <button onClick={() => handleLoadFromHistory(item)} className="w-full py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-red-50 hover:text-red-600 transition-all">
                      {item.audioBlobUrl ? 'Ouvir e Carregar' : 'Carregar Parâmetros'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowHistory(false)} className="w-full mt-6 py-3 border-2 border-slate-200 text-slate-400 rounded-2xl font-bold uppercase text-xs tracking-widest">Voltar</button>
          </section>
        ) : activeTab === 'copywriter' ? (
          <section className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <i className="fas fa-store text-red-500 text-xs"></i>
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Seus Setores Salvos</span>
                </div>
                <button onClick={() => setIsAddingProfile(!isAddingProfile)} className="w-7 h-7 bg-red-50 text-red-600 rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-all"><i className={`fas ${isAddingProfile ? 'fa-times' : 'fa-plus'} text-[10px]`}></i></button>
              </div>
              <div className="relative group">
                <div ref={profileScrollRef} className="p-3 flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pr-12 scroll-smooth">
                  {profiles.map((p) => (
                    <div key={p.id} onClick={() => selectProfile(p.id)} className={`shrink-0 px-5 py-3 rounded-2xl border-2 transition-all flex items-center gap-4 relative snap-start min-w-[140px] ${selectedProfileId === p.id ? 'border-red-500 bg-red-50 ring-4 ring-red-500/5' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300'}`}>
                      <div className="min-w-0">
                        <p className={`text-[11px] font-black uppercase truncate mb-0.5 ${selectedProfileId === p.id ? 'text-red-700' : 'text-slate-600'}`}>{p.sector}</p>
                        <p className="text-[9px] opacity-70 truncate font-medium">{p.name}</p>
                      </div>
                      <button onClick={(e) => deleteProfile(e, p.id)} className={`transition-opacity ${selectedProfileId === p.id ? 'text-red-300 hover:text-red-500' : 'text-slate-300 hover:text-red-500'}`}><i className="fas fa-trash-alt text-[9px]"></i></button>
                    </div>
                  ))}
                  {profiles.length === 0 && !isAddingProfile && <p className="text-[10px] text-slate-400 italic p-2">Nenhum setor cadastrado ainda.</p>}
                  {profiles.length > 2 && <div className="shrink-0 w-8" aria-hidden="true"></div>}
                </div>
                {profiles.length > 2 && (
                  <>
                    <div className="absolute top-0 right-0 bottom-0 w-16 pointer-events-none bg-gradient-to-l from-white via-white/40 to-transparent z-10"></div>
                    <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-6 h-6 bg-white border border-slate-100 rounded-full shadow-sm flex items-center justify-center text-slate-300 animate-pulse pointer-events-none z-20"><i className="fas fa-chevron-right text-[8px]"></i></div>
                  </>
                )}
              </div>
              <div className={`transition-all duration-300 overflow-hidden ${isAddingProfile ? 'max-h-60 p-4 border-t border-slate-100' : 'max-h-0'}`}>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Loja/Mercado</label>
                    <input type="text" value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} placeholder="Nome da Loja" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-red-500 focus:outline-none transition-all"/>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Setor</label>
                    <input type="text" value={newProfileSector} onChange={(e) => setNewProfileSector(e.target.value)} placeholder="Ex: Açougue" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-red-500 focus:outline-none transition-all"/>
                  </div>
                </div>
                <button onClick={handleAddProfile} disabled={!newProfileName || !newProfileSector} className="w-full py-2.5 bg-red-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 active:scale-95 transition-all shadow-md shadow-red-100">Salvar Novo Perfil</button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
               <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="fas fa-code text-red-200"></i>
                    <h2 className="text-lg font-bold">Copywriter SSML</h2>
                  </div>
                  {currentProfile ? (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="bg-red-900/30 px-3 py-1.5 rounded-full border border-red-400/30 flex items-center gap-2 backdrop-blur-sm">
                        <i className="fas fa-circle text-[6px] text-green-400 animate-pulse"></i>
                        <p className="text-[10px] text-red-500 font-bold uppercase"><span className="text-white opacity-80">{currentProfile.name}</span> • {currentProfile.sector}</p>
                      </div>
                    </div>
                  ) : <p className="text-xs text-red-100 opacity-90 leading-relaxed mb-4">Roteiros com tecnologia SSML para naturalidade total!</p>}
                  
                  <div className="space-y-4">
                    <textarea value={briefing} onChange={(e) => setBriefing(e.target.value)} placeholder="Descreva as ofertas... A IA cuidará de todas as marcações técnicas de voz." className="w-full h-24 p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:bg-white/20 focus:outline-none transition-all text-sm"/>
                    
                    {/* SSML Legend */}
                    <div className="grid grid-cols-2 gap-3 p-3 bg-black/30 rounded-xl border border-white/10">
                       <div className="flex flex-col gap-0.5"><code className="text-[9px] text-red-200">&lt;emphasis&gt;</code> <span className="text-[8px] font-bold text-red-50 uppercase opacity-60">Destaque Máximo</span></div>
                       <div className="flex flex-col gap-0.5"><code className="text-[9px] text-red-200">&lt;break/&gt;</code> <span className="text-[8px] font-bold text-red-50 uppercase opacity-60">Pausa Humana</span></div>
                       <div className="flex flex-col gap-0.5"><code className="text-[9px] text-red-200">&lt;prosody pitch&gt;</code> <span className="text-[8px] font-bold text-red-50 uppercase opacity-60">Tom e Energia</span></div>
                       <div className="flex flex-col gap-0.5"><code className="text-[9px] text-red-200">&lt;prosody rate&gt;</code> <span className="text-[8px] font-bold text-red-50 uppercase opacity-60">Velocidade</span></div>
                    </div>

                    <button onClick={handleCreateCopy} disabled={!briefing.trim() || isCopying} className="w-full py-4 bg-white text-red-600 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all disabled:opacity-50">{isCopying ? 'Codificando Roteiro SSML...' : 'Gerar Roteiro de Alta Fidelidade'}</button>
                  </div>
               </div>
               <i className="fas fa-broadcast-tower absolute -bottom-6 -right-6 text-white/5 text-8xl"></i>
            </div>

            {generatedCopy && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código da Locução (SSML)</span>
                  <button onClick={() => setGeneratedCopy('')} className="text-[10px] font-bold text-slate-400">Limpar</button>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-4 overflow-x-auto">
                  <pre className="text-xs text-green-400 leading-relaxed font-mono whitespace-pre-wrap">{generatedCopy}</pre>
                </div>
                <div className="flex gap-2">
                  <button onClick={useCopyInStudio} className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all"><i className="fas fa-play-circle"></i> Renderizar Locução</button>
                  <button onClick={() => {const clean = generatedCopy.replace(/<[^>]*>/g, ''); setText(clean); setActiveTab('studio');}} className="px-4 py-4 bg-slate-100 text-slate-400 rounded-xl font-bold uppercase tracking-widest text-[10px] active:scale-95 transition-all">Limpar Tags</button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-bold text-slate-700">Edição de Roteiro (SSML)</label>
                <button onClick={handleRefineText} disabled={!text || status === GenerationStatus.REFINING} className="text-xs flex items-center gap-1.5 text-red-600 font-bold hover:bg-red-50 px-3 py-1.5 rounded-full border border-red-100 transition-colors disabled:opacity-50">
                  <i className="fas fa-wand-magic-sparkles"></i> {status === GenerationStatus.REFINING ? 'Processando...' : 'Otimizar com SSML'}
                </button>
              </div>
              <textarea value={text} onChange={(e) => { setText(e.target.value); clearAudio(); }} placeholder="Dica: Use <emphasis level='strong'>Preço</emphasis> para destacar valores." className="w-full h-28 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 transition-all text-slate-800 text-xs font-mono leading-relaxed"/>
            </section>

            <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                 <i className="fas fa-sliders text-red-500 text-sm"></i>
                 <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Direção Artística</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'vendedor', label: 'Vendedor', icon: 'fa-bullhorn' },
                  { id: 'urgencia', label: 'Urgência', icon: 'fa-bolt' },
                  { id: 'amigavel', label: 'Amigável', icon: 'fa-smile' },
                  { id: 'institucional', label: 'Elegante', icon: 'fa-medal' }
                ].map((s) => (
                  <button key={s.id} onClick={() => { setStyle(s.id); clearAudio(); }} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all active:scale-95 ${style === s.id ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-50 bg-slate-50 text-slate-500'}`}><i className={`fas ${s.icon} text-xs`}></i> <span className="text-[10px] font-bold uppercase tracking-wider">{s.label}</span></button>
                ))}
              </div>
              <div className="space-y-6 pt-2">
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase"><span>Lento</span> <span className="text-red-600 bg-red-50 px-2 rounded-full font-black">{speed.toFixed(1)}x</span> <span>Rápido</span></div>
                  <input type="range" min="0.5" max="2.0" step="0.1" value={speed} onChange={(e) => { setSpeed(parseFloat(e.target.value)); clearAudio(); }} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-red-600"/>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase"><span>Grave</span> <span className="text-red-600 bg-red-50 px-2 rounded-full font-black">{pitch > 0 ? `+${pitch}` : pitch}</span> <span>Agudo</span></div>
                  <input type="range" min="-10" max="10" step="1" value={pitch} onChange={(e) => { setPitch(parseInt(e.target.value)); clearAudio(); }} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-red-600"/>
                </div>
              </div>
            </section>

            <section><div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">{TEMPLATES.map((tpl) => (<button key={tpl.id} onClick={() => handleApplyTemplate(tpl.text)} className="bg-white p-3 rounded-xl border border-slate-200 min-w-[140px] text-left hover:border-red-300 transition-all shadow-sm active:scale-95 shrink-0"><i className={`fas ${tpl.icon} text-red-500 text-xs mb-2 block`}></i> <h3 className="text-[11px] font-bold text-slate-800 line-clamp-1 uppercase">{tpl.title}</h3></button>))}</div></section>

            <section className="space-y-3 pb-8">
              <div className="flex items-center gap-2 mb-1 px-1"><i className="fas fa-users text-red-500 text-sm"></i> <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Vozes do Elenco</h2></div>
              {sortedVoices.map((voice) => {
                const isFav = favorites.includes(voice.id);
                const isSelected = selectedVoice.id === voice.id;
                return (
                  <div key={voice.id} onClick={() => { setSelectedVoice(voice); clearAudio(); }} className={`relative flex items-center gap-4 p-3 rounded-2xl border-2 transition-all cursor-pointer ${isSelected ? 'border-red-500 bg-red-50 shadow-md ring-4 ring-red-500/5' : 'border-white bg-white hover:border-slate-200'}`}>
                    <button onClick={(e) => toggleFavorite(e, voice.id)} className={`absolute -top-2 -right-2 w-8 h-8 rounded-full shadow-lg flex items-center justify-center transition-all z-10 ${isFav ? 'bg-red-500 text-white scale-110' : 'bg-white text-slate-300'}`}><i className={`${isFav ? 'fas' : 'far'} fa-heart text-xs`}></i></button>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-inner shrink-0 ${voice.gender === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}><i className={`fas ${voice.gender === 'male' ? 'fa-user-tie' : 'fa-user-graduate'} text-lg`}></i></div>
                    <div className="flex-1 min-w-0 pr-6"><div className="flex items-center gap-2 mb-0.5"><span className="font-bold text-slate-800 text-sm truncate">{voice.name}</span> {isSelected && <span className="bg-red-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase">Ativo</span>}</div><p className="text-[11px] text-slate-500 line-clamp-1 italic">{voice.description}</p></div>
                    <button onClick={(e) => handlePreviewVoice(e, voice)} disabled={previewingVoiceId !== null} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${previewingVoiceId === voice.id ? 'bg-slate-200 text-slate-400 animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-600'}`}>{previewingVoiceId === voice.id ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div> : <i className="fas fa-volume-up text-sm"></i>}</button>
                  </div>
                );
              })}
            </section>
          </>
        )}
      </main>

      <div className={`fixed bottom-0 left-0 right-0 p-4 bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.08)] border-t border-slate-200 z-50 transition-transform duration-300 transform ${audioBlobUrl ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="max-w-md mx-auto space-y-3">
          <audio ref={audioRef} src={audioBlobUrl || ''} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} className="hidden"/>
          <div className="space-y-1">
            <input type="range" min="0" max={duration || 0} step="0.01" value={currentTime} onChange={handleProgressChange} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-red-600 player-range"/>
            <div className="flex justify-between text-[10px] font-bold text-slate-400"><span>{formatTime(currentTime)}</span> <span>{formatTime(duration)}</span></div>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={() => handleDownload()} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 transition-all"><i className="fas fa-download"></i></button>
            <div className="flex items-center gap-4">
              <button onClick={() => skipTime(-5)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:text-red-600 transition-all"><i className="fas fa-undo"></i></button>
              <button onClick={togglePlayPause} className="w-14 h-14 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-200 transition-all"><i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-xl ${!isPlaying && 'ml-1'}`}></i></button>
              <button onClick={() => skipTime(5)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:text-red-600 transition-all"><i className="fas fa-redo"></i></button>
            </div>
            <button onClick={clearAudio} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 transition-all"><i className="fas fa-times"></i></button>
          </div>
        </div>
      </div>

      {!audioBlobUrl && !showHistory && activeTab === 'studio' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-200 z-50">
          <div className="max-w-md mx-auto">
            <button onClick={handleGenerateAudio} disabled={!text.trim() || status === GenerationStatus.GENERATING_AUDIO || status === GenerationStatus.REFINING || previewingVoiceId !== null} className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95 ${status === GenerationStatus.GENERATING_AUDIO ? 'bg-slate-200 text-slate-400' : 'bg-red-600 text-white hover:bg-red-700 shadow-red-500/20'}`}>
              {status === GenerationStatus.GENERATING_AUDIO ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent"></div> : <><i className="fas fa-microchip"></i> Renderizar com Tecnologia SSML</>}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        input[type=range].player-range::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #dc2626; border: 2px solid white; cursor: pointer; margin-top: -4px; }
        input[type=range].player-range::-webkit-slider-runnable-track { width: 100%; height: 4px; background: #f1f5f9; border-radius: 2px; }
        input[type=range]:not(.player-range)::-webkit-slider-thumb { -webkit-appearance: none; height: 20px; width: 20px; border-radius: 50%; background: #dc2626; border: 2px solid white; cursor: pointer; }
        @keyframes animate-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: animate-in 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default App;
