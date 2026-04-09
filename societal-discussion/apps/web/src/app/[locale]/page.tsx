'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { LanguageSelector } from '@/components/LanguageSelector';

interface ExperimentStatus {
  is_active: boolean;
  experiment_name_en: string;
  experiment_name_fi: string;
  start_date: string | null;
  end_date: string | null;
}

export default function ConsentPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [consentGiven, setConsentGiven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [experimentStatus, setExperimentStatus] = useState<ExperimentStatus | null>(null);

  // Demographics (optional)
  const [ageGroup, setAgeGroup] = useState('');
  const [gender, setGender] = useState('');
  const [education, setEducation] = useState('');
  const [politicalLeaning, setPoliticalLeaning] = useState<number | null>(null);
  const [politicalKnowledge, setPoliticalKnowledge] = useState<number | null>(null);

  // Fetch experiment status on mount
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/experiment/status`)
      .then((res) => res.json())
      .then((data) => {
        setExperimentStatus(data);
        setIsLoadingStatus(false);
      })
      .catch((err) => {
        console.error('Failed to fetch experiment status:', err);
        // Default to active if we can't fetch status
        setExperimentStatus({
          is_active: true,
          experiment_name_en: '',
          experiment_name_fi: '',
          start_date: null,
          end_date: null,
        });
        setIsLoadingStatus(false);
      });
  }, []);

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

  // Show loading state
  if (isLoadingStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  // Show maintenance message when experiment is inactive
  if (experimentStatus && !experimentStatus.is_active) {
    const experimentName = locale === 'fi'
      ? experimentStatus.experiment_name_fi || experimentStatus.experiment_name_en
      : experimentStatus.experiment_name_en;

    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Language Selector */}
          <div className="mb-8 flex justify-center">
            <LanguageSelector />
          </div>

          {/* Maintenance Message */}
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="mb-6">
              <svg
                className="w-16 h-16 mx-auto text-yellow-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {locale === 'fi' ? 'Huoltokatko' : 'Maintenance Mode'}
            </h1>

            {experimentName && (
              <h2 className="text-xl text-gray-700 mb-4">{experimentName}</h2>
            )}

            <p className="text-gray-600 mb-6">
              {locale === 'fi'
                ? 'Palvelu on tilapäisesti poissa käytöstä huoltotöiden vuoksi. Yritä myöhemmin uudelleen.'
                : 'This service is temporarily unavailable for maintenance. Please try again later.'}
            </p>

            {experimentStatus.start_date && experimentStatus.end_date && (
              <p className="text-sm text-gray-500">
                {locale === 'fi'
                  ? `Tutkimusjakso: ${experimentStatus.start_date} - ${experimentStatus.end_date}`
                  : `Research period: ${experimentStatus.start_date} - ${experimentStatus.end_date}`}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Get experiment name for title
  const experimentName = experimentStatus
    ? (locale === 'fi'
        ? experimentStatus.experiment_name_fi || experimentStatus.experiment_name_en
        : experimentStatus.experiment_name_en)
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Language Selector */}
        <div className="mb-8 flex justify-center">
          <LanguageSelector />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          {experimentName || t('app.title')}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Consent Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">{t('consent.title')}</h2>
            <h3 className="text-lg text-gray-600 mb-6">{t('app.subtitle')}</h3>

            <div className="space-y-6 text-gray-700">
              <p>{t('consent.welcome')}</p>

              {/* Research Purpose */}
              <div>
                <h4 className="font-semibold text-gray-900">{t('consent.sections.researchPurpose.title')}</h4>
                <p>{t('consent.sections.researchPurpose.content')}</p>
              </div>

              {/* Eligibility */}
              <div>
                <h4 className="font-semibold text-gray-900">{t('consent.sections.eligibility.title')}</h4>
                <p>{t('consent.sections.eligibility.content')}</p>
              </div>

              {/* Demonstration Period */}
              <div>
                <h4 className="font-semibold text-gray-900">{t('consent.sections.demonstrationPeriod.title')}</h4>
                <p>{t('consent.sections.demonstrationPeriod.content')}</p>
              </div>

              {/* Data Collection */}
              <div>
                <h4 className="font-semibold text-gray-900">{t('consent.sections.dataCollection.title')}</h4>
                <p>{t('consent.sections.dataCollection.intro')}</p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  {(t.raw('consent.sections.dataCollection.items') as string[]).map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
                <p className="mt-2">{t('consent.sections.dataCollection.outro')}</p>
              </div>

              {/* Study Procedure */}
              <div>
                <h4 className="font-semibold text-gray-900">{t('consent.sections.studyProcedure.title')}</h4>
                <p>{t('consent.sections.studyProcedure.content')}</p>
              </div>

              {/* No Personal Information */}
              <div>
                <h4 className="font-semibold text-gray-900">{t('consent.sections.noPersonalInfo.title')}</h4>
                <p>{t('consent.sections.noPersonalInfo.content')}</p>
              </div>

              {/* Right to Withdraw */}
              <div>
                <h4 className="font-semibold text-gray-900">{t('consent.sections.rightToWithdraw.title')}</h4>
                <p>{t('consent.sections.rightToWithdraw.content')}</p>
              </div>

              {/* AI-Generated Responses */}
              <div>
                <h4 className="font-semibold text-gray-900">{t('consent.sections.aiResponses.title')}</h4>
                <p>{t('consent.sections.aiResponses.content')}</p>
              </div>

              {/* Not a Basis for Political Decisions */}
              <div>
                <h4 className="font-semibold text-gray-900">{t('consent.sections.notBasis.title')}</h4>
                <p>{t('consent.sections.notBasis.content')}</p>
              </div>

              {/* Respectful Interaction */}
              <div>
                <h4 className="font-semibold text-gray-900">{t('consent.sections.respectfulInteraction.title')}</h4>
                <p>{t('consent.sections.respectfulInteraction.content')}</p>
              </div>

              {/* No Endorsement */}
              <div>
                <h4 className="font-semibold text-gray-900">{t('consent.sections.noEndorsement.title')}</h4>
                <p>{t('consent.sections.noEndorsement.content')}</p>
              </div>

              {/* Service Interruption */}
              <div>
                <h4 className="font-semibold text-gray-900">{t('consent.sections.serviceInterruption.title')}</h4>
                <p>{t('consent.sections.serviceInterruption.content')}</p>
              </div>

              {/* Changes to Terms */}
              <div>
                <h4 className="font-semibold text-gray-900">{t('consent.sections.changesToTerms.title')}</h4>
                <p>{t('consent.sections.changesToTerms.content')}</p>
              </div>

              {/* Ethics Approval */}
              <div>
                <h4 className="font-semibold text-gray-900">{t('consent.sections.ethicsApproval.title')}</h4>
                <p>{t('consent.sections.ethicsApproval.content')}</p>
              </div>

              {/* Contact Information */}
              <div>
                <h4 className="font-semibold text-gray-900">{t('consent.sections.contactInfo.title')}</h4>
                <p>{t('consent.sections.contactInfo.intro')}</p>
                <p className="ml-4 mt-2">{t('consent.sections.contactInfo.pi')}</p>
                <p className="ml-4">{t('consent.sections.contactInfo.project')}</p>
              </div>
            </div>

            {/* Checkbox confirmation section */}
            <div className="mt-8 border-t pt-6">
              <p className="font-semibold text-gray-900 mb-4">{t('consent.checkboxIntro')}</p>
              <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700 mb-6">
                {(t.raw('consent.checkboxItems') as string[]).map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 font-medium">{t('consent.checkbox')}</span>
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
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                  <span className="flex items-center gap-1">
                    {t('demographics.education')}
                    <span className="relative group">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4 text-gray-400 cursor-help"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 text-xs text-white bg-gray-800 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {t('demographics.educationHint')}
                      </span>
                    </span>
                  </span>
                </label>
                <select
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                          ? 'bg-blue-600 text-white border-blue-600'
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
                          ? 'bg-blue-600 text-white border-blue-600'
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
                  ? 'bg-blue-600 hover:bg-blue-700'
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
