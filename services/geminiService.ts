
import { GoogleGenAI, Modality } from "@google/genai";

export const refineTextForRetail = async (text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Você é um engenheiro de som e locutor sênior. Converta o texto abaixo em um formato SSML (Speech Synthesis Markup Language) otimizado para varejo.
    
    OBJETIVO: O texto deve ser detalhado para durar cerca de 30 segundos. Se o texto original for curto, amplie-o com frases vendedoras e descrições apetitosas.
    
    REGRAS DE MARCAÇÃO:
    - Use <emphasis level="strong"> para preços e palavras-chave.
    - Use <break time="600ms"/> entre blocos de informação para criar suspense.
    - Use <prosody pitch="+10%" rate="medium"> para o corpo do texto e <prosody rate="fast"> apenas para urgência final.
    - Use <prosody volume="loud"> para chamadas principais.
    
    TEXTO ORIGINAL:
    "${text}"
    
    Retorne apenas o código SSML completo.`,
  });
  return response.text?.trim() || text;
};

export const generateRetailCopy = async (briefing: string, storeName?: string, sector?: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const identityContext = (storeName || sector) 
    ? `\nCONTEXTO: ${storeName ? `Loja: ${storeName}.` : ''} ${sector ? `Setor: ${sector}.` : ''}`
    : "";

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Você é um Copywriter e Diretor de Voz especialista em rádio de varejo. 
    Sua missão é criar um roteiro PROFISSIONAL e COMPLETO de aproximadamente 30 segundos (cerca de 60 a 80 palavras bem pausadas).
    ${identityContext}
    
    INFORMAÇÕES DA OFERTA: "${briefing}"
    
    ESTRUTURA OBRIGATÓRIA (Use SSML):
    1. INTRODUÇÃO (5s): Saudação calorosa e nome da loja.
    2. DESENVOLVIMENTO (10s): Descreva a qualidade, o frescor ou o sabor do produto. Use adjetivos que deem "água na boca".
    3. A OFERTA (7s): O preço com ênfase máxima e pausas antes do valor.
    4. SUGESTÃO (5s): Sugira um item que combina (ex: se for carne, sugira carvão ou tempero).
    5. FECHAMENTO (3s): Chamada para ação urgente e localização dentro da loja.

    REGRAS TÉCNICAS SSML:
    - Use <emphasis level="strong"> em preços.
    - Use <break time="500ms"/> para separar as seções.
    - Use <prosody pitch="+5%"> para entusiasmo.
    
    Retorne apenas o roteiro em formato SSML pronto para locução.`,
  });
  return response.text?.trim() || "";
};

export const generateRetailAudio = async (
  text: string, 
  voiceName: string, 
  speed: number = 1.0, 
  pitch: number = 0,
  style: string = 'vendedor'
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const styleInstructions = {
    vendedor: "Voz enérgica de rádio FM, estilo animador de palco. Fale com clareza e entusiasmo.",
    urgencia: "Voz rápida, mas compreensível. Tom de oportunidade única.",
    amigavel: "Voz calorosa, rindo com a voz, acolhedora.",
    institucional: "Voz polida, elegante e com autoridade."
  };

  const performancePrompt = styleInstructions[style as keyof typeof styleInstructions] || styleInstructions.vendedor;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ 
      parts: [{ 
        text: `Você é um locutor de rádio profissional de elite. Interprete as tags SSML abaixo. 
        Mantenha um ritmo cadenciado para que a locução dure o tempo planejado (aproximadamente 30 segundos).
        Não corra com o texto, valorize as pausas (<break>).
        
        ESTILO: ${performancePrompt}. 
        VELOCIDADE BASE: ${speed}. 
        PITCH BASE: ${pitch}.

        TEXTO SSML:
        ${text}` 
      }] 
    }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Falha na renderização.");
  }
  return base64Audio;
};
