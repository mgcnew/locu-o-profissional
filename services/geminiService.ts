
import { GoogleGenAI, Modality } from "@google/genai";

export const refineTextForRetail = async (text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Você é um engenheiro de som e locutor sênior. Converta o texto abaixo em um formato SSML otimizado para varejo.
    
    OBJETIVO: Locução rica e fluida entre 30-40 segundos. 
    Evite clichês robóticos. Use uma linguagem humana e persuasiva.
    
    REGRAS SSML:
    - <emphasis level="strong"> para o valor numérico.
    - <break time="700ms"/> para transições de assunto.
    - <prosody pitch="+5%" rate="95%"> para o corpo do texto.
    
    TEXTO ORIGINAL:
    "${text}"
    
    Retorne apenas o código SSML completo.`,
  });
  return response.text?.trim() || text;
};

export const generateRetailCopy = async (briefing: string, storeName?: string, sector?: string, style: string = 'vendedor'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const styles: Record<string, string> = {
    vendedor: "Estilo Clássico Varejo: Enérgico, direto, focado na oportunidade do dia. Use frases como 'Para tudo o que você está fazendo' ou 'Aproveite agora'.",
    gourmet: "Estilo Especialista/Gourmet: Foco na qualidade, origem do corte, marmoreio da carne ou frescor orgânico. Linguagem refinada, valorizando o prazer de comer bem.",
    familia: "Estilo Amigo da Família: Foco no carinho, na mesa cheia, na economia para o lar. Use um tom acolhedor, falando sobre cuidar de quem amamos.",
    urgencia: "Estilo Oferta Relâmpago: Agressivo, rápido, focado no cronômetro. 'É só enquanto durar o estoque', 'Últimas unidades'."
  };

  const identityContext = (storeName || sector) 
    ? `\nCONTEXTO: ${storeName ? `Loja: ${storeName}.` : ''} ${sector ? `Setor: ${sector}.` : ''}`
    : "";

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Você é um Copywriter de elite para rádio comercial. 
    Crie um roteiro de locução ÚNICO e CRIATIVO de 30 a 40 segundos.
    
    ${identityContext}
    VIBE DO ROTEIRO: ${styles[style]}
    
    INFORMAÇÕES DA OFERTA: "${briefing}"
    
    PROIBIÇÕES:
    - NÃO comece sempre com "Olá cliente amigo".
    - NÃO seja repetitivo. Varie a estrutura das frases.
    - NÃO use apenas o preço; crie uma mini-história em volta do produto.
    
    REQUISITOS:
    - Use tags SSML (<emphasis>, <break>, <prosody>).
    - Mínimo de 90 palavras para garantir o tempo de 30s-40s.
    - Se for carne, fale do cheiro, da maciez. Se for mercado, fale da facilidade e economia.
    
    Retorne apenas o roteiro em formato SSML.`,
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
    vendedor: "Voz enérgica de rádio FM.",
    urgencia: "Voz rápida e impactante.",
    amigavel: "Voz calorosa e acolhedora.",
    institucional: "Voz polida e elegante."
  };

  const performancePrompt = styleInstructions[style as keyof typeof styleInstructions] || styleInstructions.vendedor;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ 
      parts: [{ 
        text: `Interprete este roteiro SSML. RITMO CALMO para durar 35 segundos. 
        Mantenha a naturalidade de um locutor de verdade.
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
  if (!base64Audio) throw new Error("Erro na geração.");
  return base64Audio;
};
