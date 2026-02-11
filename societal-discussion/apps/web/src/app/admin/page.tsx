'use client';

import { useState, useEffect, useCallback } from 'react';

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

interface PromptConfig {
  id: string;
  political_block: string;
  name_en: string;
  name_fi: string;
  description_en: string;
  description_fi: string;
  updated_at: string;
}

interface TermsConfig {
  id: string;
  title_en: string;
  title_fi: string;
  content_en: string;
  content_fi: string;
  updated_at: string;
}

interface LLMConfig {
  id: string;
  provider: string;
  display_name: string;
  api_key_preview: string | null;
  has_key: boolean;
  selected_model: string | null;
  is_active: boolean;
  updated_at: string;
}

interface ProviderInfo {
  provider: string;
  display_name: string;
  models: Array<{
    id: string;
    name: string;
    context_window?: number;
  }>;
}

interface ExperimentConfig {
  id: string;
  experiment_name_en: string;
  experiment_name_fi: string;
  start_date: string | null;
  end_date: string | null;
  ethics_board_name: string | null;
  ethics_reference_number: string | null;
  principal_investigator_name: string | null;
  principal_investigator_email: string | null;
  institution_name_en: string | null;
  institution_name_fi: string | null;
  min_exchanges_before_survey: number;
  max_exchanges_per_chat: number | null;
  idle_timeout_minutes: number | null;
  is_active: boolean;
  updated_at: string;
}

interface TopicConfig {
  id: string;
  topic_key: string;
  label_en: string;
  label_fi: string;
  welcome_message_en: string;
  welcome_message_fi: string;
  is_enabled: boolean;
  display_order: number;
  is_sparse: boolean;
  updated_at: string;
}

interface LogsExportInfo {
  file_count: number;
  total_size_bytes: number;
  total_size_formatted: string;
}

const TOPICS = [
  'immigration', 'healthcare', 'economy', 'education',
  'foreign_policy', 'environment', 'technology', 'equality', 'social_welfare'
];

