import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { Zap, X, Loader2, CheckCircle2 } from 'lucide-react';

export default function QuickCallPanel({ userLocation, clientId, categorias, onClose }) {
  const [step, setStep] = useState('form');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [quickCallId, setQuickCallId] = useState(null);
  const [feed, setFeed] = useState([]);
  const [accepting, setAccepting] = useState(null);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (!quickCallId) return;

    const channel = supabase
      .channel(`qc-offers:${quickCallId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quick_call_offers',
          filter: `quick_call_id=eq.${quickCallId}`,
        },
        async ({ new: offer }) => {
          const { data: prov } = await supabase
            .from('prestadores')
            .select('avaliacao, categoria, users(nome)')
            .eq('user_id', offer.prestador_id)
            .single();

          const nome = prov?.users?.nome ?? 'Prestador';

          setFeed(prev => [
            ...prev,
            { type: 'received', text: `${nome} recebeu sua solicitação` },
            {
              type: 'offer',
              text: `${nome} enviou uma proposta`,
              offerId: offer.id,
              prestadorNome: nome,
              avaliacao: prov?.avaliacao,
              estimated_duration: offer.estimated_duration,
              total_price: offer.total_price,
            },
          ]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [quickCallId]);

  async function handleCreate() {
    setCreateError('');
    const { data, error } = await supabase
      .from('quick_calls')
      .insert({
        cliente_id: clientId,
        descricao,
        categoria: categoria || null,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        radius_km: 10,
      })
      .select('id')
      .single();

    if (error || !data) {
      setCreateError('Erro ao criar chamado. Tente novamente.');
      return;
    }

    setQuickCallId(data.id);
    setFeed([
      { type: 'system', text: 'Solicitação enviada' },
      { type: 'waiting', text: 'Procurando prestadores próximos...' },
    ]);
    setStep('live');

    await supabase.channel('quick-calls').send({
      type: 'broadcast',
      event: 'new-quick-call',
      payload: {
        quick_call_id: data.id,
        descricao,
        categoria: categoria || null,
        lat: userLocation.lat,
        lng: userLocation.lng,
        radius_km: 10,
      },
    });
  }

  async function handleAccept(offerId) {
    setAccepting(offerId);
    const { data, error } = await supabase.rpc('accept_quick_call_offer', {
      p_quick_call_id: quickCallId,
      p_offer_id: offerId,
      p_cliente_id: clientId,
    });
    if (error || !data?.success) {
      alert('Esta proposta não está mais disponível. Escolha outra.');
      setAccepting(null);
      return;
    }
    onClose();
  }

  async function handleCancel() {
    if (quickCallId) {
      await supabase
        .from('quick_calls')
        .update({ status: 'cancelled' })
        .eq('id', quickCallId);
    }
    onClose();
  }

  const hasOffers = feed.some(f => f.type === 'offer');

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={() => step === 'form' && onClose()}
      />

      <div className="relative bg-white dark:bg-[#08141A] rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-amber-400" />
            <h3 className="font-semibold text-[var(--text-900)]">
              {step === 'form' ? 'Chamada Rápida' : 'Chamada Rápida em andamento'}
            </h3>
          </div>
          {step === 'form' ? (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          ) : (
            <button
              onClick={handleCancel}
              className="text-xs text-red-500 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg px-3 py-1.5 transition"
            >
              Cancelar
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 'form' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-600)] mb-1">
                  Descreva o serviço *
                </label>
                <textarea
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  rows={3}
                  placeholder="Ex: Torneira vazando na cozinha..."
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-800 dark:text-white resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-600)] mb-1">
                  Categoria (opcional)
                </label>
                <select
                  value={categoria}
                  onChange={e => setCategoria(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-800 dark:text-white"
                >
                  <option value="">Qualquer</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {createError && <p className="text-xs text-red-500">{createError}</p>}
              <Button onClick={handleCreate} disabled={!descricao.trim()} className="w-full">
                Solicitar agora
              </Button>
            </div>
          )}

          {step === 'live' && (
            <div className="space-y-3">
              {feed.map((item, i) => {
                if (item.type === 'system') {
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                      <span className="text-sm text-[var(--text-600)]">{item.text}</span>
                    </div>
                  );
                }

                if (item.type === 'waiting') {
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <Loader2 size={16} className={`shrink-0 text-[var(--teal-400)] ${!hasOffers ? 'animate-spin' : ''}`} />
                      <span className="text-sm text-[var(--text-600)]">{item.text}</span>
                    </div>
                  );
                }

                if (item.type === 'received') {
                  return (
                    <div key={i} className="flex items-center gap-3 pl-1">
                      <span className="text-xs text-gray-400">—</span>
                      <span className="text-sm text-[var(--text-600)]">{item.text}</span>
                    </div>
                  );
                }

                if (item.type === 'offer') {
                  return (
                    <div key={i} className="rounded-xl border border-[var(--teal-400)]/30 bg-teal-50/40 dark:bg-teal-900/10 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-[var(--text-900)]">
                          {item.prestadorNome}
                        </span>
                        {item.avaliacao != null && (
                          <span className="text-xs text-amber-400 font-medium">
                            ★ {Number(item.avaliacao).toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-600)] mb-2">
                        {item.estimated_duration} min · R$ {Number(item.total_price).toFixed(2)}
                      </p>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleAccept(item.offerId)}
                        disabled={accepting !== null}
                      >
                        {accepting === item.offerId ? 'Aceitando...' : 'Aceitar →'}
                      </Button>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
