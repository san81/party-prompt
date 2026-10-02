// Languages and topics. Topic boards live in ./topics/<lang>.js.
import en from './topics/en.js';
import te from './topics/te.js';

export const LOCALES = {
  'en-US': {
    name: 'English',
    speech: 'en-US',
    splitWords: ['and', 'or', 'also', 'plus', 'then'],
    fillers: ['um', 'umm', 'uh', 'uhh', 'er', 'hmm', 'like', 'maybe', 'i think', 'i guess', 'is it', 'what about', 'how about', 'oh', 'okay', 'ok', 'so', 'a', 'an', 'the', 'some', 'of', 'my', 'your'],
    // Treat "candle" and "candles" as the same word.
    stem: (s) => s.replace(/(es|s)$/, ''),
    jevHint: 'This is a fun party game, not a quiz. Guesses are spoken English, often Indian English, so accept casual and playful phrasings of an answer.',
  },
  'te-IN': {
    name: 'తెలుగు',
    speech: 'te-IN',
    // Telugu conjunctions plus the English ones people mix in.
    splitWords: ['మరియు', 'ఇంకా', 'లేదా', 'తర్వాత', 'and', 'or', 'also'],
    fillers: ['ఉమ్', 'ఆఁ', 'అంటే', 'ఏమో', 'అది', 'ఇది', 'అనుకుంటా', 'అనుకుంట', 'నాకు తెలిసి', 'ఏంటంటే', 'um', 'uh', 'like', 'maybe', 'the', 'a'],
    // Treat "టపాసు" and "టపాసులు" as the same word.
    stem: (s) => s.replace(/(ళ్ళు|ల్లు|లు)$/u, ''),
    jevHint:
      'This is a fun party game, not a quiz. Guesses are spoken Telugu from Andhra Pradesh or Telangana. Players often mix in English words, and speech recognition may return Telugu script, English words, or romanized Telugu. Treat singular, plural and inflected forms (for example -లు, -ని, -కి, -లో endings) as the same word, and accept casual or playful phrasings of an answer.',
  },
};

export const TOPICS = [...en, ...te];
export const POINTS = { common: 1, medium: 2, obscure: 3 };

export const topicById = (id) => TOPICS.find((x) => x.id === id);
export const localeOf = (topic) => LOCALES[topic.locale] || LOCALES['en-US'];
