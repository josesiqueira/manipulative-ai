'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeSelector } from '@/components/ThemeSelector';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Topic {
  id: string;
  label_en: string;
  label_fi: string;
  welcome_message_en?: string;
  welcome_message_fi?: string;
  warning?: boolean;
}

interface SessionRules {
  min_exchanges_before_survey: number;
  max_exchanges_per_chat: number | null;
  idle_timeout_minutes: number | null;
}

export default function ChatPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { theme: currentTheme } = useTheme();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Session rules state
  const [sessionRules, setSessionRules] = useState<SessionRules>({
    min_exchanges_before_survey: 3,
    max_exchanges_per_chat: null,
    idle_timeout_minutes: null,
  });
  const [maxExchangesReached, setMaxExchangesReached] = useState(false);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get participant ID from localStorage
  const participantId = typeof window !== 'undefined' ? localStorage.getItem('participantId') : null;

  // Reset idle timeout function
  const resetIdleTimeout = useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    if (sessionRules.idle_timeout_minutes && chatId) {
      idleTimeoutRef.current = setTimeout(() => {
        // Auto-redirect to survey on idle timeout
        router.push(`/${locale}/survey?chatId=${chatId}&timeout=true`);
      }, sessionRules.idle_timeout_minutes * 60 * 1000);
    }
  }, [sessionRules.idle_timeout_minutes, chatId, locale, router]);

  // Fetch session rules and topics on mount
  useEffect(() => {
    // Fetch session rules
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/session-rules`)
      .then((res) => res.json())
      .then((data) => setSessionRules(data))
      .catch(console.error);

    // Fetch topics
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/topics`)
      .then((res) => res.json())
      .then((data) => setTopics(data.topics))
      .catch(console.error);
  }, []);

  // Scroll to bottom when messages change and check max exchanges
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    // Check if max exchanges reached (count user messages as exchanges)
    if (sessionRules.max_exchanges_per_chat) {
      const userMessageCount = messages.filter(m => m.role === 'user').length;
      if (userMessageCount >= sessionRules.max_exchanges_per_chat) {
        setMaxExchangesReached(true);
      }
    }
  }, [messages, sessionRules.max_exchanges_per_chat]);

  // Setup idle timeout when chat starts
  useEffect(() => {
    if (chatId && sessionRules.idle_timeout_minutes) {
      resetIdleTimeout();
    }
    return () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [chatId, sessionRules.idle_timeout_minutes, resetIdleTimeout]);

  // Redirect if no participant
  useEffect(() => {
    if (typeof window !== 'undefined' && !participantId) {
      router.push(`/${locale}`);
    }
  }, [participantId, router, locale]);

  const startChat = async (topicId: string) => {
    if (!participantId) return;

    setIsLoading(true);
    setSelectedTopic(topicId);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: participantId,
          topic_category: topicId,
          language: locale,
        }),
      });

      if (!response.ok) throw new Error('Failed to create chat');

      const data = await response.json();
      setChatId(data.id);

      // Get welcome message from topic data (dynamic) or fall back to translation file
      const topic = topics.find(t => t.id === topicId);
      let welcomeMessage: string | undefined;

      if (topic) {
        welcomeMessage = locale === 'fi' ? topic.welcome_message_fi : topic.welcome_message_en;
      }

      // Fall back to translation file if no welcome message in topic data
      if (!welcomeMessage) {
        welcomeMessage = t(`topics.welcomeMessages.${topicId}`);
      }

      if (welcomeMessage) {
        setMessages([
          {
            id: 'welcome-message',
            role: 'assistant',
            content: welcomeMessage,
          },
        ]);
      }

      // Reset idle timeout when chat starts
      resetIdleTimeout();
    } catch (error) {
      console.error('Error:', error);
      alert(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!chatId || !inputValue.trim() || isSending || maxExchangesReached) return;

    // Reset idle timeout on user activity
    resetIdleTimeout();

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    // Add user message immediately
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chats/${chatId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: userMessage }),
        }
      );

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();

      // Replace temp message and add assistant response
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMessage.id),
        { id: `user-${Date.now()}`, role: 'user', content: userMessage },
        { id: data.id, role: 'assistant', content: data.content },
      ]);

      // Reset idle timeout after receiving response
      resetIdleTimeout();
    } catch (error) {
      console.error('Error:', error);
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
      setInputValue(userMessage);
      alert(t('common.error'));
    } finally {
      setIsSending(false);
    }
  };

  // Check if minimum exchanges reached using dynamic session rules
  // Count user messages as exchanges (each user message = 1 exchange)
  const userMessageCount = messages.filter(m => m.role === 'user').length;
  const canEndChat = userMessageCount >= sessionRules.min_exchanges_before_survey;

  const endChat = () => {
    if (!canEndChat) return;
    // Clear idle timeout when ending chat
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    router.push(`/${locale}/survey?chatId=${chatId}`);
  };

  // Topic selection view
  if (!selectedTopic) {
    return (
      <div
        className="min-h-screen py-8"
        style={{ backgroundColor: currentTheme.colors.background }}
      >
        <div className="max-w-2xl mx-auto px-4">
          <h1
            className="text-2xl font-bold text-center mb-2"
            style={{ color: currentTheme.colors.foreground }}
          >
            {t('topics.title')}
          </h1>
          <p
            className="text-center mb-4"
            style={{ color: currentTheme.colors.foreground, opacity: 0.8 }}
          >
            {t('topics.subtitle')}
          </p>
          <p
            className="text-center text-sm mb-8 py-2 px-4 rounded-lg"
            style={{
              backgroundColor: currentTheme.colors.headerBg,
              color: currentTheme.colors.headerText,
              opacity: 0.9,
            }}
          >
            {t('topics.minExchangesNote')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => startChat(topic.id)}
                disabled={isLoading}
                className="relative p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow text-left"
                style={{
                  backgroundColor: currentTheme.colors.botMessageBg,
                  color: currentTheme.colors.botMessageText,
                  borderWidth: '1px',
                  borderColor: currentTheme.colors.inputBorder,
                }}
              >
                <span className="font-medium">
                  {locale === 'fi' ? topic.label_fi : topic.label_en}
                </span>
                {topic.warning && (
                  <span className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                    {t('topics.sparseWarning')}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Get the selected topic object for displaying its label
  const currentTopic = topics.find((t) => t.id === selectedTopic);
  const topicLabel = currentTopic
    ? locale === 'fi'
      ? currentTopic.label_fi
      : currentTopic.label_en
    : '';

  // Chat view
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: currentTheme.colors.background }}
    >
      {/* Sticky Header */}
      <header
        className="shadow-sm px-4 py-3 sticky top-0 z-20"
        style={{
          backgroundColor: currentTheme.colors.headerBg,
          color: currentTheme.colors.headerText,
        }}
      >
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold">{t('chat.title')}</h1>
            {topicLabel && (
              <>
                <span style={{ opacity: 0.5 }}>|</span>
                <span style={{ opacity: 0.8 }}>{topicLabel}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ThemeSelector />
            <div className="relative group">
              <button
                onClick={endChat}
                disabled={!canEndChat}
                className="px-4 py-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: canEndChat
                    ? currentTheme.colors.primaryButton
                    : '#9ca3af',
                  color: canEndChat ? '#ffffff' : '#6b7280',
                  cursor: canEndChat ? 'pointer' : 'not-allowed',
                }}
              >
                {t('chat.endChat')}
              </button>
              {!canEndChat && (
                <span className="absolute top-full right-0 mt-2 px-3 py-1 text-xs text-white bg-gray-800 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {t('chat.minMessagesTooltip')}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[80%] px-4 py-3 rounded-lg"
                style={
                  message.role === 'user'
                    ? {
                        backgroundColor: currentTheme.colors.userMessageBg,
                        color: currentTheme.colors.userMessageText,
                      }
                    : {
                        backgroundColor: currentTheme.colors.botMessageBg,
                        color: currentTheme.colors.botMessageText,
                        borderWidth: '1px',
                        borderColor: currentTheme.colors.botMessageBorder,
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                      }
                }
              >
                {message.content}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div
                className="px-4 py-3 rounded-lg"
                style={{
                  backgroundColor: currentTheme.colors.botMessageBg,
                  color: currentTheme.colors.botMessageText,
                  borderWidth: '1px',
                  borderColor: currentTheme.colors.botMessageBorder,
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                  opacity: 0.7,
                }}
              >
                {t('common.loading')}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div
        className="border-t px-4 py-4"
        style={{
          backgroundColor: currentTheme.colors.botMessageBg,
          borderColor: currentTheme.colors.inputBorder,
        }}
      >
        <div className="max-w-2xl mx-auto">
          {maxExchangesReached ? (
            <div className="text-center py-2">
              <p
                className="mb-3"
                style={{ color: currentTheme.colors.foreground, opacity: 0.8 }}
              >
                {t('chat.maxExchangesReached') || 'Maximum number of exchanges reached. Please end the discussion to proceed.'}
              </p>
              <button
                onClick={endChat}
                className="px-6 py-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: currentTheme.colors.primaryButton,
                  color: '#ffffff',
                }}
              >
                {t('chat.endChat')}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  resetIdleTimeout(); // Reset on typing
                }}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={t('chat.placeholder')}
                className="flex-1 px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  borderWidth: '1px',
                  borderColor: currentTheme.colors.inputBorder,
                  backgroundColor: currentTheme.colors.background,
                  color: currentTheme.colors.foreground,
                }}
                disabled={isSending}
              />
              <button
                onClick={sendMessage}
                disabled={isSending || !inputValue.trim()}
                className="px-6 py-2 rounded-lg transition-colors"
                style={{
                  backgroundColor:
                    isSending || !inputValue.trim()
                      ? '#9ca3af'
                      : currentTheme.colors.primaryButton,
                  color: isSending || !inputValue.trim() ? '#6b7280' : '#ffffff',
                  cursor: isSending || !inputValue.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {t('chat.send')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
