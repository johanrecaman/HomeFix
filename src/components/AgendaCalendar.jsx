// src/components/AgendaCalendar.jsx
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

function fmtTime(isoString) {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDay(date) {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function AgendaCalendar({ prestadorId }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [bookings, setBookings] = useState([]);

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
        'id, data_desejada, estimated_duration, descricao, users!solicitacoes_cliente_id_fkey(nome)'
      )
      .eq('prestador_id', prestadorId)
      .eq('status', 'aceita')
      .not('estimated_duration', 'is', null)
      .gte('data_desejada', weekStart)
      .lte('data_desejada', weekEnd);
    setBookings(data || []);
  }, [prestadorId, weekStart, weekEnd]);

  useEffect(() => {
    load();
  }, [load]);

  function blocksForDay(day) {
    return bookings.filter(
      (b) =>
        new Date(b.data_desejada).toDateString() === day.toDateString()
    );
  }

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium text-[var(--text-600)]">
          {days[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
          {' – '}
          {days[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day rows */}
      <div className="space-y-2">
        {days.map((day) => {
          const blocks = blocksForDay(day);
          const isToday = day.toDateString() === new Date().toDateString();
          const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

          return (
            <div
              key={day.toISOString()}
              className={`rounded-lg border px-3 py-2 ${
                isToday
                  ? 'border-[var(--teal-400)] bg-teal-50/30 dark:bg-teal-900/10'
                  : 'border-gray-200 dark:border-gray-700'
              } ${isPast ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-600)]">
                  {fmtDay(day)}
                  {isToday && (
                    <span className="ml-2 text-[var(--teal-400)]">hoje</span>
                  )}
                </span>
                {blocks.length === 0 && (
                  <span className="text-xs text-green-500">
                    Disponível 08:00–18:00
                  </span>
                )}
              </div>

              {blocks.length > 0 && (
                <div className="space-y-1 mt-1">
                  {blocks.map((b) => {
                    const endMs =
                      new Date(b.data_desejada).getTime() +
                      b.estimated_duration * 60_000;
                    const endIso = new Date(endMs).toISOString();
                    return (
                      <div
                        key={b.id}
                        className="flex items-center gap-2 text-xs bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded px-2 py-1"
                      >
                        <span className="font-mono shrink-0">
                          {fmtTime(b.data_desejada)}–{fmtTime(endIso)}
                        </span>
                        <span className="text-red-400">·</span>
                        <span className="font-medium">
                          {b.users?.nome ?? 'Cliente'}
                        </span>
                        <span className="text-red-400 truncate">{b.descricao}</span>
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
