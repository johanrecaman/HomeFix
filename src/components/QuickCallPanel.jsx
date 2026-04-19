// src/components/QuickCallPanel.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { Zap, X, Loader2 } from 'lucide-react';

/**
 * userLocation: { lat, lng }
 * clientId: uuid
 * categorias: string[]
 * onClose: () => void
 */
export default function QuickCallPanel({ userLocation, clientId, categorias, onClose }) {
  const [step, setStep] = useState('form');   // 'form' | 'waiting' | 'offers'
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [quickCallId, setQuickCallId] = useState(null);
  const [offers, setOffers] = useState([]);
  const [accepting, setAccepting] = useState(null);
  const [createError, setCreateError] = useState('');

  // Subscribe to incoming offers once quickCallId is set
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
          // Enrich with provider info
          const { data: prov } = await supabase
            .from('prestadores')
            .select('avaliacao, categoria, users(nome, foto_url)')
            .eq('user_id', offer.prestador_id)
            .single();
          setOffers((prev) => [...prev, { ...offer, prov }]);
          setStep('offers');
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
    setStep('waiting');

    // Broadcast to all connected providers
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

  // ── Form step ──────────────────────────────────────────────
  if (step === 'form') {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm rounded-2xl bg-white dark:bg-[#08141A] shadow-2xl border border-amber-400 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-amber-400" />
            <h3 className="font-semibold">Chamado Rápido</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[var(--text-600)] mb-1">
              Descreva o serviço *
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Ex: Torneira vazando na cozinha..."
              className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-600)] mb-1">
              Categoria (opcional)
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              <option value="">Qualquer</option>
              {categorias.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {createError && (
            <p className="text-xs text-red-500">{createError}</p>
          )}

          <Button
            onClick={handleCreate}
            disabled={!descricao.trim()}
            className="w-full"
          >
            Solicitar agora
          </Button>
        </div>
      </div>
    );
  }

  // ── Waiting step ───────────────────────────────────────────
  if (step === 'waiting') {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm rounded-2xl bg-white dark:bg-[#08141A] shadow-2xl border border-gray-200 dark:border-gray-700 p-5 text-center">
        <Loader2 size={32} className="mx-auto mb-3 text-[var(--teal-400)] animate-spin" />
        <p className="font-medium">Procurando prestadores próximos...</p>
        <p className="text-sm text-[var(--text-600)] mt-1">
          Aguardando propostas dos profissionais
        </p>
        <button
          onClick={handleCancel}
          className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Cancelar
        </button>
      </div>
    );
  }

  // ── Offers step ────────────────────────────────────────────
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm rounded-2xl bg-white dark:bg-[#08141A] shadow-2xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Propostas recebidas</h3>
        <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {offers.map((offer) => (
          <div
            key={offer.id}
            className="rounded-xl border border-gray-200 dark:border-gray-700 p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">
                {offer.prov?.users?.nome ?? 'Prestador'}
              </span>
              {offer.prov?.avaliacao && (
                <span className="text-xs text-amber-400">
                  ★ {offer.prov.avaliacao.toFixed(1)}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-600)]">
              {offer.estimated_duration} min · R$ {offer.total_price?.toFixed(2)}
            </p>
            <Button
              size="sm"
              className="mt-2 w-full"
              onClick={() => handleAccept(offer.id)}
              disabled={accepting !== null}
            >
              {accepting === offer.id ? 'Aceitando...' : 'Aceitar'}
            </Button>
          </div>
        ))}
      </div>

      <button
        onClick={handleCancel}
        className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600 underline"
      >
        Cancelar chamado
      </button>
    </div>
  );
}
