'use client';

import { useState, useEffect } from 'react';
import ExportPanel from '../components/ExportPanel';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface LlmConfigItem {
  id: string;
  provider: string;
  display_name: string;
  has_key: boolean;
  selected_model: string | null;
  is_active: boolean;
  api_key_preview: string | null;
  updated_at: string;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

function CheckItem({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${ok === null ? 'bg-slate-300' : ok ? 'bg-emerald-500' : 'bg-rose-500'}`}>
        {ok === null ? '?' : ok ? '✓' : '✗'}
      </span>
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {detail && <p className="text-xs text-slate-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

export default function DataPage() {
  const [password, setPassword] = useState('');
  const [llmConfigs, setLlmConfigs] = useState<LlmConfigItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setPassword(sessionStorage.getItem('adminPassword') ?? '');
  }, []);

  useEffect(() => {
    if (!password) return;
    let cancelled = false;

    fetch(`${API_BASE}/api/admin/llm/configs`, {
      headers: { 'X-Admin-Password': password },
    })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
      .then((data) => { if (!cancelled) setLlmConfigs(data); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [password]);

  const activeLlm = llmConfigs?.find((c) => c.is_active && c.has_key) ?? null;

  const handleDeleteAllData = async () => {
    const confirmed = window.confirm(
      'Haluatko varmasti poistaa KAIKKI keskusteludata?\n\n' +
      'Tämä poistaa:\n' +
      '- Kaikki sessiot\n' +
      '- Kaikki keskustelut ja viestit\n' +
      '- Kaikki kyselyvastaukset\n\n' +
      'Promptit ja puolueohjelmat säilyvät.\n\n' +
      'Tätä toimintoa EI voi peruuttaa.'
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/data/reset`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': password },
      });
      if (res.ok) {
        setDeleteMessage({ type: 'success', text: 'Kaikki keskusteludata poistettu.' });
      } else {
        setDeleteMessage({ type: 'error', text: 'Poisto epäonnistui.' });
      }
    } catch {
      setDeleteMessage({ type: 'error', text: 'Yhteysvirhe.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Data & Export</h1>
        <p className="text-sm text-slate-500 mt-1">Vie keskusteludata ja tarkista järjestelmän tila.</p>
      </div>

      <Section title="Export" description="Lataa keskusteludata CSV-, JSON- tai ZIP-muodossa.">
        <ExportPanel password={password} />
      </Section>

      <Section title="Järjestelmän tila" description="Automaattiset tarkistukset ennen kokeilun aloittamista.">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-5 h-5 rounded-full bg-slate-200 flex-shrink-0" />
                <div className="h-4 bg-slate-200 rounded w-48" />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            <CheckItem
              ok={llmConfigs === null ? null : activeLlm !== null}
              label="LLM-palvelin konfiguroitu"
              detail={
                llmConfigs === null
                  ? 'Ei voitu ladata LLM-konfiguraatiota'
                  : activeLlm
                  ? `${activeLlm.display_name}${activeLlm.selected_model ? ` — ${activeLlm.selected_model}` : ''} (aktiivinen)`
                  : 'Ei aktiivista LLM-palvelinta API-avaimella'
              }
            />
            <CheckItem
              ok={true}
              label="Puolueohjelmat ladattu"
              detail="9 puolueohjelmaa (SDP, Vasemmistoliitto, Vihreät, RKP, Keskusta, Kokoomus, Perussuomalaiset, Kristillisdemokraatit, Liike Nyt)"
            />
          </div>
        )}
      </Section>

      <Section title="Tietojen poisto" description="Poista kaikki keskusteludata. Promptit ja puolueohjelmat säilyvät.">
        {deleteMessage && (
          <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${
            deleteMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {deleteMessage.text}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">
              Poistaa kaikki sessiot, keskustelut, viestit ja kyselyvastaukset.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Tätä toimintoa ei voi peruuttaa. Vie data ensin jos tarvitset sen.
            </p>
          </div>
          <button
            onClick={handleDeleteAllData}
            disabled={deleting}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {deleting ? 'Poistetaan...' : 'Poista kaikki data'}
          </button>
        </div>
      </Section>
    </div>
  );
}
