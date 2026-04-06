import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppStore } from '../store/appStore'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import './HeroPicker.css'

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
    <div className="recruit-overlay" onClick={onClose}>
      <div className="recruit-modal" onClick={e => e.stopPropagation()}>
        <h3 className="recruit-title">Reclutar héroe</h3>
        <form onSubmit={handleSubmit}>
          <div className="recruit-field">
            <label className="recruit-label">Nombre</label>
            <input
              className="recruit-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre del héroe"
              maxLength={20}
              autoFocus
              required
            />
          </div>
          <div className="recruit-field">
            <label className="recruit-label">Clase</label>
            <div className="recruit-classes">
              {classes?.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`recruit-class-btn ${classId === c.id ? 'recruit-class-btn--active' : ''}`}
                  onClick={() => setClassId(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="recruit-actions">
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
