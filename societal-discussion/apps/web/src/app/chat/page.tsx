'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TRANSLATIONS, getStoredLanguage } from '@/lib/translations';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [t, setT] = useState(TRANSLATIONS.fi);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setT(TRANSLATIONS[getStoredLanguage()]);

    const convId = localStorage.getItem('conversationId');
    const sessionId = localStorage.getItem('sessionId');
    if (!convId || !sessionId) {
      router.push('/');
      return;
    }
    setConversationId(convId);

    const starterTopic = localStorage.getItem('starterTopic');
    if (starterTopic) {
      localStorage.removeItem('starterTopic');
      sendFirstMessage(convId, starterTopic);
    }
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendFirstMessage = async (convId: string, content: string) => {
    setIsSending(true);
    const tempMsg: Message = { id: `temp-${Date.now()}`, role: 'user', content };
    setMessages([tempMsg]);

    try {
      const response = await fetch(`${API_URL}/api/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      const data = await response.json();
      setMessages([
        { id: `user-${Date.now()}`, role: 'user', content },
        { id: data.id, role: 'assistant', content: data.content },
      ]);
    } catch (err) {
      console.error('Error:', err);
      setError(t.chat.sendError);
      setMessages([]);
    } finally {
      setIsSending(false);
    }
  };

  const sendMessage = async () => {
    if (!conversationId || !inputValue.trim() || isSending) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsSending(true);
    setError(null);

    const tempMsg: Message = { id: `temp-${Date.now()}`, role: 'user', content: userMessage };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const response = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userMessage }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      const data = await response.json();
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempMsg.id),
        { id: `user-${Date.now()}`, role: 'user', content: userMessage },
        { id: data.id, role: 'assistant', content: data.content },
      ]);
    } catch (err) {
      console.error('Error:', err);
      setError(t.chat.sendError);
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      setInputValue(userMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleBackToStart = () => {
    if (conversationId) {
      fetch(`${API_URL}/api/conversations/${conversationId}/end`, { method: 'PUT' }).catch(
        console.error,
      );
    }
    localStorage.removeItem('conversationId');
    localStorage.removeItem('starterTopic');
    router.push('/');
  };

  const handleEndConversation = () => {
    if (conversationId) {
      fetch(`${API_URL}/api/conversations/${conversationId}/end`, { method: 'PUT' }).catch(
        console.error,
      );
    }
    router.push('/survey-entry');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 sticky top-0 z-20 border-b border-slate-200">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="font-semibold text-slate-900">{t.chat.header}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackToStart}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {t.chat.backToStart}
            </button>
            <button
              onClick={handleEndConversation}
              className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              {t.chat.endConversation}
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && !isSending && (
            <div className="text-center text-slate-400 py-12">
              <p className="text-lg mb-2">{t.chat.emptyTitle}</p>
              <p className="text-sm">{t.chat.emptyHint}</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-800 border border-slate-200 shadow-sm'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="bg-white text-slate-400 border border-slate-200 shadow-sm px-4 py-3 rounded-2xl">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-t border-red-200 px-4 py-2">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <span className="text-sm text-red-700">{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 text-sm font-medium">
              {t.chat.close}
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-slate-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={t.chat.placeholder}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            disabled={isSending}
          />
          <button
            onClick={sendMessage}
            disabled={isSending || !inputValue.trim()}
            className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.chat.send}
          </button>
        </div>
      </div>
    </div>
  );
}
