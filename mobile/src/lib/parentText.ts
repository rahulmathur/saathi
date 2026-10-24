import { useCallback, useEffect, useState } from 'react';
import { getItem, setItem } from './storage';

export type Lang = 'en' | 'hi';

export const STEPS: Record<Lang, [string, string][]> = {
  en: [
    ['Check in', 'Go to the airline counter. Show your passport. Ask for your wheelchair if you booked one.'],
    ['Security check', 'Keep your passport and boarding pass in your hand. Phone, coins and belt go in the tray.'],
    ['Go to your gate', 'Your gate number is on the boarding pass and the screens. Sit near the gate and wait for boarding.'],
    ['On the plane', 'Find your seat. Ask the crew if you need help with your bag. Press help any time.'],
    ['Immigration', 'Show your passport and visa. Say why you are visiting, for example: "I am visiting my daughter."'],
    ['Bags, then family', 'Collect your bags from the belt with your flight number, then walk out. Your family is waiting.'],
  ],
  hi: [
    ['चेक-इन', 'एयरलाइन काउंटर पर जाएँ। पासपोर्ट दिखाएँ। अगर व्हीलचेयर बुक है तो माँगें।'],
    ['सुरक्षा जाँच', 'पासपोर्ट और बोर्डिंग पास हाथ में रखें। फ़ोन, सिक्के और बेल्ट ट्रे में रखें।'],
    ['अपने गेट पर जाएँ', 'गेट नंबर बोर्डिंग पास और स्क्रीन पर है। गेट के पास बैठें और बोर्डिंग का इंतज़ार करें।'],
    ['विमान में', 'अपनी सीट पर बैठें। बैग के लिए क्रू से मदद माँग सकते हैं। कभी भी मदद बटन दबाएँ।'],
    ['इमिग्रेशन', 'पासपोर्ट और वीज़ा दिखाएँ। बताएँ आप क्यों आए हैं, जैसे: "I am visiting my daughter."'],
    ['सामान, फिर परिवार', 'अपनी फ़्लाइट नंबर वाली बेल्ट से सामान लें और बाहर आएँ। आपका परिवार इंतज़ार कर रहा है।'],
  ],
};

export const T = {
  en: {
    hello: (n: string) => `Namaste, ${n} ji`,
    notAlone: 'You are not travelling alone.',
    noTrip: 'No trip planned yet. Your family will add it here.',
    yourFlight: 'Your flight',
    yourSaathi: 'Your Saathi',
    sitsNear: (seat: string | null) => (seat ? `Sits near you, seat ${seat}.` : 'On your flight.'),
    speaks: (l: string) => `Speaks ${l}.`,
    call: (n: string) => `Call ${n}`,
    start: 'Start my journey',
    listen: 'Read aloud',
    stop: 'Stop',
    size: 'Text size',
    back: 'Back',
    now: 'Do this now',
    done: 'Done, next step',
    later: 'Coming up',
    finished: 'You have arrived. Have a lovely visit!',
    restart: 'Start again',
    needHelp: 'I need help',
    helpTitle: 'Help is on the way',
    helpBody: 'Your family and your Saathi have been told. Stay where you are.',
    ok: 'OK',
    of: (a: number, b: number) => `Step ${a} of ${b}`,
    error: 'Could not connect. Please try again.',
  },
  hi: {
    hello: (n: string) => `नमस्ते, ${n} जी`,
    notAlone: 'आप अकेले यात्रा नहीं कर रहे।',
    noTrip: 'अभी कोई यात्रा नहीं है। आपका परिवार इसे यहाँ जोड़ेगा।',
    yourFlight: 'आपकी उड़ान',
    yourSaathi: 'आपके साथी',
    sitsNear: (seat: string | null) => (seat ? `आपके पास बैठेंगे, सीट ${seat}।` : 'आपकी उड़ान में हैं।'),
    speaks: (l: string) => `${l} बोलते हैं।`,
    call: (n: string) => `${n} को कॉल करें`,
    start: 'मेरी यात्रा शुरू करें',
    listen: 'सुनें',
    stop: 'रोकें',
    size: 'अक्षर का आकार',
    back: 'वापस',
    now: 'अभी यह करें',
    done: 'हो गया, अगला कदम',
    later: 'आगे',
    finished: 'आप पहुँच गए। आपकी यात्रा शुभ हो!',
    restart: 'फिर से शुरू करें',
    needHelp: 'मुझे मदद चाहिए',
    helpTitle: 'मदद आ रही है',
    helpBody: 'आपके परिवार और साथी को बता दिया गया है। वहीं रहें।',
    ok: 'ठीक है',
    of: (a: number, b: number) => `कदम ${a} / ${b}`,
    error: 'कनेक्ट नहीं हो पाया। फिर से कोशिश करें।',
  },
};

const LANG_KEY = 'saathi.parent.lang';
const SCALE_KEY = 'saathi.parent.scale';

/** Language and text size chosen on the parent's phone, remembered between launches. */
export function useParentPrefs() {
  const [lang, setLangState] = useState<Lang>('en');
  const [scale, setScaleState] = useState(1);
  useEffect(() => {
    getItem(LANG_KEY).then((v) => v === 'hi' && setLangState('hi'));
    getItem(SCALE_KEY).then((v) => v && setScaleState(Number(v) || 1));
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setItem(LANG_KEY, l);
  }, []);
  const setScale = useCallback((s: number) => {
    setScaleState(s);
    setItem(SCALE_KEY, String(s));
  }, []);
  return { lang, setLang, scale, setScale, t: T[lang] };
}
