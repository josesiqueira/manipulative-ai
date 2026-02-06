'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface Stats {
  total_participants: number;
  total_chats: number;
  completed_chats: number;
  total_messages: number;
  chats_by_block: Record<string, number>;
  chats_by_topic: Record<string, number>;
  correct_guesses: number;
  incorrect_guesses: number;
  avg_persuasiveness: number | null;
  avg_naturalness: number | null;
}

interface CoverageCell {
  count: number;
  is_sparse: boolean;
}

interface Coverage {
  matrix: Record<string, Record<string, CoverageCell>>;
  total_statements: number;
  sparse_combinations: string[];
}

const TOPICS = [
  'immigration', 'healthcare', 'economy', 'education',
  'foreign_policy', 'environment', 'technology', 'equality', 'social_welfare'
];

const BLOCKS = ['conservative', 'red-green', 'moderate', 'dissatisfied'];

export default function AdminPage() {
  const params = useParams();
  const locale = params.locale as string;

  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'stats' | 'coverage' | 'test'>('stats');

  // Test chat state
  const [testParticipantId, setTestParticipantId] = useState('');
  const [testTopic, setTestTopic] = useState('immigration');
  const [testBlock, setTestBlock] = useState('conservative');
  const [testChatId, setTestChatId] = useState('');
  const [testMessages, setTestMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [testInput, setTestInput] = useState('');
  const [isTestLoading, setIsTestLoading] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const authenticate = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/stats`, {
        headers: { 'X-Admin-Password': password },
      });

      if (response.ok) {
        setIsAuthenticated(true);
        setError('');
        const data = await response.json();
        setStats(data);
      } else {
        setError('Invalid password');
      }
    } catch {
      setError('Failed to connect to API');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/stats`, {
        headers: { 'X-Admin-Password': password },
      });
      if (response.ok) {
        setStats(await response.json());
      }
    } catch {
      console.error('Failed to fetch stats');
    }
  };

  const fetchCoverage = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/coverage`, {
        headers: { 'X-Admin-Password': password },
      });
      if (response.ok) {
        setCoverage(await response.json());
      }
    } catch {
      console.error('Failed to fetch coverage');
    }
  }, [apiUrl, password]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'coverage' && !coverage) {
      fetchCoverage();
    }
  }, [isAuthenticated, activeTab, coverage, fetchCoverage]);

  // Create test participant
  const createTestParticipant = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: locale,
          consent_given: true,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setTestParticipantId(data.id);
      }
    } catch {
      console.error('Failed to create test participant');
    }
  };

  // Start test chat with specific block
  const startTestChat = async () => {
    if (!testParticipantId) {
      await createTestParticipant();
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/admin/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({
          participant_id: testParticipantId,
          topic_category: testTopic,
          political_block: testBlock,
          language: locale,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setTestChatId(data.id);
        setTestMessages([]);
      }
    } catch {
      console.error('Failed to create test chat');
    }
  };

  // Send test message
  const sendTestMessage = async () => {
    if (!testChatId || !testInput.trim()) return;

    setIsTestLoading(true);
    const userMsg = testInput.trim();
    setTestInput('');
    setTestMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    try {
      const response = await fetch(`${apiUrl}/api/chats/${testChatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userMsg }),
      });
      if (response.ok) {
        const data = await response.json();
        setTestMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      }
    } catch {
      console.error('Failed to send message');
    } finally {
      setIsTestLoading(false);
    }
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h1 className="text-2xl font-bold mb-6 text-center">Admin Access</h1>
          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && authenticate()}
            placeholder="Admin password"
            className="w-full px-4 py-2 border rounded mb-4"
          />
          <button
            onClick={authenticate}
            className="w-full bg-primary-600 text-white py-2 rounded hover:bg-primary-700"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Research Admin Panel</h1>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="text-gray-600 hover:text-gray-900"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2 mb-6">
          {(['stats', 'coverage', 'test'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium ${
                activeTab === tab
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab === 'stats' && 'Statistics'}
              {tab === 'coverage' && 'Coverage Matrix'}
              {tab === 'test' && 'Test Chat'}
            </button>
          ))}
        </div>

        {/* Stats Tab */}
        {activeTab === 'stats' && stats && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-3xl font-bold text-primary-600">{stats.total_participants}</div>
                <div className="text-gray-600">Participants</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-3xl font-bold text-primary-600">{stats.total_chats}</div>
                <div className="text-gray-600">Total Chats</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-3xl font-bold text-green-600">{stats.completed_chats}</div>
                <div className="text-gray-600">Completed</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-3xl font-bold text-gray-600">{stats.total_messages}</div>
                <div className="text-gray-600">Messages</div>
              </div>
            </div>

            {/* Detection Accuracy */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Detection Accuracy</h2>
              <div className="flex gap-8">
                <div>
                  <span className="text-2xl font-bold text-green-600">{stats.correct_guesses}</span>
                  <span className="text-gray-600 ml-2">Correct Guesses</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-red-600">{stats.incorrect_guesses}</span>
                  <span className="text-gray-600 ml-2">Incorrect Guesses</span>
                </div>
                {stats.completed_chats > 0 && (
                  <div>
                    <span className="text-2xl font-bold text-primary-600">
                      {((stats.correct_guesses / stats.completed_chats) * 100).toFixed(1)}%
                    </span>
                    <span className="text-gray-600 ml-2">Accuracy Rate</span>
                  </div>
                )}
              </div>
            </div>

            {/* Average Ratings */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Average Ratings</h2>
              <div className="flex gap-8">
                <div>
                  <span className="text-2xl font-bold text-primary-600">
                    {stats.avg_persuasiveness?.toFixed(2) || 'N/A'}
                  </span>
                  <span className="text-gray-600 ml-2">Persuasiveness (1-5)</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-primary-600">
                    {stats.avg_naturalness?.toFixed(2) || 'N/A'}
                  </span>
                  <span className="text-gray-600 ml-2">Naturalness (1-5)</span>
                </div>
              </div>
            </div>

            {/* Chats by Block */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Chats by Political Block</h2>
                <div className="space-y-2">
                  {BLOCKS.map((block) => (
                    <div key={block} className="flex justify-between items-center">
                      <span className="capitalize">{block}</span>
                      <span className="font-semibold">{stats.chats_by_block[block] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Chats by Topic</h2>
                <div className="space-y-2">
                  {TOPICS.map((topic) => (
                    <div key={topic} className="flex justify-between items-center">
                      <span className="capitalize">{topic.replace('_', ' ')}</span>
                      <span className="font-semibold">{stats.chats_by_topic[topic] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={fetchStats}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Refresh Stats
            </button>
          </div>
        )}

        {/* Coverage Tab */}
        {activeTab === 'coverage' && coverage && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">
                Dataset Coverage ({coverage.total_statements} statements)
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left">Topic</th>
                      {BLOCKS.map((block) => (
                        <th key={block} className="px-4 py-2 text-center capitalize">{block}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TOPICS.map((topic) => (
                      <tr key={topic} className="border-t">
                        <td className="px-4 py-2 capitalize">{topic.replace('_', ' ')}</td>
                        {BLOCKS.map((block) => {
                          const cell = coverage.matrix[topic]?.[block];
                          return (
                            <td
                              key={block}
                              className={`px-4 py-2 text-center ${
                                cell?.is_sparse ? 'bg-yellow-100 text-yellow-800' : ''
                              }`}
                            >
                              {cell?.count || 0}
                              {cell?.is_sparse && ' ⚠️'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {coverage.sparse_combinations.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <h3 className="font-semibold text-yellow-800 mb-2">Sparse Combinations (&lt;3 examples)</h3>
                <ul className="list-disc list-inside text-yellow-700">
                  {coverage.sparse_combinations.map((combo, i) => (
                    <li key={i}>{combo}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Test Chat Tab */}
        {activeTab === 'test' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Test Chat with Specific Block</h2>

            {!testChatId ? (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Political Block
                    </label>
                    <select
                      value={testBlock}
                      onChange={(e) => setTestBlock(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                    >
                      {BLOCKS.map((block) => (
                        <option key={block} value={block} className="capitalize">
                          {block}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Topic
                    </label>
                    <select
                      value={testTopic}
                      onChange={(e) => setTestTopic(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                    >
                      {TOPICS.map((topic) => (
                        <option key={topic} value={topic}>
                          {topic.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={startTestChat}
                  className="px-6 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  {testParticipantId ? 'Start Test Chat' : 'Create Test Participant & Start'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-100 p-3 rounded text-sm">
                  <strong>Block:</strong> {testBlock} | <strong>Topic:</strong> {testTopic}
                </div>

                <div className="h-96 overflow-y-auto border rounded p-4 space-y-3">
                  {testMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-primary-600 text-white ml-12'
                          : 'bg-gray-200 mr-12'
                      }`}
                    >
                      {msg.content}
                    </div>
                  ))}
                  {isTestLoading && (
                    <div className="bg-gray-200 p-3 rounded-lg mr-12 animate-pulse">
                      Typing...
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendTestMessage()}
                    placeholder="Type a message..."
                    className="flex-1 border rounded px-3 py-2"
                    disabled={isTestLoading}
                  />
                  <button
                    onClick={sendTestMessage}
                    disabled={isTestLoading}
                    className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-gray-400"
                  >
                    Send
                  </button>
                </div>

                <button
                  onClick={() => {
                    setTestChatId('');
                    setTestMessages([]);
                  }}
                  className="text-gray-600 hover:text-gray-900"
                >
                  End Test & Start New
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
