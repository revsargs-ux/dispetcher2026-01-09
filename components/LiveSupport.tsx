
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';

interface LiveSupportProps {
  workerName: string;
  onClose: () => void;
}

export const LiveSupport: React.FC<LiveSupportProps> = ({ workerName, onClose }) => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('Подключение...');
  const [isInterrupted, setIsInterrupted] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const createBlob = (data: Float32Array) => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const startSession = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const sessionPromise = ai.live.connect({
        // Updated model name to 'gemini-2.5-flash-native-audio-preview-12-2025' per GenAI guidelines
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setStatus('Слушаю...');
            setIsActive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              // Use sessionPromise to prevent race conditions and ensure session is active
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const ctx = audioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error('Live error:', e);
            setStatus('Ошибка связи');
          },
          onclose: () => {
            setIsActive(false);
            setStatus('Отключено');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          },
          systemInstruction: `Ты — ИИ-диспетчер системы управления персоналом. Твоя задача — помогать рабочему по имени ${workerName}. Отвечай коротко, профессионально и по делу. Если рабочий на смене, подбадривай его. Если есть проблемы — советуй обратиться к главному диспетчеру. Твой тон — спокойный и уверенный.`,
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Failed to start Live session:', err);
      setStatus('Ошибка доступа');
    }
  };

  useEffect(() => {
    startSession();
    return () => {
      if (sessionRef.current) sessionRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-950/90 z-[1000] flex items-center justify-center backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-slate-900 rounded-[3rem] border border-white/10 p-10 flex flex-col items-center text-center shadow-2xl">
        <div className="relative mb-10">
          <div className={`w-32 h-32 rounded-full bg-cyan-500/10 flex items-center justify-center border-2 border-cyan-500/20 ${isActive ? 'animate-pulse' : ''}`}>
             <div className="text-5xl">🤖</div>
          </div>
          {isActive && (
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-40 h-40 rounded-full border border-cyan-500/20 animate-ping"></div>
            </div>
          )}
        </div>
        
        <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">Голосовой помощник</h3>
        <p className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em] mb-8">{status}</p>
        
        <div className="space-y-4 w-full">
          <p className="text-slate-400 text-xs font-medium px-4 leading-relaxed">
            Вы можете говорить. ИИ поможет с навигацией, правилами объекта или свяжет с диспетчером.
          </p>
          
          <button 
            onClick={onClose}
            className="w-full bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all active:scale-95"
          >
            Завершить звонок
          </button>
        </div>
      </div>
    </div>
  );
};
