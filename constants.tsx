
import { VoiceOption, RetailTemplate } from './types';

export const VOICES: VoiceOption[] = [
  { id: 'Kore', name: 'Kore', gender: 'male', description: 'Voz encorpada e direta, ideal para ofertas rápidas.' },
  { id: 'Puck', name: 'Puck', gender: 'female', description: 'Voz amigável e entusiasmada, ótima para promoções de fim de semana.' },
  { id: 'Charon', name: 'Charon', gender: 'male', description: 'Voz clássica de locutor de rádio, ideal para anúncios solenes.' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'male', description: 'Voz grave e rústica, excelente para o setor de açougue.' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'female', description: 'Voz suave e elegante, boa para produtos premium ou vinhos.' }
];

export const TEMPLATES: RetailTemplate[] = [
  {
    id: 'oferta-carne-longa',
    category: 'Açougue',
    title: 'Picanha Premium (30s)',
    icon: 'fa-drumstick-bite',
    text: '<prosody pitch="+5%">Olá cliente amigo! O churrasco do final de semana começa agora!</prosody> <break time="500ms"/> No nosso açougue, selecionamos aquela <emphasis level="strong">Picanha Premium</emphasis>, com capa de gordura uniforme e maciez garantida. <break time="400ms"/> É qualidade que você sente no paladar! <break time="600ms"/> E o preço? <prosody volume="loud">Preste atenção!</prosody> De R$ 89,90, hoje você leva por apenas <emphasis level="strong">R$ 59,90 o quilo!</emphasis> <break time="500ms"/> Aproveite e passe no corredor 4 para garantir o carvão em oferta. <prosody rate="fast">Vem pra cá, é só enquanto durar o estoque!</prosody>'
  },
  {
    id: 'hortifruti-longo',
    category: 'Hortifruti',
    title: 'Dia da Feira (30s)',
    icon: 'fa-leaf',
    text: '<prosody pitch="+3%">Bom dia família! Que tal levar mais saúde para a sua mesa hoje?</prosody> <break time="500ms"/> Nossa equipe acabou de abastecer o setor de Hortifruti com frutas e verduras colhidas ontem, fresquinhas de verdade! <break time="400ms"/> O Tomate Italiano está lindo, vermelhinho e no ponto certo para o seu molho. <break time="600ms"/> <prosody volume="loud">Oferta imperdível:</prosody> Tomate selecionado por apenas <emphasis level="strong">R$ 4,99 o quilo!</emphasis> <break time="500ms"/> Aproveite também nossas alfaces crocantes por preço de custo. Saúde e economia você encontra aqui!'
  }
];
