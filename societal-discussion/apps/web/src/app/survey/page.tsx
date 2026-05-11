'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function SurveyPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Survey state
  const [chatbotUsage, setChatbotUsage] = useState('');
  const [chatbotWhich, setChatbotWhich] = useState('');
  const [politicalChatbot, setPoliticalChatbot] = useState('');
  const [chatbotPerception, setChatbotPerception] = useState<number | null>(null);
  const [conversationReflection, setConversationReflection] = useState('');
  // Decoy questions
  const [responseSpeed, setResponseSpeed] = useState<number | null>(null);
  const [topicVariety, setTopicVariety] = useState<number | null>(null);
  // Detection (masked among decoys)
  const [detectedBias, setDetectedBias] = useState<number | null>(null);
  const [detectedTerminology, setDetectedTerminology] = useState<number | null>(null);
  const [detectedPersuasion, setDetectedPersuasion] = useState<number | null>(null);
  // Open-ended
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
      alert('Kyselyn lähetys epäonnistui. Yritä uudelleen.');
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
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">Kysely</h1>
        <p className="text-center text-slate-500 mb-8">
          Vastaa seuraaviin kysymyksiin keskustelukokemuksesi perusteella.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Chatbot usage habits */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <h2 className="font-semibold text-slate-900">Chatbottien käyttö</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Käytätkö chatbotteja (esim. ChatGPT, Copilot, Gemini)? Miten?
              </label>
              <textarea
                value={chatbotUsage}
                onChange={(e) => setChatbotUsage(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Kerro lyhyesti..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Mitä chatbotteja käytät? (voit listata useita)
              </label>
              <input
                type="text"
                value={chatbotWhich}
                onChange={(e) => setChatbotWhich(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Esim. ChatGPT, Copilot..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Oletko keskustellut poliittisista aiheista chatbotin kanssa aiemmin?
              </label>
              <div className="flex gap-3">
                {['Kyllä', 'Ei', 'En osaa sanoa'].map((opt) => (
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
            <h2 className="font-semibold text-slate-900">Suhtautuminen chatbotteihin</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Miten suhtaudut chatbotteihin yleisesti? (1 = hyvin kielteisesti, 5 = hyvin myönteisesti)
              </label>
              <LikertScale
                value={chatbotPerception}
                onChange={setChatbotPerception}
                labels={{ low: 'Kielteisesti', high: 'Myönteisesti' }}
              />
            </div>
          </div>

          {/* Section 3: Conversation reflection + decoys + detection */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <h2 className="font-semibold text-slate-900">Keskustelukokemuksesi</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Mitä pidit käymistäsi keskusteluista?
              </label>
              <textarea
                value={conversationReflection}
                onChange={(e) => setConversationReflection(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Kerro vapaasti..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Miten arvioit chatbotin vastausnopeutta? (1 = liian hidas, 5 = erittäin nopea)
              </label>
              <LikertScale
                value={responseSpeed}
                onChange={setResponseSpeed}
                labels={{ low: 'Hidas', high: 'Nopea' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Miten monipuolisesti chatbot käsitteli aiheita? (1 = yksipuolisesti, 5 = monipuolisesti)
              </label>
              <LikertScale
                value={topicVariety}
                onChange={setTopicVariety}
                labels={{ low: 'Yksipuolisesti', high: 'Monipuolisesti' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Havaitko chatbotin vastauksissa puolueellisuutta? (1 = en lainkaan, 5 = selvästi)
              </label>
              <LikertScale
                value={detectedBias}
                onChange={setDetectedBias}
                labels={{ low: 'En lainkaan', high: 'Selvästi' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Käyttikö chatbot tietynlaista sanastoa tai termejä? (1 = en huomannut, 5 = selvästi)
              </label>
              <LikertScale
                value={detectedTerminology}
                onChange={setDetectedTerminology}
                labels={{ low: 'En huomannut', high: 'Selvästi' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Yrittikö chatbot mielestäsi vaikuttaa mielipiteeseesi? (1 = ei lainkaan, 5 = selvästi)
              </label>
              <LikertScale
                value={detectedPersuasion}
                onChange={setDetectedPersuasion}
                labels={{ low: 'Ei lainkaan', high: 'Selvästi' }}
              />
            </div>
          </div>

          {/* Section 4: Open-ended */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Vapaa palaute</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Huomasitko chatbotin vastauksissa jotain erityistä? Kerro vapaasti.
              </label>
              <textarea
                value={noticeAnything}
                onChange={(e) => setNoticeAnything(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Vapaamuotoinen vastaus..."
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
              {isSubmitting ? 'Lähetetään...' : 'Lähetä vastaukset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