const BLOCKS = ['conservative', 'red-green', 'moderate', 'dissatisfied'];

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [prompts, setPrompts] = useState<PromptConfig[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<PromptConfig | null>(null);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [terms, setTerms] = useState<TermsConfig | null>(null);
  const [editingTerms, setEditingTerms] = useState<TermsConfig | null>(null);
  const [isSavingTerms, setIsSavingTerms] = useState(false);
  const [llmConfigs, setLLMConfigs] = useState<LLMConfig[]>([]);
  const [providersData, setProvidersData] = useState<ProviderInfo[]>([]);
  const [editingApiKey, setEditingApiKey] = useState<{ provider: string; value: string } | null>(null);
  const [isSavingLLM, setIsSavingLLM] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'stats' | 'coverage' | 'test' | 'prompts' | 'terms' | 'llm' | 'experiment' | 'topics'>('stats');

  // Experiment config state
  const [experimentConfig, setExperimentConfig] = useState<ExperimentConfig | null>(null);
  const [editingExperiment, setEditingExperiment] = useState<ExperimentConfig | null>(null);
  const [isSavingExperiment, setIsSavingExperiment] = useState(false);

  // Topics config state
  const [topicsConfig, setTopicsConfig] = useState<TopicConfig[]>([]);
  const [editingTopic, setEditingTopic] = useState<TopicConfig | null>(null);
  const [isSavingTopic, setIsSavingTopic] = useState(false);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [newTopic, setNewTopic] = useState<Partial<TopicConfig>>({
    topic_key: '',
    label_en: '',
    label_fi: '',
    welcome_message_en: '',
    welcome_message_fi: '',
    is_enabled: true,
    display_order: 0,
  });

  // Logs export state
  const [logsInfo, setLogsInfo] = useState<LogsExportInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Test chat state
  const [testParticipantId, setTestParticipantId] = useState('');
  const [testTopic, setTestTopic] = useState('immigration');
  const [testBlock, setTestBlock] = useState('conservative');
  const [testLanguage, setTestLanguage] = useState('en');
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

  const fetchPrompts = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/prompts`, {
        headers: { 'X-Admin-Password': password },
      });
      if (response.ok) {
        setPrompts(await response.json());
      }
    } catch {
      console.error('Failed to fetch prompts');
    }
  }, [apiUrl, password]);

  const fetchTerms = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/terms`, {
        headers: { 'X-Admin-Password': password },
      });
      if (response.ok) {
        setTerms(await response.json());
      }
    } catch {
      console.error('Failed to fetch terms');
    }
  }, [apiUrl, password]);

  const savePrompt = async () => {
    if (!editingPrompt) return;
    setIsSavingPrompt(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/prompts/${editingPrompt.political_block}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({
          name_en: editingPrompt.name_en,
          name_fi: editingPrompt.name_fi,
          description_en: editingPrompt.description_en,
          description_fi: editingPrompt.description_fi,
        }),
      });
      if (response.ok) {
        const updated = await response.json();
        setPrompts(prev => prev.map(p => p.political_block === updated.political_block ? updated : p));
        setEditingPrompt(null);
      }
    } catch {
      console.error('Failed to save prompt');
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const saveTerms = async () => {
    if (!editingTerms) return;
    setIsSavingTerms(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/terms`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({
          title_en: editingTerms.title_en,
          title_fi: editingTerms.title_fi,
          content_en: editingTerms.content_en,
          content_fi: editingTerms.content_fi,
        }),
      });
      if (response.ok) {
        const updated = await response.json();
        setTerms(updated);
        setEditingTerms(null);
      }
    } catch {
      console.error('Failed to save terms');
    } finally {
      setIsSavingTerms(false);
    }
  };

  const fetchLLMConfigs = useCallback(async () => {
    try {
      const [configsResponse, providersResponse] = await Promise.all([
        fetch(`${apiUrl}/api/admin/llm/configs`, {
          headers: { 'X-Admin-Password': password },
        }),
        fetch(`${apiUrl}/api/admin/llm/providers`, {
          headers: { 'X-Admin-Password': password },
        }),
      ]);
      if (configsResponse.ok) {
        setLLMConfigs(await configsResponse.json());
      }
      if (providersResponse.ok) {
        setProvidersData(await providersResponse.json());
      }
    } catch {
      console.error('Failed to fetch LLM configs');
    }
  }, [apiUrl, password]);

  const saveApiKey = async (provider: string, apiKey: string) => {
    setIsSavingLLM(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/llm/configs/${provider}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({ api_key: apiKey }),
      });
      if (response.ok) {
        const updated = await response.json();
        setLLMConfigs(prev => {
          const existing = prev.find(c => c.provider === provider);
          if (existing) {
            return prev.map(c => c.provider === provider ? updated : c);
          }
          return [...prev, updated];
        });
        setEditingApiKey(null);
      }
    } catch {
      console.error('Failed to save API key');
    } finally {
      setIsSavingLLM(false);
    }
  };

  const deleteApiKey = async (provider: string) => {
    if (!confirm(`Are you sure you want to delete the API key for ${provider}?`)) {
      return;
    }
    setIsSavingLLM(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/llm/configs/${provider}/key`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': password },
      });
      if (response.ok) {
        setLLMConfigs(prev => prev.map(c =>
          c.provider === provider
            ? { ...c, has_key: false, api_key_preview: null, is_active: false }
            : c
        ));
      }
    } catch {
      console.error('Failed to delete API key');
    } finally {
      setIsSavingLLM(false);
    }
  };

  const updateModel = async (provider: string, selectedModel: string) => {
    setIsSavingLLM(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/llm/configs/${provider}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({ selected_model: selectedModel }),
      });
      if (response.ok) {
        const updated = await response.json();
        setLLMConfigs(prev => {
          const existing = prev.find(c => c.provider === provider);
          if (existing) {
            return prev.map(c => c.provider === provider ? updated : c);
          }
          return [...prev, updated];
        });
      }
    } catch {
      console.error('Failed to update model');
    } finally {
      setIsSavingLLM(false);
    }
  };

  const setActiveProvider = async (provider: string) => {
    setIsSavingLLM(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/llm/active`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({ provider }),
      });
      if (response.ok) {
        // Update all configs to reflect the new active state
        setLLMConfigs(prev => prev.map(c => ({
          ...c,
          is_active: c.provider === provider,
        })));
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to set active provider');
      }
    } catch {
      console.error('Failed to set active provider');
    } finally {
      setIsSavingLLM(false);
    }
  };

  // Experiment config functions
  const fetchExperimentConfig = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/experiment`, {
        headers: { 'X-Admin-Password': password },
      });
      if (response.ok) {
        setExperimentConfig(await response.json());
      }
    } catch {
      console.error('Failed to fetch experiment config');
    }
  }, [apiUrl, password]);

  const saveExperimentConfig = async () => {
    if (!editingExperiment) return;
    setIsSavingExperiment(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/experiment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify(editingExperiment),
      });
      if (response.ok) {
        const updated = await response.json();
        setExperimentConfig(updated);
        setEditingExperiment(null);
      } else {
        const err = await response.json();
        alert(err.detail || 'Failed to save experiment config');
      }
    } catch {
      console.error('Failed to save experiment config');
    } finally {
      setIsSavingExperiment(false);
    }
  };

  const toggleExperimentActive = async (isActive: boolean) => {
    if (!experimentConfig) return;
    setIsSavingExperiment(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/experiment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({ ...experimentConfig, is_active: isActive }),
      });
      if (response.ok) {
        const updated = await response.json();
        setExperimentConfig(updated);
      }
    } catch {
      console.error('Failed to toggle experiment active state');
    } finally {
      setIsSavingExperiment(false);
    }
  };

  // Topics config functions
  const fetchTopicsConfig = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/topics`, {
        headers: { 'X-Admin-Password': password },
      });
      if (response.ok) {
        setTopicsConfig(await response.json());
      }
    } catch {
      console.error('Failed to fetch topics config');
    }
  }, [apiUrl, password]);

  const saveTopic = async () => {
    if (!editingTopic) return;
    setIsSavingTopic(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/topics/${editingTopic.topic_key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify(editingTopic),
      });
      if (response.ok) {
        const updated = await response.json();
        setTopicsConfig(prev => prev.map(t => t.id === updated.id ? updated : t));
        setEditingTopic(null);
      } else {
        const err = await response.json();
        alert(err.detail || 'Failed to save topic');
      }
    } catch {
      console.error('Failed to save topic');
    } finally {
      setIsSavingTopic(false);
    }
  };

  const createTopic = async () => {
    if (!newTopic.topic_key || !newTopic.label_en) return;
    setIsSavingTopic(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/topics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify(newTopic),
      });
      if (response.ok) {
        const created = await response.json();
        setTopicsConfig(prev => [...prev, created]);
        setShowAddTopic(false);
        setNewTopic({
          topic_key: '',
          label_en: '',
          label_fi: '',
          welcome_message_en: '',
          welcome_message_fi: '',
          is_enabled: true,
          display_order: 0,
        });
      } else {
        const err = await response.json();
        alert(err.detail || 'Failed to create topic');
      }
    } catch {
      console.error('Failed to create topic');
    } finally {
      setIsSavingTopic(false);
    }
  };

  const deleteTopic = async (topicKey: string) => {
    if (!confirm('Are you sure you want to delete this topic?')) return;
    setIsSavingTopic(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/topics/${topicKey}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': password },
      });
      if (response.ok) {
        setTopicsConfig(prev => prev.filter(t => t.topic_key !== topicKey));
      } else {
        const err = await response.json();
        alert(err.detail || 'Failed to delete topic');
      }
    } catch {
      console.error('Failed to delete topic');
    } finally {
      setIsSavingTopic(false);
    }
  };

  const toggleTopicEnabled = async (topic: TopicConfig) => {
    setIsSavingTopic(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/topics/${topic.topic_key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({ ...topic, is_enabled: !topic.is_enabled }),
      });
      if (response.ok) {
        const updated = await response.json();
        setTopicsConfig(prev => prev.map(t => t.id === updated.id ? updated : t));
      }
    } catch {
      console.error('Failed to toggle topic');
    } finally {
      setIsSavingTopic(false);
    }
  };

  // Logs export functions
  const fetchLogsInfo = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/export/logs-info`, {
        headers: { 'X-Admin-Password': password },
      });
      if (response.ok) {
        setLogsInfo(await response.json());
      }
    } catch {
      console.error('Failed to fetch logs info');
    }
  }, [apiUrl, password]);

  const downloadLogsZip = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`${apiUrl}/api/admin/export/logs-zip`, {
        headers: { 'X-Admin-Password': password },
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.detail || 'Download failed');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation_logs_${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch {
      console.error('Failed to download logs');
      alert('Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && activeTab === 'coverage' && !coverage) {
      fetchCoverage();
    }
  }, [isAuthenticated, activeTab, coverage, fetchCoverage]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'prompts' && prompts.length === 0) {
      fetchPrompts();
    }
  }, [isAuthenticated, activeTab, prompts.length, fetchPrompts]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'terms' && !terms) {
      fetchTerms();
    }
  }, [isAuthenticated, activeTab, terms, fetchTerms]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'llm' && providersData.length === 0) {
      fetchLLMConfigs();
    }
  }, [isAuthenticated, activeTab, providersData.length, fetchLLMConfigs]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'experiment' && !experimentConfig) {
      fetchExperimentConfig();
    }
  }, [isAuthenticated, activeTab, experimentConfig, fetchExperimentConfig]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'topics' && topicsConfig.length === 0) {
      fetchTopicsConfig();
    }
  }, [isAuthenticated, activeTab, topicsConfig.length, fetchTopicsConfig]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'stats' && !logsInfo) {
      fetchLogsInfo();
    }
  }, [isAuthenticated, activeTab, logsInfo, fetchLogsInfo]);

  // Create test participant
  const createTestParticipant = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: testLanguage,
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
          language: testLanguage,
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
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['stats', 'coverage', 'experiment', 'topics', 'prompts', 'terms', 'llm', 'test'] as const).map((tab) => (
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
              {tab === 'experiment' && 'Experiment'}
              {tab === 'topics' && 'Topics'}
              {tab === 'prompts' && 'Bot Prompts'}
              {tab === 'terms' && 'Terms & Consent'}
              {tab === 'llm' && 'LLM Settings'}
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

            {/* Export Section */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Export Conversation Logs</h2>
              <p className="text-gray-600 mb-4">
                Download all conversation log files as a ZIP archive.
              </p>
              {logsInfo ? (
                logsInfo.file_count > 0 ? (
                  <div className="space-y-4">
                    <div className="flex gap-8">
                      <div>
                        <span className="text-2xl font-bold text-primary-600">{logsInfo.file_count}</span>
                        <span className="text-gray-600 ml-2">files</span>
                      </div>
                      <div>
                        <span className="text-2xl font-bold text-primary-600">{logsInfo.total_size_formatted}</span>
                        <span className="text-gray-600 ml-2">Total size</span>
                      </div>
                    </div>
                    <button
                      onClick={downloadLogsZip}
                      disabled={isDownloading}
                      className="px-6 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-gray-400"
                    >
                      {isDownloading ? 'Downloading...' : 'Download ZIP'}
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-500">No conversation logs available yet.</p>
                )
              ) : (
                <p className="text-gray-500">Loading...</p>
              )}
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

        {/* Experiment Settings Tab */}
        {activeTab === 'experiment' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Experiment Settings</h2>
              <p className="text-gray-600 mb-6">
                Configure experiment metadata, dates, ethics information, and session rules.
              </p>

              {experimentConfig ? (
                editingExperiment ? (
                  <div className="space-y-6">
                    {/* Active Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h3 className="font-medium">Experiment Active</h3>
                        <p className="text-sm text-gray-600">
                          When disabled, participants will see a maintenance message
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingExperiment.is_active}
                          onChange={(e) => setEditingExperiment({ ...editingExperiment, is_active: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>

                    {!editingExperiment.is_active && (
                      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                        <p className="text-yellow-800 font-medium">Warning: Experiment is currently disabled</p>
                        <p className="text-yellow-700 text-sm">Participants will see a maintenance message and cannot participate.</p>
                      </div>
                    )}

                    {/* Experiment Names */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-4">Experiment Name</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Name (English)</label>
                          <input
                            type="text"
                            value={editingExperiment.experiment_name_en}
                            onChange={(e) => setEditingExperiment({ ...editingExperiment, experiment_name_en: e.target.value })}
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Name (Finnish)</label>
                          <input
                            type="text"
                            value={editingExperiment.experiment_name_fi}
                            onChange={(e) => setEditingExperiment({ ...editingExperiment, experiment_name_fi: e.target.value })}
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Date Range */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-4">Experiment Dates</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                          <input
                            type="date"
                            value={editingExperiment.start_date || ''}
                            onChange={(e) => setEditingExperiment({ ...editingExperiment, start_date: e.target.value || null })}
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                          <input
                            type="date"
                            value={editingExperiment.end_date || ''}
                            onChange={(e) => setEditingExperiment({ ...editingExperiment, end_date: e.target.value || null })}
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Ethics Info */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-4">Ethics Information</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Ethics Board Name</label>
                          <input
                            type="text"
                            value={editingExperiment.ethics_board_name || ''}
                            onChange={(e) => setEditingExperiment({ ...editingExperiment, ethics_board_name: e.target.value || null })}
                            placeholder="e.g., Tampere University Ethics Committee"
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Ethics Reference Number</label>
                          <input
                            type="text"
                            value={editingExperiment.ethics_reference_number || ''}
                            onChange={(e) => setEditingExperiment({ ...editingExperiment, ethics_reference_number: e.target.value || null })}
                            placeholder="e.g., REF-2024-001"
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Principal Investigator */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-4">Principal Investigator</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                          <input
                            type="text"
                            value={editingExperiment.principal_investigator_name || ''}
                            onChange={(e) => setEditingExperiment({ ...editingExperiment, principal_investigator_name: e.target.value || null })}
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <input
                            type="email"
                            value={editingExperiment.principal_investigator_email || ''}
                            onChange={(e) => setEditingExperiment({ ...editingExperiment, principal_investigator_email: e.target.value || null })}
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Institution Names */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-4">Institution</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Institution Name (English)</label>
                          <input
                            type="text"
                            value={editingExperiment.institution_name_en || ''}
                            onChange={(e) => setEditingExperiment({ ...editingExperiment, institution_name_en: e.target.value || null })}
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Institution Name (Finnish)</label>
                          <input
                            type="text"
                            value={editingExperiment.institution_name_fi || ''}
                            onChange={(e) => setEditingExperiment({ ...editingExperiment, institution_name_fi: e.target.value || null })}
                            className="w-full border rounded px-3 py-2"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Session Rules */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-4">Session Rules</h3>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Min Exchanges Before Survey
                            <span className="text-gray-500 ml-1">(1-20)</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={editingExperiment.min_exchanges_before_survey}
                            onChange={(e) => setEditingExperiment({ ...editingExperiment, min_exchanges_before_survey: Math.min(20, Math.max(1, parseInt(e.target.value) || 1)) })}
                            className="w-full border rounded px-3 py-2"
                          />
                          <p className="text-xs text-gray-500 mt-1">Minimum exchanges required before survey</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Max Exchanges Per Chat
                            <span className="text-gray-500 ml-1">(optional)</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={editingExperiment.max_exchanges_per_chat || ''}
                            onChange={(e) => setEditingExperiment({ ...editingExperiment, max_exchanges_per_chat: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="No limit"
                            className="w-full border rounded px-3 py-2"
                          />
                          <p className="text-xs text-gray-500 mt-1">Leave empty for no limit</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Idle Timeout (minutes)
                            <span className="text-gray-500 ml-1">(optional)</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={editingExperiment.idle_timeout_minutes || ''}
                            onChange={(e) => setEditingExperiment({ ...editingExperiment, idle_timeout_minutes: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="No timeout"
                            className="w-full border rounded px-3 py-2"
                          />
                          <p className="text-xs text-gray-500 mt-1">Auto-redirect to survey after idle</p>
                        </div>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex gap-4">
                      <button
                        onClick={saveExperimentConfig}
                        disabled={isSavingExperiment}
                        className="px-6 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-gray-400"
                      >
                        {isSavingExperiment ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => setEditingExperiment(null)}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Active Status */}
                    <div className={`flex items-center justify-between p-4 rounded-lg ${experimentConfig.is_active ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div>
                        <h3 className="font-medium">Experiment Status</h3>
                        <p className={`text-sm ${experimentConfig.is_active ? 'text-green-700' : 'text-red-700'}`}>
                          {experimentConfig.is_active ? 'Active - Participants can join' : 'Inactive - Maintenance mode'}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleExperimentActive(!experimentConfig.is_active)}
                        disabled={isSavingExperiment}
                        className={`px-4 py-2 rounded font-medium ${
                          experimentConfig.is_active
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        } disabled:bg-gray-400`}
                      >
                        {experimentConfig.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>

                    {/* Summary */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Experiment Name</h4>
                          <p className="text-gray-900">{experimentConfig.experiment_name_en || 'Not set'}</p>
                          <p className="text-gray-600 text-sm">{experimentConfig.experiment_name_fi || ''}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Dates</h4>
                          <p className="text-gray-900">
                            {experimentConfig.start_date || 'Not set'} - {experimentConfig.end_date || 'Not set'}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Ethics</h4>
                          <p className="text-gray-900">{experimentConfig.ethics_board_name || 'Not set'}</p>
                          <p className="text-gray-600 text-sm">{experimentConfig.ethics_reference_number || ''}</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Principal Investigator</h4>
                          <p className="text-gray-900">{experimentConfig.principal_investigator_name || 'Not set'}</p>
                          <p className="text-gray-600 text-sm">{experimentConfig.principal_investigator_email || ''}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Session Rules</h4>
                          <p className="text-gray-900">Min exchanges: {experimentConfig.min_exchanges_before_survey}</p>
                          <p className="text-gray-600 text-sm">
                            Max exchanges: {experimentConfig.max_exchanges_per_chat || 'No limit'} |
                            Idle timeout: {experimentConfig.idle_timeout_minutes ? `${experimentConfig.idle_timeout_minutes} min` : 'None'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                      <p className="text-gray-400 text-sm">
                        Last updated: {new Date(experimentConfig.updated_at).toLocaleString()}
                      </p>
                      <button
                        onClick={() => setEditingExperiment(experimentConfig)}
                        className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                      >
                        Edit Settings
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <p className="text-gray-500 text-center py-8">Loading experiment config...</p>
              )}
            </div>
          </div>
        )}

        {/* Topics Management Tab */}
        {activeTab === 'topics' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Topics Management</h2>
                  <p className="text-gray-600">Configure discussion topics and their welcome messages.</p>
                </div>
                <button
                  onClick={() => setShowAddTopic(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  Add Topic
                </button>
              </div>

              {/* Add Topic Form */}
              {showAddTopic && (
                <div className="border rounded-lg p-4 mb-6 bg-blue-50">
                  <h3 className="font-medium mb-4">Add New Topic</h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Topic Key</label>
                      <input
                        type="text"
                        value={newTopic.topic_key || ''}
                        onChange={(e) => setNewTopic({ ...newTopic, topic_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                        placeholder="e.g., climate_change"
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                      <input
                        type="number"
                        value={newTopic.display_order || 0}
                        onChange={(e) => setNewTopic({ ...newTopic, display_order: parseInt(e.target.value) || 0 })}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Label (English)</label>
                      <input
                        type="text"
                        value={newTopic.label_en || ''}
                        onChange={(e) => setNewTopic({ ...newTopic, label_en: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Label (Finnish)</label>
                      <input
                        type="text"
                        value={newTopic.label_fi || ''}
                        onChange={(e) => setNewTopic({ ...newTopic, label_fi: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message (English)</label>
                      <textarea
                        value={newTopic.welcome_message_en || ''}
                        onChange={(e) => setNewTopic({ ...newTopic, welcome_message_en: e.target.value })}
                        rows={3}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message (Finnish)</label>
                      <textarea
                        value={newTopic.welcome_message_fi || ''}
                        onChange={(e) => setNewTopic({ ...newTopic, welcome_message_fi: e.target.value })}
                        rows={3}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={createTopic}
                      disabled={isSavingTopic || !newTopic.topic_key || !newTopic.label_en}
                      className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-gray-400"
                    >
                      {isSavingTopic ? 'Creating...' : 'Create Topic'}
                    </button>
                    <button
                      onClick={() => setShowAddTopic(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Edit Topic Form */}
              {editingTopic && (
                <div className="border rounded-lg p-4 mb-6 bg-green-50">
                  <h3 className="font-medium mb-4">Edit Topic: {editingTopic.topic_key}</h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Topic Key</label>
                      <input
                        type="text"
                        value={editingTopic.topic_key}
                        disabled
                        className="w-full border rounded px-3 py-2 bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                      <input
                        type="number"
                        value={editingTopic.display_order}
                        onChange={(e) => setEditingTopic({ ...editingTopic, display_order: parseInt(e.target.value) || 0 })}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Label (English)</label>
                      <input
                        type="text"
                        value={editingTopic.label_en}
                        onChange={(e) => setEditingTopic({ ...editingTopic, label_en: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Label (Finnish)</label>
                      <input
                        type="text"
                        value={editingTopic.label_fi}
                        onChange={(e) => setEditingTopic({ ...editingTopic, label_fi: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message (English)</label>
                      <textarea
                        value={editingTopic.welcome_message_en}
                        onChange={(e) => setEditingTopic({ ...editingTopic, welcome_message_en: e.target.value })}
                        rows={3}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message (Finnish)</label>
                      <textarea
                        value={editingTopic.welcome_message_fi}
                        onChange={(e) => setEditingTopic({ ...editingTopic, welcome_message_fi: e.target.value })}
                        rows={3}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveTopic}
                      disabled={isSavingTopic}
                      className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-gray-400"
                    >
                      {isSavingTopic ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setEditingTopic(null)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Topics List */}
              {topicsConfig.length > 0 ? (
                <div className="space-y-3">
                  {topicsConfig.sort((a, b) => a.display_order - b.display_order).map((topic) => (
                    <div
                      key={topic.id}
                      className={`border rounded-lg p-4 flex items-center justify-between ${
                        topic.is_enabled ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Enable/Disable Toggle */}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={topic.is_enabled}
                            onChange={() => toggleTopicEnabled(topic)}
                            disabled={isSavingTopic}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${!topic.is_enabled && 'text-gray-400'}`}>
                              {topic.label_en}
                            </span>
                            <span className="text-gray-400 text-sm">({topic.topic_key})</span>
                            {topic.is_sparse && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                Sparse coverage
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{topic.label_fi}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm mr-2">Order: {topic.display_order}</span>
                        <button
                          onClick={() => setEditingTopic(topic)}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTopic(topic.topic_key)}
                          disabled={isSavingTopic}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:bg-gray-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Loading topics...</p>
              )}

              <button
                onClick={fetchTopicsConfig}
                className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Prompts Tab */}
        {activeTab === 'prompts' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Bot Prompt Configurations</h2>
              <p className="text-gray-600 mb-6">
                Edit the prompts that define each political persona. Changes take effect immediately for new chats.
              </p>

              {editingPrompt ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium capitalize">
                      Editing: {editingPrompt.political_block}
                    </h3>
                    <button
                      onClick={() => setEditingPrompt(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name (English)
                      </label>
                      <input
                        type="text"
                        value={editingPrompt.name_en}
                        onChange={(e) => setEditingPrompt({ ...editingPrompt, name_en: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name (Finnish)
                      </label>
                      <input
                        type="text"
                        value={editingPrompt.name_fi}
                        onChange={(e) => setEditingPrompt({ ...editingPrompt, name_fi: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prompt Description (English)
                    </label>
                    <textarea
                      value={editingPrompt.description_en}
                      onChange={(e) => setEditingPrompt({ ...editingPrompt, description_en: e.target.value })}
                      rows={12}
                      className="w-full border rounded px-3 py-2 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prompt Description (Finnish)
                    </label>
                    <textarea
                      value={editingPrompt.description_fi}
                      onChange={(e) => setEditingPrompt({ ...editingPrompt, description_fi: e.target.value })}
                      rows={12}
                      className="w-full border rounded px-3 py-2 font-mono text-sm"
                    />
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={savePrompt}
                      disabled={isSavingPrompt}
                      className="px-6 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-gray-400"
                    >
                      {isSavingPrompt ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setEditingPrompt(null)}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {prompts.map((prompt) => (
                    <div
                      key={prompt.political_block}
                      className="border rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold capitalize text-lg">
                            {prompt.political_block}
                          </h3>
                          <p className="text-gray-600">{prompt.name_en}</p>
                          <p className="text-gray-400 text-sm mt-1">
                            Last updated: {new Date(prompt.updated_at).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => setEditingPrompt(prompt)}
                          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                        >
                          Edit
                        </button>
                      </div>
                      <div className="mt-3 p-3 bg-gray-100 rounded text-sm font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {prompt.description_en.substring(0, 300)}...
                      </div>
                    </div>
                  ))}

                  {prompts.length === 0 && (
                    <p className="text-gray-500 text-center py-8">Loading prompts...</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Terms Tab */}
        {activeTab === 'terms' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Terms of Use and Informed Consent</h2>
              <p className="text-gray-600 mb-6">
                Edit the Terms of Use and Informed Consent content that participants see on the consent page.
                Changes take effect immediately for new participants.
              </p>

              {editingTerms ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Editing Terms</h3>
                    <button
                      onClick={() => setEditingTerms(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* English Section */}
                  <div className="border rounded-lg p-4 bg-blue-50">
                    <h4 className="font-medium text-blue-800 mb-3">English Version</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Title (English)
                        </label>
                        <input
                          type="text"
                          value={editingTerms.title_en}
                          onChange={(e) => setEditingTerms({ ...editingTerms, title_en: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Content (English) - Supports Markdown
                        </label>
                        <textarea
                          value={editingTerms.content_en}
                          onChange={(e) => setEditingTerms({ ...editingTerms, content_en: e.target.value })}
                          rows={20}
                          className="w-full border rounded px-3 py-2 font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Finnish Section */}
                  <div className="border rounded-lg p-4 bg-green-50">
                    <h4 className="font-medium text-green-800 mb-3">Finnish Version (Suomeksi)</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Title (Finnish)
                        </label>
                        <input
                          type="text"
                          value={editingTerms.title_fi}
                          onChange={(e) => setEditingTerms({ ...editingTerms, title_fi: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Content (Finnish) - Supports Markdown
                        </label>
                        <textarea
                          value={editingTerms.content_fi}
                          onChange={(e) => setEditingTerms({ ...editingTerms, content_fi: e.target.value })}
                          rows={20}
                          className="w-full border rounded px-3 py-2 font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={saveTerms}
                      disabled={isSavingTerms}
                      className="px-6 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-gray-400"
                    >
                      {isSavingTerms ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setEditingTerms(null)}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : terms ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <p className="text-gray-400 text-sm">
                      Last updated: {new Date(terms.updated_at).toLocaleString()}
                    </p>
                    <button
                      onClick={() => setEditingTerms(terms)}
                      className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      Edit Terms
                    </button>
                  </div>

                  {/* Preview English */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-2">English: {terms.title_en}</h4>
                    <div className="bg-gray-50 p-4 rounded text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                      {terms.content_en.substring(0, 1000)}
                      {terms.content_en.length > 1000 && '...'}
                    </div>
                  </div>

                  {/* Preview Finnish */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-2">Finnish: {terms.title_fi}</h4>
                    <div className="bg-gray-50 p-4 rounded text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                      {terms.content_fi.substring(0, 1000)}
                      {terms.content_fi.length > 1000 && '...'}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Loading terms...</p>
              )}
            </div>
          </div>
        )}

        {/* LLM Settings Tab */}
        {activeTab === 'llm' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">LLM Provider Settings</h2>
              <p className="text-gray-600 mb-6">
                Configure API keys and select models for each LLM provider. Only one provider can be active at a time.
              </p>

              {providersData.length > 0 ? (
                <div className="space-y-6">
                  {providersData.map((provider) => {
                    const config = llmConfigs.find(c => c.provider === provider.provider);
                    const isEditing = editingApiKey?.provider === provider.provider;

                    return (
                      <div
                        key={provider.provider}
                        className={`border rounded-lg p-4 ${
                          config?.is_active
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-medium flex items-center gap-2">
                              {provider.display_name}
                              {config?.is_active && (
                                <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                                  Active
                                </span>
                              )}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {provider.models.length} models available
                            </p>
                          </div>
                          {config?.has_key && !config?.is_active && (
                            <button
                              onClick={() => setActiveProvider(provider.provider)}
                              disabled={isSavingLLM}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400"
                            >
                              Set Active
                            </button>
                          )}
                        </div>

                        {/* API Key Section */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            API Key
                          </label>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <input
                                type="password"
                                value={editingApiKey.value}
                                onChange={(e) => setEditingApiKey({ provider: provider.provider, value: e.target.value })}
                                placeholder="Enter API key..."
                                className="flex-1 border rounded px-3 py-2 font-mono text-sm"
                              />
                              <button
                                onClick={() => saveApiKey(provider.provider, editingApiKey.value)}
                                disabled={isSavingLLM || !editingApiKey.value}
                                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-gray-400"
                              >
                                {isSavingLLM ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingApiKey(null)}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {config?.has_key ? (
                                <>
                                  <div className="flex-1 bg-gray-100 rounded px-3 py-2 font-mono text-sm">
                                    {config.api_key_preview || '******'}
                                  </div>
                                  <button
                                    onClick={() => setEditingApiKey({ provider: provider.provider, value: '' })}
                                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                                  >
                                    Change
                                  </button>
                                  <button
                                    onClick={() => deleteApiKey(provider.provider)}
                                    disabled={isSavingLLM}
                                    className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm disabled:bg-gray-200"
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <>
                                  <div className="flex-1 bg-yellow-50 text-yellow-700 rounded px-3 py-2 text-sm">
                                    No API key configured
                                  </div>
                                  <button
                                    onClick={() => setEditingApiKey({ provider: provider.provider, value: '' })}
                                    className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                                  >
                                    Add Key
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Model Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Selected Model
                          </label>
                          <select
                            value={config?.selected_model || ''}
                            onChange={(e) => updateModel(provider.provider, e.target.value)}
                            disabled={isSavingLLM}
                            className="w-full border rounded px-3 py-2"
                          >
                            <option value="">Select a model...</option>
                            {provider.models.map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                                {model.context_window && ` (${Math.round(model.context_window / 1000)}K context)`}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Last Updated */}
                        {config?.updated_at && (
                          <p className="text-xs text-gray-400 mt-3">
                            Last updated: {new Date(config.updated_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Loading providers...</p>
              )}

              <button
                onClick={fetchLLMConfigs}
                className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Test Chat Tab */}
        {activeTab === 'test' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Test Chat with Specific Block</h2>

            {!testChatId ? (
              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Language
                    </label>
                    <select
                      value={testLanguage}
                      onChange={(e) => setTestLanguage(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="en">English</option>
                      <option value="fi">Finnish</option>
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
                  <strong>Block:</strong> {testBlock} | <strong>Topic:</strong> {testTopic} | <strong>Language:</strong> {testLanguage}
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
