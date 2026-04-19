// src/components/FlashAlert.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { haversineDistance } from '../lib/geo';
import { Button } from './Button';
import { X, Zap } from 'lucide-react';

/**
 * prestador: {
 *   user_id, categoria, hourly_rate,
 *   latitude, longitude   ← current position (updated by useLocationSync)
 * }
 */
export default function FlashAlert({ prestador }) {
  const [alert, setAlert] = useState(null);
  const [duration, setDuration] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('quick-calls')
      .on('broadcast', { event: 'new-quick-call' }, ({ payload }) => {
        if (!prestador.latitude || !prestador.longitude) return;
        const dist = haversineDistance(
          prestador.latitude,
          prestador.longitude,
          payload.lat,
          payload.lng
        );
        if (dist > payload.radius_km * 1000) return;
        if (payload.categoria && payload.categoria !== prestador.categoria) return;
        setAlert(payload);
        setDuration('');
        setDone(false);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [prestador.latitude, prestador.longitude, prestador.categoria]);

  async function handleSubmit() {
    const mins = parseInt(duration, 10);
    if (!mins || mins < 15) return;
    const totalPrice =
      prestador.hourly_rate != null
        ? parseFloat((prestador.hourly_rate * (mins / 60)).toFixed(2))
        : 0;

    setSubmitting(true);
    const { error } = await supabase.from('quick_call_offers').insert({
      quick_call_id: alert.quick_call_id,
      prestador_id: prestador.user_id,
      estimated_duration: mins,
      total_price: totalPrice,
    });
    setSubmitting(false);
    if (!error) {
      setDone(true);
      setAlert(null);
    }
  }

  if (done) {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] max-w-sm rounded-xl bg-teal-600 p-4 shadow-xl text-white">
        <p className="font-semibold">Proposta enviada!</p>
        <p className="text-sm opacity-80 mt-0.5">Aguardando resposta do cliente.</p>
        <button
          onClick={() => setDone(false)}
          className="absolute top-3 right-3 opacity-70 hover:opacity-100"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  if (!alert) return null;

  const estimatedTotal =
    prestador.hourly_rate && duration
      ? (prestador.hourly_rate * (parseInt(duration, 10) / 60)).toFixed(2)
      : null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm rounded-xl border border-amber-400 bg-white dark:bg-[#08141A] p-4 shadow-xl">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-amber-400 shrink-0" />
          <p className="font-semibold text-amber-500 text-sm">Chamado Rápido</p>
        </div>
        <button
          onClick={() => setAlert(null)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X size={16} />
        </button>
      </div>

      <p className="text-sm dark:text-gray-300 mb-3">{alert.descricao}</p>

      <div className="mb-3">
        <label className="block text-xs text-[var(--text-600)] mb-1">
          Duração estimada (minutos)
        </label>
        <input
          type="number"
          min="15"
          max="480"
          step="15"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Ex: 60"
          className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        />
        {estimatedTotal && (
          <p className="mt-1 text-xs text-[var(--teal-400)]">
            Total estimado: R$ {estimatedTotal}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setAlert(null)}>
          Ignorar
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!duration || parseInt(duration, 10) < 15 || submitting}
        >
          {submitting ? 'Enviando...' : 'Enviar Proposta'}
        </Button>
      </div>
    </div>
  );
}
