import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { SlidersHorizontal, ChevronDown, Loader2, Search } from 'lucide-react';

export default function BuscaTab({ userLocation, categorias, onAgendar }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterCategoria, setFilterCategoria] = useState('');
  const [minRate, setMinRate] = useState('');
  const [maxRate, setMaxRate] = useState('');
  const [radius, setRadius] = useState(10);
  const [sortBy, setSortBy] = useState('distance');

  const search = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_nearby_providers', {
      lat: userLocation.lat,
      lng: userLocation.lng,
      radius_km: radius,
      filter_categoria: filterCategoria || null,
      min_hourly_rate: minRate ? parseFloat(minRate) : null,
      max_hourly_rate: maxRate ? parseFloat(maxRate) : null,
    });
    if (error) { console.error(error); setLoading(false); return; }
    let results = (data || []).map(p => ({ ...p, foto_url: p.foto_url ?? p.user_foto_url }));
    if (sortBy === 'rating') {
      results = [...results].sort((a, b) => (b.avaliacao ?? 0) - (a.avaliacao ?? 0));
    }
    setProviders(results);
    setLoading(false);
  }, [userLocation, radius, filterCategoria, minRate, maxRate, sortBy]);

  useEffect(() => { search(); }, [search]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      <div className="bg-white dark:bg-[#08141A] border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button
          onClick={() => setFiltersOpen(f => !f)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-900)]"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} />
            Filtros
            {(filterCategoria || minRate || maxRate || radius !== 10) && (
              <span className="text-xs bg-[var(--teal-400)] text-white rounded-full px-1.5 py-0.5">
                ●
              </span>
            )}
          </div>
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {filtersOpen && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--text-600)] block mb-1">Categoria</label>
              <select
                value={filterCategoria}
                onChange={e => setFilterCategoria(e.target.value)}
                className="w-full border rounded-lg px-2 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="">Todas</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-[var(--text-600)] block mb-1">Distância</label>
              <select
                value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                className="w-full border rounded-lg px-2 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                {[2, 5, 10, 20, 50].map(r => (
                  <option key={r} value={r}>{r} km</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[var(--text-600)] block mb-1">Valor/hora (R$)</label>
              <div className="flex gap-1">
                <input
                  type="number" min="0" placeholder="Mín" value={minRate}
                  onChange={e => setMinRate(e.target.value)}
                  className="w-1/2 border rounded-lg px-2 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
                <input
                  type="number" min="0" placeholder="Máx" value={maxRate}
                  onChange={e => setMaxRate(e.target.value)}
                  className="w-1/2 border rounded-lg px-2 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--text-600)] block mb-1">Ordenar por</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="w-full border rounded-lg px-2 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="distance">Distância</option>
                <option value="rating">Avaliação</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-[var(--teal-400)]" />
          </div>
        )}

        {!loading && providers.length === 0 && (
          <div className="flex flex-col items-center py-16 text-[var(--text-600)]">
            <Search size={36} className="mb-3 opacity-25" />
            <p className="text-sm">Nenhum prestador encontrado</p>
            <p className="text-xs mt-1 opacity-60">Tente aumentar o raio de busca</p>
          </div>
        )}

        {!loading && providers.length > 0 && (
          <div className="p-4 space-y-3">
            {providers.map(p => (
              <div
                key={p.user_id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f1f28] p-3 flex items-center gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden shrink-0 flex items-center justify-center">
                  {p.foto_url ? (
                    <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-gray-500 dark:text-gray-400">
                      {p.nome?.[0]?.toUpperCase() ?? '?'}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-semibold text-sm truncate text-[var(--text-900)]">{p.nome}</p>
                    {p.avaliacao != null && (
                      <span className="text-xs text-amber-400 shrink-0 font-medium">
                        ★ {Number(p.avaliacao).toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-600)]">
                    {p.categoria}
                    {p.distance_km != null && ` · ${Number(p.distance_km).toFixed(1)} km`}
                  </p>
                  {p.hourly_rate != null && (
                    <p className="text-xs font-medium text-[var(--teal-400)] mt-0.5">
                      R$ {Number(p.hourly_rate).toFixed(0)}/h
                    </p>
                  )}
                </div>

                <button
                  onClick={() => onAgendar(p)}
                  className="shrink-0 text-xs font-semibold bg-[var(--teal-400)] hover:opacity-90 text-white rounded-xl px-3 py-2 transition"
                >
                  Agendar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
