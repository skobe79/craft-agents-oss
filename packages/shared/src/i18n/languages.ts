export const SUPPORTED_LANGUAGE_CODES = ["en", "es", "zh-Hans"] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];

export interface LanguageConfig {
  nativeName: string;
}

export const LANGUAGES: Record<LanguageCode, LanguageConfig> = {
  en: { nativeName: "English" },
  es: { nativeName: "Español" },
  "zh-Hans": { nativeName: "简体中文" },
};
