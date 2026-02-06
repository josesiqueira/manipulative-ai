'use client';

import { useState, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams, useSearchParams } from 'next/navigation';

function SurveyContent() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const chatId = searchParams.get('chatId');

  const [perceivedLeaning, setPerceivedLeaning] = useState('');
  const [persuasiveness, setPersuasiveness] = useState<number | null>(null);
  const [naturalness, setNaturalness] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; block: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!chatId || !perceivedLeaning || !persuasiveness || !naturalness || !confidence) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chats/${chatId}/complete`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            perceived_leaning: perceivedLeaning,
            persuasiveness,
            naturalness,
            confidence,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to submit survey');

      const data = await response.json();
      setResult({
        correct: data.correct_guess,
        block: data.political_block,
      });
      setIsComplete(true);
    } catch (error) {
      console.error('Error:', error);
      alert(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const leaningOptions = [
    { id: 'conservative', label: t('survey.perspectiveOptions.conservative') },
    { id: 'red-green', label: t('survey.perspectiveOptions.red-green') },
    { id: 'moderate', label: t('survey.perspectiveOptions.moderate') },
    { id: 'dissatisfied', label: t('survey.perspectiveOptions.dissatisfied') },
  ];

  if (isComplete && result) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {t('survey.thankYou')}
            </h1>

            <div className="mt-8">
              <button
                onClick={() => router.push(`/${locale}`)}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                {t('common.back')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
          {t('survey.title')}
        </h1>
        <p className="text-center text-gray-600 mb-8">{t('survey.subtitle')}</p>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Perceived Leaning */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">{t('survey.perspectiveQuestion')}</h2>
            <div className="space-y-2">
              {leaningOptions.map((option) => (
                <label
                  key={option.id}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    perceivedLeaning === option.id
                      ? 'bg-primary-50 border-primary-500'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="perceivedLeaning"
                    value={option.id}
                    checked={perceivedLeaning === option.id}
                    onChange={(e) => setPerceivedLeaning(e.target.value)}
                    className="sr-only"
                  />
                  <span className="text-gray-900">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Ratings */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            {/* Persuasiveness */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">{t('survey.persuasiveness')}</h3>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPersuasiveness(n)}
                    className={`flex-1 py-3 rounded-lg border transition-colors ${
                      persuasiveness === n
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="block font-medium">{n}</span>
                    <span className="block text-xs mt-1">
                      {t(`survey.scale.${n}` as any)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Naturalness */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">{t('survey.naturalness')}</h3>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNaturalness(n)}
                    className={`flex-1 py-3 rounded-lg border transition-colors ${
                      naturalness === n
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="block font-medium">{n}</span>
                    <span className="block text-xs mt-1">
                      {t(`survey.scale.${n}` as any)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">{t('survey.confidence')}</h3>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setConfidence(n)}
                    className={`flex-1 py-3 rounded-lg border transition-colors ${
                      confidence === n
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="block font-medium">{n}</span>
                    <span className="block text-xs mt-1">
                      {t(`survey.scale.${n}` as any)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={
                !perceivedLeaning ||
                !persuasiveness ||
                !naturalness ||
                !confidence ||
                isSubmitting
              }
              className={`px-8 py-3 rounded-lg font-semibold text-white transition-colors ${
                perceivedLeaning && persuasiveness && naturalness && confidence && !isSubmitting
                  ? 'bg-primary-600 hover:bg-primary-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? t('common.loading') : t('survey.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SurveyLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  );
}

export default function SurveyPage() {
  return (
    <Suspense fallback={<SurveyLoading />}>
      <SurveyContent />
    </Suspense>
  );
}
