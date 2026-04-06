import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppStore } from '../store/appStore'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'

export function RecruitModal({ classes, onRecruit, onClose }) {
  const userId      = useAppStore(s => s.userId)
  const queryClient = useQueryClient()
  const [name, setName]       = useState('')
  const [classId, setClassId] = useState(classes?.[0]?.id ?? '')

  const recruitMutation = useMutation({
    mutationFn: () => apiPost('/api/hero-recruit', { heroName: name, heroClass: classId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
      onRecruit()
      onClose()
    },
    onError: (err) => toast.error(err.message),
  })

  function handleSubmit(e) {
    e.preventDefault()
    recruitMutation.mutate()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-[14px] p-7 w-[min(100%,400px)] shadow-[var(--shadow-lg)] flex flex-col gap-6"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-[1.1rem] font-bold text-text">Reclutar héroe</h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Nombre */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.75rem] font-semibold text-text-2">Nombre</label>
            <input
              className="px-3 py-2 border border-border rounded-lg bg-surface-2 text-text text-[0.88rem] font-[inherit] outline-none transition-[border-color] duration-150 focus:border-[var(--blue-500)]"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre del héroe"
              maxLength={20}
              autoFocus
              required
            />
          </div>

          {/* Clase */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.75rem] font-semibold text-text-2">Clase</label>
            <div className="flex gap-1.5 flex-wrap">
              {classes?.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`px-3 py-[0.35rem] border rounded-lg text-[0.78rem] font-semibold cursor-pointer transition-all duration-150
                    ${classId === c.id
                      ? 'border-[var(--blue-500)] bg-info-bg text-[var(--blue-600)]'
                      : 'border-border bg-surface-2 text-text-2 hover:border-border-2'
                    }`}
                  onClick={() => setClassId(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-2.5 justify-end pt-1">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--primary" disabled={recruitMutation.isPending}>
              {recruitMutation.isPending ? 'Reclutando...' : 'Reclutar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
