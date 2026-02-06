'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { LanguageSelector } from '@/components/LanguageSelector';

export default function ConsentPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [consentGiven, setConsentGiven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Demographics (optional)
  const [ageGroup, setAgeGroup] = useState('');
  const [gender, setGender] = useState('');
  const [education, setEducation] = useState('');
  const [politicalLeaning, setPoliticalLeaning] = useState<number | null>(null);
  const [politicalKnowledge, setPoliticalKnowledge] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!consentGiven) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: locale,
          age_group: ageGroup || null,
          gender: gender || null,
          education: education || null,
          political_leaning: politicalLeaning,
          political_knowledge: politicalKnowledge,
          consent_given: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create participant');
      }

      const data = await response.json();

      // Store session token
      localStorage.setItem('sessionToken', data.session_token);
      localStorage.setItem('participantId', data.id);

      // Navigate to chat page
      router.push(`/${locale}/chat`);
    } catch (error) {
      console.error('Error:', error);
      alert(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Language Selector */}
        <div className="mb-8 flex justify-center">
          <LanguageSelector />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          {t('app.title')}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Consent Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">{t('consent.title')}</h2>

            <div className="space-y-4 text-gray-700">
              <p>{t('consent.intro')}</p>
              <p>{t('consent.purpose')}</p>
              <p>{t('consent.duration')}</p>
              <p>{t('consent.voluntary')}</p>
              <p className="font-medium">{t('consent.privacy')}</p>
            </div>

            <div className="mt-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-gray-700">{t('consent.checkbox')}</span>
              </label>
            </div>
          </div>

          {/* Demographics Section (Optional) */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">{t('demographics.title')}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('demographics.ageGroup')}
                </label>
                <select
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="">-</option>
                  <option value="18-24">18-24</option>
                  <option value="25-34">25-34</option>
                  <option value="35-44">35-44</option>
                  <option value="45-54">45-54</option>
                  <option value="55-64">55-64</option>
                  <option value="65+">65+</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('demographics.gender')}
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="">-</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('demographics.education')}
                </label>
                <select
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="">-</option>
                  <option value="high_school">High School</option>
                  <option value="vocational">Vocational</option>
                  <option value="bachelors">Bachelor&apos;s</option>
                  <option value="masters">Master&apos;s</option>
                  <option value="doctorate">Doctorate</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('demographics.politicalLeaning')}
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPoliticalLeaning(n)}
                      className={`flex-1 py-2 rounded-md border ${
                        politicalLeaning === n
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('demographics.politicalKnowledge')}
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPoliticalKnowledge(n)}
                      className={`flex-1 py-2 rounded-md border ${
                        politicalKnowledge === n
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={!consentGiven || isSubmitting}
              className={`px-8 py-3 rounded-lg font-semibold text-white transition-colors ${
                consentGiven && !isSubmitting
                  ? 'bg-primary-600 hover:bg-primary-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? t('common.loading') : t('consent.button')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
