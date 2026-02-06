'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Topic {
  id: string;
  label_en: string;
  label_fi: string;
  warning?: boolean;
}

export default function ChatPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get participant ID from localStorage
  const participantId = typeof window !== 'undefined' ? localStorage.getItem('participantId') : null;

  // Fetch topics on mount
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/topics`)
      .then((res) => res.json())
      .then((data) => setTopics(data.topics))
      .catch(console.error);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    } catch (error) {
      console.error('Error:', error);
      alert(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!chatId || !inputValue.trim() || isSending) return;

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

  const endChat = () => {
    if (messages.length < 6) {
      // At least 3 exchanges (6 messages)
      alert(t('chat.minMessages'));
      return;
    }
    router.push(`/${locale}/survey?chatId=${chatId}`);
  };

  // Topic selection view
  if (!selectedTopic) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8">
        <div className="max-w-2xl mx-auto px-4">
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
            {t('topics.title')}
          </h1>
          <p className="text-center text-gray-600 mb-8">{t('topics.subtitle')}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => startChat(topic.id)}
                disabled={isLoading}
                className="relative p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow text-left"
              >
                <span className="font-medium text-gray-900">
                  {locale === 'fi' ? topic.label_fi : topic.label_en}
                </span>
                {topic.warning && (
                  <span className="absolute top-2 right-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
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

  // Chat view
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="font-semibold text-gray-900">{t('chat.title')}</h1>
          <button
            onClick={endChat}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {t('chat.endChat')}
          </button>
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
                className={`max-w-[80%] px-4 py-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-900 shadow-md'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-500 px-4 py-3 rounded-lg shadow-md">
                {t('common.loading')}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={t('chat.placeholder')}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={isSending}
          />
          <button
            onClick={sendMessage}
            disabled={isSending || !inputValue.trim()}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 transition-colors"
          >
            {t('chat.send')}
          </button>
        </div>
      </div>
    </div>
  );
}
