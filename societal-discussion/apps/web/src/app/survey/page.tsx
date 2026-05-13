'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TRANSLATIONS, getStoredLanguage } from '@/lib/translations';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function SurveyPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [t, setT] = useState(TRANSLATIONS.fi);

  useEffect(() => {
    setT(TRANSLATIONS[getStoredLanguage()]);
  }, []);

  const [chatbotUsage, setChatbotUsage] = useState('');
  const [chatbotWhich, setChatbotWhich] = useState('');
  const [politicalChatbot, setPoliticalChatbot] = useState('');
  const [chatbotPerception, setChatbotPerception] = useState<number | null>(null);
  const [conversationReflection, setConversationReflection] = useState('');
  const [responseSpeed, setResponseSpeed] = useState<number | null>(null);
  const [topicVariety, setTopicVariety] = useState<number | null>(null);
  const [detectedBias, setDetectedBias] = useState<number | null>(null);
  const [detectedTerminology, setDetectedTerminology] = useState<number | null>(null);
  const [detectedPersuasion, setDetectedPersuasion] = useState<number | null>(null);
  const [noticeAnything, setNoticeAnything] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          responses: {
            chatbot_usage: chatbotUsage,
            chatbot_which: chatbotWhich,
            political_chatbot: politicalChatbot,
            chatbot_perception: chatbotPerception,
            conversation_reflection: conversationReflection,
            response_speed: responseSpeed,
            topic_variety: topicVariety,
            detected_bias: detectedBias,
            detected_terminology: detectedTerminology,
            detected_persuasion: detectedPersuasion,
            notice_anything: noticeAnything,
          },
        }),
      });
      if (!response.ok) throw new Error('Failed to submit survey');
      router.push('/thank-you');
    } catch (error) {
      console.error('Error:', error);
      alert(t.survey.submitError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const LikertScale = ({
    value,
    onChange,
    labels,
  }: {
    value: number | null;
    onChange: (v: number) => void;
    labels?: { low: string; high: string };
  }) => (
    <div>
      <div className="flex gap-2 mb-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 py-2.5 rounded-lg border transition-colors font-medium ${
              value === n
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {labels && (
        <div className="flex justify-between text-xs text-slate-400 px-1">
          <span>{labels.low}</span>
          <span>{labels.high}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">{t.survey.pageTitle}</h1>
        <p className="text-center text-slate-500 mb-8">{t.survey.pageSubtitle}</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Chatbot usage habits */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <h2 className="font-semibold text-slate-900">{t.survey.section1Title}</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t.survey.chatbotUsageLabel}
              </label>
              <textarea
                value={chatbotUsage}
                onChange={(e) => setChatbotUsage(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder={t.survey.chatbotUsagePlaceholder}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t.survey.chatbotWhichLabel}
              </label>
              <input
                type="text"
                value={chatbotWhich}
                onChange={(e) => setChatbotWhich(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder={t.survey.chatbotWhichPlaceholder}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t.survey.politicalChatbotLabel}
              </label>
              <div className="flex gap-3">
                {t.survey.yesNoUnsure.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPoliticalChatbot(opt)}
                    className={`flex-1 py-2 rounded-lg border transition-colors text-sm ${
                      politicalChatbot === opt
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Chatbot perception */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <h2 className="font-semibold text-slate-900">{t.survey.section2Title}</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t.survey.chatbotPerceptionLabel}
              </label>
              <LikertScale
                value={chatbotPerception}
                onChange={setChatbotPerception}
                labels={t.survey.negPos}
              />
            </div>
          </div>

          {/* Section 3: Conversation reflection + decoys + detection */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <h2 className="font-semibold text-slate-900">{t.survey.section3Title}</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t.survey.conversationReflectionLabel}
              </label>
              <textarea
                value={conversationReflection}
                onChange={(e) => setConversationReflection(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder={t.survey.conversationReflectionPlaceholder}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t.survey.responseSpeedLabel}
              </label>
              <LikertScale
                value={responseSpeed}
                onChange={setResponseSpeed}
                labels={t.survey.slowFast}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t.survey.topicVarietyLabel}
              </label>
              <LikertScale
                value={topicVariety}
                onChange={setTopicVariety}
                labels={t.survey.onesidedVaried}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t.survey.detectedBiasLabel}
              </label>
              <LikertScale
                value={detectedBias}
                onChange={setDetectedBias}
                labels={t.survey.notAtAllClearly}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t.survey.detectedTerminologyLabel}
              </label>
              <LikertScale
                value={detectedTerminology}
                onChange={setDetectedTerminology}
                labels={t.survey.notNoticedClearly}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t.survey.detectedPersuasionLabel}
              </label>
              <LikertScale
                value={detectedPersuasion}
                onChange={setDetectedPersuasion}
                labels={t.survey.notAtAllClearly}
              />
            </div>
          </div>

          {/* Section 4: Open-ended */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-4">{t.survey.section4Title}</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t.survey.noticeAnythingLabel}
              </label>
              <textarea
                value={noticeAnything}
                onChange={(e) => setNoticeAnything(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder={t.survey.noticeAnythingPlaceholder}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t.survey.submitting : t.survey.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
