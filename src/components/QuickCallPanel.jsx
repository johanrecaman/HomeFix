import { useState, useEffect, useRef } from 'react';
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
  const [confirmedOffer, setConfirmedOffer] = useState(null);
  const seenOffers = useRef(new Set());

  async function handleNewOffer(offerId, prestadorId, estimatedDuration, totalPrice) {
    if (seenOffers.current.has(offerId)) return;
    seenOffers.current.add(offerId);

    const { data: prov } = await supabase
      .from('prestadores')
      .select('avaliacao, categoria, users(nome)')
      .eq('user_id', prestadorId)
      .single();

    const nome = prov?.users?.nome ?? 'Prestador';

    setFeed(prev => [
      ...prev,
      { type: 'received', text: `${nome} recebeu sua solicitação` },
      {
        type: 'offer',
        offerId,
        prestadorNome: nome,
        avaliacao: prov?.avaliacao,
        estimated_duration: estimatedDuration,
        total_price: totalPrice,
      },
    ]);
  }

  useEffect(() => {
    if (!quickCallId) return;

    // Primary: broadcast channel (always works — provider sends this after insert)
    const bch = supabase
      .channel(`qc-b:${quickCallId}`)
      .on('broadcast', { event: 'new-offer' }, ({ payload }) => {
        handleNewOffer(
          payload.id,
          payload.prestador_id,
          payload.estimated_duration,
          payload.total_price,
        );
      })
      .subscribe();

    // Secondary: postgres_changes (works once quick_call_offers is in the publication)
    const pgch = supabase
      .channel(`qc-pg:${quickCallId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quick_call_offers',
          filter: `quick_call_id=eq.${quickCallId}`,
        },
        ({ new: offer }) => {
          handleNewOffer(
            offer.id,
            offer.prestador_id,
            offer.estimated_duration,
            offer.total_price,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bch);
      supabase.removeChannel(pgch);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const offerItem = feed.find(f => f.type === 'offer' && f.offerId === offerId);
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
    setConfirmedOffer(offerItem);
    setStep('confirmed');
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
              {step === 'form' && 'Chamada Rápida'}
              {step === 'live' && 'Chamada Rápida em andamento'}
              {step === 'confirmed' && 'Serviço confirmado!'}
            </h3>
          </div>
          {step === 'form' && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          )}
          {step === 'live' && (
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

          {step === 'confirmed' && confirmedOffer && (
            <div className="flex flex-col items-center py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 size={36} className="text-green-500" />
              </div>
              <div>
                <p className="text-base font-bold text-[var(--text-900)]">
                  {confirmedOffer.prestadorNome}
                </p>
                <p className="text-sm text-[var(--text-600)] mt-1">
                  está a caminho
                </p>
              </div>
              <div className="w-full rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-600)]">Tempo estimado</span>
                  <span className="font-semibold text-[var(--text-900)]">
                    {confirmedOffer.estimated_duration} min
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-600)]">Valor</span>
                  <span className="font-semibold text-[var(--teal-400)]">
                    R$ {Number(confirmedOffer.total_price).toFixed(2)}
                  </span>
                </div>
                {confirmedOffer.avaliacao != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-600)]">Avaliação</span>
                    <span className="font-semibold text-amber-400">
                      ★ {Number(confirmedOffer.avaliacao).toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
              <Button onClick={onClose} className="w-full">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
