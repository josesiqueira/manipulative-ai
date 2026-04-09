/**
 * Topic-based color schemes for the chat interface.
 */

export interface TopicColors {
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
}

export const topicColors: Record<string, TopicColors> = {
  immigration: {
    background: '#FDF6F0', foreground: '#5D4037',
    userMessageBg: '#A1887F', userMessageText: '#FFFFFF',
    botMessageBg: '#FFFFFF', botMessageText: '#5D4037', botMessageBorder: '#D7CCC8',
    headerBg: '#8D6E63', headerText: '#FFFFFF',
    primaryButton: '#6D4C41', inputBorder: '#BCAAA4',
  },
  healthcare: {
    background: '#E8F5F5', foreground: '#1A4D4D',
    userMessageBg: '#26A69A', userMessageText: '#FFFFFF',
    botMessageBg: '#FFFFFF', botMessageText: '#1A4D4D', botMessageBorder: '#B2DFDB',
    headerBg: '#00897B', headerText: '#FFFFFF',
    primaryButton: '#00796B', inputBorder: '#80CBC4',
  },
  economy: {
    background: '#F5F6FA', foreground: '#1A237E',
    userMessageBg: '#3949AB', userMessageText: '#FFFFFF',
    botMessageBg: '#FFFFFF', botMessageText: '#1A237E', botMessageBorder: '#C5CAE9',
    headerBg: '#303F9F', headerText: '#FFFFFF',
    primaryButton: '#3F51B5', inputBorder: '#9FA8DA',
  },
  education: {
    background: '#FBF5F5', foreground: '#4A1C40',
    userMessageBg: '#7B1FA2', userMessageText: '#FFFFFF',
    botMessageBg: '#FFFFFF', botMessageText: '#4A1C40', botMessageBorder: '#E1BEE7',
    headerBg: '#6A1B9A', headerText: '#FFFFFF',
    primaryButton: '#8E24AA', inputBorder: '#CE93D8',
  },
  foreign_policy: {
    background: '#F4F6F8', foreground: '#37474F',
    userMessageBg: '#607D8B', userMessageText: '#FFFFFF',
    botMessageBg: '#FFFFFF', botMessageText: '#37474F', botMessageBorder: '#CFD8DC',
    headerBg: '#546E7A', headerText: '#FFFFFF',
    primaryButton: '#455A64', inputBorder: '#B0BEC5',
  },
  environment: {
    background: '#F1F8E9', foreground: '#33691E',
    userMessageBg: '#689F38', userMessageText: '#FFFFFF',
    botMessageBg: '#FFFFFF', botMessageText: '#33691E', botMessageBorder: '#C5E1A5',
    headerBg: '#558B2F', headerText: '#FFFFFF',
    primaryButton: '#7CB342', inputBorder: '#AED581',
  },
  technology: {
    background: '#E3F2FD', foreground: '#0D47A1',
    userMessageBg: '#1976D2', userMessageText: '#FFFFFF',
    botMessageBg: '#FFFFFF', botMessageText: '#0D47A1', botMessageBorder: '#BBDEFB',
    headerBg: '#1565C0', headerText: '#FFFFFF',
    primaryButton: '#2196F3', inputBorder: '#90CAF9',
  },
  equality: {
    background: '#FCE4EC', foreground: '#880E4F',
    userMessageBg: '#C2185B', userMessageText: '#FFFFFF',
    botMessageBg: '#FFFFFF', botMessageText: '#880E4F', botMessageBorder: '#F8BBD9',
    headerBg: '#AD1457', headerText: '#FFFFFF',
    primaryButton: '#D81B60', inputBorder: '#F48FB1',
  },
  social_welfare: {
    background: '#FFF8E1', foreground: '#E65100',
    userMessageBg: '#FB8C00', userMessageText: '#FFFFFF',
    botMessageBg: '#FFFFFF', botMessageText: '#E65100', botMessageBorder: '#FFECB3',
    headerBg: '#F57C00', headerText: '#FFFFFF',
    primaryButton: '#FF9800', inputBorder: '#FFE082',
  },
  default: {
    background: '#F0F7FA', foreground: '#1A365D',
    userMessageBg: '#2B6CB0', userMessageText: '#FFFFFF',
    botMessageBg: '#FFFFFF', botMessageText: '#1A365D', botMessageBorder: '#BEE3F8',
    headerBg: '#2C5282', headerText: '#FFFFFF',
    primaryButton: '#3182CE', inputBorder: '#90CDF4',
  },
};

export function getTopicColors(topicKey: string): TopicColors {
  return topicColors[topicKey] || topicColors.default;
}
