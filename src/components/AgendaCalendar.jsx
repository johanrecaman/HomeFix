import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

function getWeekDays(offsetWeeks) {
  const days = [];
  const anchor = new Date();
  anchor.setDate(anchor.getDate() + offsetWeeks * 7);
  anchor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDayHeader(date) {
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

const STATUS_BADGE = {
  pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  aceita:   { label: 'Confirmado', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
};

export default function AgendaCalendar({ prestadorId }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [bookings, setBookings] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const days = getWeekDays(weekOffset);
  const weekStart = days[0].toISOString();
  const weekEnd = (() => {
    const d = new Date(days[6]);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  })();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('solicitacoes')
      .select(
        'id, data_desejada, estimated_duration, descricao, status, users!solicitacoes_cliente_id_fkey(nome)'
      )
      .eq('prestador_id', prestadorId)
      .in('status', ['pendente', 'aceita'])
      .gte('data_desejada', weekStart)
      .lte('data_desejada', weekEnd)
      .order('data_desejada', { ascending: true });
    setBookings(data || []);
  }, [prestadorId, weekStart, weekEnd]);

  useEffect(() => { load(); }, [load]);

  async function handleCancel(id) {
    setCancelling(id);
    await supabase.from('solicitacoes').update({ status: 'cancelada' }).eq('id', id);
    setBookings(prev => prev.filter(b => b.id !== id));
    setConfirmingId(null);
    setCancelling(null);
  }

  function bookingsForDay(day) {
    return bookings.filter(
      b => new Date(b.data_desejada).toDateString() === day.toDateString()
    );
  }

  const todayStr = new Date(new Date().setHours(0, 0, 0, 0)).toDateString();

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-[var(--text-600)]">
          {days[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
          {' – '}
          {days[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <button
          onClick={() => setWeekOffset(w => w + 1)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="space-y-1">
        {days.map(day => {
          const dayBookings = bookingsForDay(day);
          const dayStr = day.toDateString();
          const isToday = dayStr === todayStr;
          const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

          return (
            <div key={day.toISOString()} className={isPast ? 'opacity-60' : ''}>
              <div className={`flex items-center gap-2 px-1 py-2 ${isToday ? 'text-[var(--teal-400)]' : 'text-[var(--text-600)]'}`}>
                <span className="text-xs font-bold uppercase tracking-wider capitalize">
                  {fmtDayHeader(day)}
                </span>
                {isToday && (
                  <span className="text-xs bg-[var(--teal-400)] text-white rounded-full px-2 py-0.5 font-medium">
                    Hoje
                  </span>
                )}
              </div>

              {dayBookings.length === 0 ? (
                <p className="ml-1 mb-4 text-xs text-gray-400 dark:text-gray-600 italic">
                  Sem agendamentos
                </p>
              ) : (
                <div className="space-y-2 mb-4">
                  {dayBookings.map(b => {
                    const endMs =
                      new Date(b.data_desejada).getTime() +
                      (b.estimated_duration ?? 60) * 60_000;
                    const badge = STATUS_BADGE[b.status] ?? STATUS_BADGE.pendente;
                    const isConfirming = confirmingId === b.id;
                    const isCancelling = cancelling === b.id;

                    return (
                      <div
                        key={b.id}
                        className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f1f28] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-mono font-semibold text-[var(--text-900)]">
                                {fmtTime(b.data_desejada)} – {fmtTime(new Date(endMs).toISOString())}
                              </span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-[var(--text-900)] truncate">
                              {b.users?.nome ?? 'Cliente'}
                            </p>
                            <p className="text-xs text-[var(--text-600)] mt-0.5 line-clamp-2">
                              {b.descricao}
                            </p>
                          </div>

                          {!isConfirming && (
                            <button
                              onClick={() => setConfirmingId(b.id)}
                              className="shrink-0 text-xs text-red-500 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg px-2 py-1.5 transition"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>

                        {isConfirming && (
                          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                            <AlertCircle size={14} className="text-amber-500 shrink-0" />
                            <span className="text-xs text-[var(--text-600)] flex-1">
                              Tem certeza que deseja cancelar?
                            </span>
                            <button
                              onClick={() => setConfirmingId(null)}
                              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 transition"
                            >
                              Não
                            </button>
                            <button
                              onClick={() => handleCancel(b.id)}
                              disabled={isCancelling}
                              className="text-xs text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg px-3 py-1 transition"
                            >
                              {isCancelling ? 'Cancelando...' : 'Sim, cancelar'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
