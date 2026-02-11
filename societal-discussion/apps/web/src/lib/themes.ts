export interface ChatTheme {
  id: string;
  name: string;
  colors: {
    background: string;
    foreground: string;
    userMessageBg: string;
    userMessageText: string;
    botMessageBg: string;
    botMessageText: string;
    botMessageBorder: string;
    headerBg: string;
    headerText: string;
    primaryButton: string;
    inputBorder: string;
  };
}

export const themes: Record<string, ChatTheme> = {
  peach: {
    id: 'peach',
    name: 'Peach',
    colors: {
      background: '#FFEEE4',
      foreground: '#4A3728',
      userMessageBg: '#E07B4C',
      userMessageText: '#FFFFFF',
      botMessageBg: '#FFFFFF',
      botMessageText: '#4A3728',
      botMessageBorder: '#E8C4B8',
      headerBg: '#FFD9C7',
      headerText: '#4A3728',
      primaryButton: '#C65D34',
      inputBorder: '#E8C4B8',
    },
  },
  tuni: {
    id: 'tuni',
    name: 'TUNI Purple',
    colors: {
      background: '#F2F4FB',
      foreground: '#370065',
      userMessageBg: '#4E008E',
      userMessageText: '#FFFFFF',
      botMessageBg: '#FFFFFF',
      botMessageText: '#370065',
      botMessageBorder: '#D6A5FF',
      headerBg: '#4E008E',
      headerText: '#FFFFFF',
      primaryButton: '#9750FA',
      inputBorder: '#D6A5FF',
    },
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Blue',
    colors: {
      background: '#F0F7FA',
      foreground: '#1A365D',
      userMessageBg: '#2B6CB0',
      userMessageText: '#FFFFFF',
      botMessageBg: '#FFFFFF',
      botMessageText: '#1A365D',
      botMessageBorder: '#BEE3F8',
      headerBg: '#2C5282',
      headerText: '#FFFFFF',
      primaryButton: '#3182CE',
      inputBorder: '#90CDF4',
    },
  },
  forest: {
    id: 'forest',
    name: 'Forest Green',
    colors: {
      background: '#F0FFF4',
      foreground: '#22543D',
      userMessageBg: '#2F855A',
      userMessageText: '#FFFFFF',
      botMessageBg: '#FFFFFF',
      botMessageText: '#22543D',
      botMessageBorder: '#9AE6B4',
      headerBg: '#276749',
      headerText: '#FFFFFF',
      primaryButton: '#38A169',
      inputBorder: '#9AE6B4',
    },
  },
  slate: {
    id: 'slate',
    name: 'Slate Gray',
    colors: {
      background: '#F8FAFC',
      foreground: '#1E293B',
      userMessageBg: '#475569',
      userMessageText: '#FFFFFF',
      botMessageBg: '#FFFFFF',
      botMessageText: '#1E293B',
      botMessageBorder: '#CBD5E1',
      headerBg: '#334155',
      headerText: '#FFFFFF',
      primaryButton: '#64748B',
      inputBorder: '#CBD5E1',
    },
  },
};

export const THEME_STORAGE_KEY = 'chatTheme';
export const DEFAULT_THEME = 'ocean';

export function getThemeById(id: string): ChatTheme {
  return themes[id] || themes[DEFAULT_THEME];
}
