import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import en from './en.json';
import zhTW from './zh-TW.json';

type Translations = Record<string, string>;

const locales: Record<string, Translations> = {
  en,
  'zh-TW': zhTW,
};

export const supportedLanguages = [
  { code: 'en', label: 'language.en' },
  { code: 'zh-TW', label: 'language.zhTW' },
] as const;

interface I18nContextValue {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

export function I18nProvider({
  language: initialLang,
  children,
}: {
  language: string;
  children: ReactNode;
}) {
  const [language, setLanguage] = useState(initialLang);

  const t = useCallback(
    (key: string, params?: Record<string, string>) => {
      const translations = locales[language] || locales.en;
      let text = translations[key] || locales.en[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, v);
        });
      }
      return text;
    },
    [language]
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
