import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Clock } from 'lucide-react'
import { Button } from './Button'

const inputClass = "w-full px-4 py-3 rounded-lg border border-ink-900/15 dark:border-white/15 bg-transparent text-ink-900 dark:text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"

const DURATIONS = [
  { label: '1 hora', minutes: 60 },
  { label: '2 horas', minutes: 120 },
  { label: '3 horas', minutes: 180 },
  { label: '4 horas', minutes: 240 },
]

export function SlotManager({ prestadorId }) {
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ starts_at: '', duration: 60 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function fetchSlots() {
    const { data } = await supabase
      .from('slots')
      .select('*')
      .eq('prestador_id', prestadorId)
      .gte('ends_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
    setSlots(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchSlots() }, [prestadorId])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!form.starts_at) { setError('Selecione data e horário'); return }
    const starts = new Date(form.starts_at)
    const ends = new Date(starts.getTime() + form.duration * 60000)
    if (starts <= new Date()) { setError('O horário deve ser no futuro'); return }
    setSaving(true)
    const { error: err } = await supabase.from('slots').insert({
      prestador_id: prestadorId,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      status: 'free',
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm({ starts_at: '', duration: 60 })
    setAdding(false)
    fetchSlots()
  }

  async function handleDelete(slotId) {
    await supabase.from('slots').delete().eq('id', slotId)
    setSlots(s => s.filter(x => x.id !== slotId))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-ink-900 dark:text-white">Minha Agenda</h3>
          <p className="text-xs text-ink-500 dark:text-ink-600 mt-0.5">Horários livres disponíveis para clientes</p>
        </div>
        <Button size="sm" onClick={() => setAdding(a => !a)}>
          <Plus size={14}/> Adicionar horário
        </Button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">Data e horário de início</label>
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
              className={inputClass}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">Duração</label>
            <div className="flex gap-2 flex-wrap">
              {DURATIONS.map(d => (
                <button
                  key={d.minutes}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, duration: d.minutes }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                    form.duration === d.minutes
                      ? 'bg-teal-400 text-ink-900 border-teal-400'
                      : 'border-ink-900/15 dark:border-white/15 text-ink-700 dark:text-ink-300'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={saving}>Salvar</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-ink-900/5 dark:bg-white/5 animate-pulse"/>
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-12 text-ink-500 dark:text-ink-600">
          <Clock size={32} className="mx-auto mb-3 text-ink-300 dark:text-ink-700"/>
          <p className="text-sm font-medium">Nenhum horário cadastrado</p>
          <p className="text-xs mt-1">Adicione horários para receber solicitações</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {slots.map(slot => {
            const start = new Date(slot.starts_at)
            const end = new Date(slot.ends_at)
            const isBooked = slot.status === 'booked'
            return (
              <div
                key={slot.id}
                className={`flex items-center justify-between p-4 rounded-xl border ${
                  isBooked
                    ? 'border-amber-400/50 bg-amber-50 dark:bg-amber-400/10'
                    : 'border-teal-400/50 bg-teal-50 dark:bg-teal-400/10'
                }`}
              >
                <div>
                  <p className="font-semibold text-ink-900 dark:text-white text-sm">
                    {start.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </p>
                  <p className="text-xs text-ink-600 dark:text-ink-400 mt-0.5">
                    {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} –{' '}
                    {end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    isBooked ? 'bg-amber-400 text-ink-900' : 'bg-teal-400 text-ink-900'
                  }`}>
                    {isBooked ? 'Reservado' : 'Livre'}
                  </span>
                  {!isBooked && (
                    <button
                      onClick={() => handleDelete(slot.id)}
                      className="w-8 h-8 rounded-full grid place-items-center text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14}/>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
