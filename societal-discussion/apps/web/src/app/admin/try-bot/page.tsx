'use client';

import { useState, useEffect, useRef } from 'react';
import { PARTIES, PARTY_DISPLAY_NAMES, PARTY_COLORS } from '../lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function TryBotPage() {
  const [password, setPassword] = useState('');
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const [language, setLanguage] = useState<'fi' | 'en'>('fi');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPassword(sessionStorage.getItem('adminPassword') || '');
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startConversation = async (party: string) => {
    setIsStarting(true);
    setSelectedParty(party);
    setMessages([]);

    try {
      // Create a test session if we don't have one
      let sid = sessionId;
      if (!sid) {
        const res = await fetch(`${API_URL}/api/sessions`, { method: 'POST' });
        const data = await res.json();
        sid = data.id;
        setSessionId(sid);
      }

      // Create conversation with party override via admin endpoint
      const res = await fetch(`${API_URL}/api/admin/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({
          session_id: sid,
          assigned_party: party,
          language,
        }),
      });

      if (!res.ok) throw new Error('Failed to create conversation');
      const data = await res.json();
      setConversationId(data.id);
    } catch (err) {
      console.error('Error starting conversation:', err);
      setSelectedParty(null);
    } finally {
      setIsStarting(false);
    }
  };

  const sendMessage = async () => {
    if (!conversationId || !inputValue.trim() || isSending) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    const tempMsg: Message = { id: `temp-${Date.now()}`, role: 'user', content: userMessage };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const response = await fetch(
        `${API_URL}/api/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: userMessage }),
        },
      );
      if (!response.ok) throw new Error('Failed to send message');
      const data = await response.json();
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempMsg.id),
        { id: `user-${Date.now()}`, role: 'user', content: userMessage },
        { id: data.id, role: 'assistant', content: data.content },
      ]);
    } catch (err) {
      console.error('Error:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      setInputValue(userMessage);
    } finally {
      setIsSending(false);
    }
  };

  // When the researcher leaves a try-bot run without saving, we DELETE the
  // conversation so the DB doesn't accumulate ephemeral test runs. If the
  // run has been saved (saveStatus === 'saved'), we leave it alone.
  const discardIfUnsaved = async () => {
    if (!conversationId || saveStatus === 'saved') return;
    try {
      await fetch(
        `${API_URL}/api/admin/conversations/${encodeURIComponent(conversationId)}`,
        {
          method: 'DELETE',
          headers: { 'X-Admin-Password': password },
        },
      );
    } catch (err) {
      console.warn('Failed to discard test conversation:', err);
    }
  };

  const resetConversation = async () => {
    await discardIfUnsaved();
    setSelectedParty(null);
    setConversationId(null);
    setMessages([]);
    setInputValue('');
    setSaveStatus('idle');
  };

  const saveConversation = async () => {
    if (!conversationId || saveStatus === 'saving' || saveStatus === 'saved') return;
    setSaveStatus('saving');
    try {
      const res = await fetch(
        `${API_URL}/api/admin/conversations/${encodeURIComponent(conversationId)}/save-test`,
        {
          method: 'POST',
          headers: { 'X-Admin-Password': password },
        },
      );
      if (!res.ok) throw new Error(`${res.status}`);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save test conversation:', err);
      setSaveStatus('error');
    }
  };

  // Party selector view
  if (!selectedParty || !conversationId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Try Bot</h1>
          <p className="text-sm text-slate-500 mt-1">
            Test the chatbot by selecting a party. The conversation is flagged as a test and excluded from stats.
          </p>
        </div>

        {/* Language toggle */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">Response language:</span>
            <div className="flex gap-1">
              {(['fi', 'en'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    language === l
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {l === 'fi' ? 'Finnish (Suomeksi)' : 'English'}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400">
              The bot reads the Finnish party corpus regardless; only the reply language changes.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PARTIES.map((party) => (
            <button
              key={party}
              onClick={() => startConversation(party)}
              disabled={isStarting}
              className="text-left bg-white rounded-xl border-2 border-slate-200 shadow-sm p-6 hover:border-slate-400 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: PARTY_COLORS[party] || '#6B7280' }}
                >
                  {PARTY_DISPLAY_NAMES[party]}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Start a test conversation with the {PARTY_DISPLAY_NAMES[party]} bot
              </p>
            </button>
          ))}
        </div>

        {isStarting && (
          <p className="text-sm text-slate-400 animate-pulse text-center">Starting...</p>
        )}
      </div>
    );
  }

  // Chat view
  const partyColor = PARTY_COLORS[selectedParty] || '#6B7280';

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 gap-2 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl font-semibold text-slate-900">Try Bot</h1>
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: partyColor }}
          >
            {PARTY_DISPLAY_NAMES[selectedParty]}
          </span>
          <span className="text-xs text-slate-500 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 uppercase tracking-wide">
            {language}
          </span>
          {saveStatus === 'saved' ? (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              Saved test
            </span>
          ) : (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              Unsaved · will be discarded
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && saveStatus !== 'saved' && (
            <button
              onClick={saveConversation}
              disabled={saveStatus === 'saving'}
              className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {saveStatus === 'saving' ? 'Saving…' : 'Save this conversation'}
            </button>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-600">Save failed</span>
          )}
          <button
            onClick={resetConversation}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Change party
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 && !isSending && (
          <div className="text-center text-slate-400 py-12">
            <p className="text-lg mb-1">Test the {PARTY_DISPLAY_NAMES[selectedParty]} bot</p>
            <p className="text-sm">Type a message below.</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                message.role === 'user'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-800 border border-slate-200 shadow-sm'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: partyColor }}
                  />
                  <span className="text-xs font-medium text-slate-400">
                    {PARTY_DISPLAY_NAMES[selectedParty]}
                  </span>
                </div>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
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

      {/* Input */}
      <div className="pt-4 border-t border-slate-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            disabled={isSending}
          />
          <button
            onClick={sendMessage}
            disabled={isSending || !inputValue.trim()}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
