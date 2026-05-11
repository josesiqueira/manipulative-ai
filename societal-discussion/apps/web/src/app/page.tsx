'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Topic categories with their questions (from VAALIKONE-QUESTIONS-FINAL.md)
const TOPIC_CATEGORIES = [
  {
    title: 'Talous & verotus',
    topics: [
      'Miten valtion velkaantumista pitäisi hillitä? Pitäisikö leikata palveluista vai etsiä muita keinoja?',
      'Pitäisikö palkkojen verotusta keventää? Miten se vaikuttaisi julkisiin palveluihin?',
      'Kumpi on parempi vaihtoehto: veronkorotukset vai palveluiden leikkaukset?',
      'Ovatko suuret tuloerot ongelma Suomessa? Miten tuloeroja pitäisi käsitellä?',
      'Pitäisikö valtion puuttua enemmän markkinoiden toimintaan?',
      'Mikä on valtion rooli yritystoiminnassa? Pitäisikö valtion omistuksia vähentää?',
    ],
  },
  {
    title: 'Sosiaaliturva & terveydenhuolto',
    topics: [
      'Pitäisikö sosiaali- ja terveydenhuoltoon panostaa nykyistä enemmän rahaa? Mistä rahat tulisivat?',
      'Onko Suomen sosiaaliturva liian antelias vai riittämätön? Miten sitä pitäisi kehittää?',
      'Miten huumeongelma pitäisi ratkaista Suomessa? Mitä mieltä olet käyttöhuoneista?',
      'Miten varhaiskasvatuksen laatua ja henkilöstön riittävyyttä voitaisiin parantaa?',
      'Miten kansalaisia pitäisi tukea elinkustannusten noustessa?',
    ],
  },
  {
    title: 'Koulutus',
    topics: [
      'Miten peruskoulun laatua voitaisiin parantaa? Pitäisikö luokkakokoja rajoittaa lailla?',
      'Miten oppimisen tuki pitäisi järjestää kouluissa? Pitäisikö erityisopetukseen panostaa enemmän?',
    ],
  },
  {
    title: 'Ympäristö & ilmasto',
    topics: [
      'Pitäisikö metsien hakkuita vähentää ilmastonmuutoksen ja luontokadon vuoksi?',
      'Onko Suomen hiilineutraaliustavoite 2035 realistinen? Pitäisikö aikataulua muuttaa?',
      'Pitäisikö Suomen toimia ilmaston puolesta riippumatta muiden maiden toimista?',
      'Mitä mieltä olet turkistarhauksesta Suomessa? Pitäisikö se kieltää?',
      'Miten vihreän siirtymän investointeja pitäisi edistää Suomessa?',
    ],
  },
  {
    title: 'Työmarkkinat & maahanmuutto',
    topics: [
      'Miten työllisyyttä voitaisiin parantaa? Pitäisikö ansiosidonnaista muuttaa?',
      'Tarvitseeko Suomi lisää työperäistä maahanmuuttoa? Miten sitä pitäisi hoitaa?',
      'Mitä ajattelet Suomen monikulttuuristumisesta? Miten kotoutumista voitaisiin parantaa?',
    ],
  },
  {
    title: 'Turvallisuus & ulkopolitiikka',
    topics: [
      'Miten Suomen pitäisi tukea Ukrainaa? Kuinka pitkälle tuen pitäisi ulottua?',
      'Paljonko Suomen pitäisi käyttää rahaa puolustukseen Naton jäsenenä?',
      'Miten nuorisorikollisuutta pitäisi ehkäistä? Tarvitaanko kovempia rangaistuksia vai muita keinoja?',
    ],
  },
  {
    title: 'Arvot & yhteiskunta',
    topics: [
      'Miten sukupuolen moninaisuus pitäisi ottaa huomioon yhteiskunnassa?',
      'Minkälaiset arvot ovat tärkeitä lasten kasvatuksessa?',
      'Miten asuinalueiden eriytymistä pitäisi ehkäistä?',
    ],
  },
  {
    title: 'Kaupunkikehitys & liikenne',
    topics: [
      'Pitäisikö suurissa kaupungeissa ottaa käyttöön ruuhkamaksuja?',
      'Miten liikennettä pitäisi kehittää kaupungeissa? Pitäisikö autoilua rajoittaa?',
      'Miten asuntojen kohtuuhintaisuus ja luonnon suojelu voidaan sovittaa yhteen?',
    ],
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Create or restore session on mount
  useEffect(() => {
    async function initSession() {
      setIsCreatingSession(true);
      const existing = localStorage.getItem('sessionId');

      // Validate existing session
      if (existing) {
        try {
          const res = await fetch(`${API_URL}/api/sessions/${existing}`);
          if (res.ok) {
            setSessionId(existing);
            setIsCreatingSession(false);
            return;
          }
        } catch {
          // Session invalid — fall through to create new one
        }
        localStorage.removeItem('sessionId');
      }

      // Create new session
      try {
        const res = await fetch(`${API_URL}/api/sessions`, { method: 'POST' });
        const data = await res.json();
        localStorage.setItem('sessionId', data.id);
        setSessionId(data.id);
      } catch (err) {
        console.error('Failed to create session:', err);
      } finally {
        setIsCreatingSession(false);
      }
    }

    initSession();
  }, []);

  const startChat = useCallback(
    async (starterTopic?: string) => {
      if (!sessionId) return;
      try {
        const response = await fetch(`${API_URL}/api/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            starter_topic: starterTopic || null,
          }),
        });
        if (response.status === 404) {
          // Session expired — clear and reload to create a new one
          localStorage.removeItem('sessionId');
          window.location.reload();
          return;
        }
        if (!response.ok) throw new Error('Failed to create conversation');
        const data = await response.json();
        localStorage.setItem('conversationId', data.id);
        if (starterTopic) {
          localStorage.setItem('starterTopic', starterTopic);
        } else {
          localStorage.removeItem('starterTopic');
        }
        router.push('/chat');
      } catch (error) {
        console.error('Error starting chat:', error);
      }
    },
    [sessionId, router],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-slate-900 mb-6">
          Vaalikeskustelu
        </h1>

        {/* Instructions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <p className="text-slate-700 leading-relaxed">
            Tehtävänäsi on selvittää politiikasta tai keskustella tuleviin vaaleihin liittyvistä
            aiheista chatbotin kanssa. (Muista, ettei puoluekantaasi kerätä ja keskustelusi ovat
            anonyymejä. Voit esittää kenen tahansa puolueen tai ehdokkaan kannattajaa, kysyä
            neutraaleja kysymyksiä tai keskustella vain aiheista). Voit kysyä vapaasti tai valita
            alla olevista aiheista. Kysy kysymyksiä ja syvennä keskustelua tarvittaessa. Aloita uusi
            keskustelu uudella aiheella &quot;Takaisin alkuun&quot; -painikkeella. Kun olet valmis, paina
            &quot;Lopeta keskustelu&quot; ja vastaa kyselyyn.
          </p>
        </div>

        {/* Guidance */}
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 mb-6 space-y-2">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Vinkki:</span> Voit kysyä esimerkiksi, mitä mieltä
            jokin puolue on jostakin asiasta, tai pyytää chatbottia kertomaan, mistä jokin asia on
            kyse.
          </p>
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Tavoite:</span> Keskustele chatbotin kanssa 3–5
            minuuttia ennen kyselyyn vastaamista. Käy 2–3 eri keskustelua chatbotin kanssa.
          </p>
        </div>

        {/* Free conversation button */}
        <button
          onClick={() => startChat()}
          disabled={!sessionId || isCreatingSession}
          className="w-full mb-8 py-4 px-6 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Vapaa keskustelu
        </button>

        {/* Topic categories */}
        <h2 className="text-lg font-semibold text-slate-700 mb-4">
          Tai valitse aihe keskustelulle:
        </h2>

        <div className="space-y-6">
          {TOPIC_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {category.title}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {category.topics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => startChat(topic)}
                    disabled={!sessionId || isCreatingSession}
                    className="text-left p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-slate-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
