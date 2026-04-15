import { useState } from 'react'
import { apiPost } from '../lib/api'
import { supabase } from '../lib/supabase'
import { LogOut, Dices } from 'lucide-react'

const HERO_NAMES = [
  // Fantásticos originales
  'Aldric', 'Seraphina', 'Kael', 'Lyra', 'Theron', 'Elara', 'Darius', 'Freya',
  'Orion', 'Isolde', 'Ragnar', 'Selene', 'Fenris', 'Astrid', 'Cedric', 'Morrigan',
  'Lucian', 'Brynn', 'Zephyr', 'Rowena', 'Draven', 'Nyx', 'Gareth', 'Sylvana',
  'Varen', 'Eira', 'Torin', 'Liora', 'Balthazar', 'Vesper', 'Alaric', 'Ignis',
  // Mitología griega
  'Aquiles', 'Héctor', 'Odiseo', 'Perseo', 'Teseo', 'Heracles', 'Jasón', 'Leónidas',
  'Ariadna', 'Calíope', 'Medea', 'Andrómeda', 'Atalanta', 'Penélope', 'Circe', 'Electra',
  'Patroclo', 'Diomedes', 'Áyax', 'Neoptólemo', 'Menelao', 'Agamenón', 'Belerofontes',
  // Mitología nórdica
  'Sigurd', 'Brynhildr', 'Gunnar', 'Völsung', 'Njord', 'Vidar', 'Tyr', 'Baldur',
  'Skadi', 'Hlin', 'Gudrun', 'Sigrid', 'Ulfberht', 'Ivar', 'Bjorn', 'Halfdan',
  'Rollo', 'Leif', 'Gunhild', 'Ragnhild', 'Torbjörn', 'Solveig',
  // Mitología romana
  'Romulus', 'Remus', 'Brutus', 'Cassius', 'Maximus', 'Corvus', 'Galba', 'Scipio',
  'Camilla', 'Lavinia', 'Volumnia', 'Aemilia', 'Cornelia', 'Claudia', 'Valeria',
  'Quintus', 'Lucius', 'Marcus', 'Titus', 'Caius', 'Flavius', 'Gaius', 'Severus',
  // Guerreros históricos y leyendas
  'Attila', 'Genghis', 'Khalid', 'Saladin', 'Hannibal', 'Spartacus', 'Vercingetorix',
  'Boudicca', 'Zenobia', 'Tomyris', 'Artemisia', 'Khutulun', 'Lagertha',
  'Rodrigo', 'Pelayo', 'Almanzor', 'Bernardo', 'Ximena', 'Ermengarda',
  // Mitología celta y artúrica
  'Arturus', 'Lancelot', 'Gawain', 'Percival', 'Tristan', 'Galahad', 'Geraint',
  'Guinevere', 'Morgause', 'Nimueh', 'Lunette', 'Elaine', 'Isolde',
  'Cú Chulainn', 'Fionn', 'Diarmuid', 'Grainne', 'Scathach', 'Medb',
  // Mitología oriental y árabe
  'Rustam', 'Sohrab', 'Gilgamesh', 'Enkidu', 'Sinuhé', 'Ramesses', 'Imhotep',
  'Aladin', 'Scheherazade', 'Badr', 'Antarah', 'Qays', 'Layla', 'Shahryar',
]

function randomName() {
  return HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)]
}

const CAUDILLO_STATS = [
  { label: 'FUE', value: 16, max: 18 },
  { label: 'AGI', value: 10, max: 18 },
  { label: 'INT', value: 5,  max: 18 },
]

function StatBar({ label, value, max }) {
  const pct = Math.round((value / max) * 100)
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold tracking-[0.05em] text-text-3 w-[22px] flex-shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-border rounded-[4px] overflow-hidden">
        <div
          className="h-full rounded-[4px] bg-btn-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-text-3 w-3.5 text-right flex-shrink-0">{value}</span>
    </div>
  )
}

function Onboarding({ onComplete }) {
  const [heroName, setHeroName] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await apiPost('/api/onboarding', { heroName })
      onComplete()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-bg px-5 pt-12 pb-16">
      <form
        className="relative z-10 w-[min(900px,100%)] bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] px-5 py-7 sm:px-11 sm:pt-10 sm:pb-12"
        onSubmit={handleSubmit}
        noValidate
      >
        {/* Cambiar cuenta */}
        <button
          type="button"
          className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-text-3 text-[12px] font-medium hover:text-text hover:border-border-2 transition-colors"
          onClick={() => supabase.auth.signOut()}
        >
          <LogOut size={13} strokeWidth={2} />
          Cambiar cuenta
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[var(--blue-500)] mb-2">
            Bienvenido al reino
          </p>
          <h1 className="font-display text-[clamp(30px,5vw,44px)] font-normal tracking-[0.05em] text-[var(--blue-700)] leading-none">
            Crea tu Héroe
          </h1>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="flex-1 h-px bg-border" />
          <div className="w-1.5 h-1.5 bg-[var(--blue-400)] rotate-45 flex-shrink-0" />
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Nombre */}
        <div className="mb-7">
          <label className="block text-[12px] font-semibold tracking-[0.08em] uppercase text-text-2 mb-2" htmlFor="hero-name">
            Nombre del héroe
          </label>
          <div className="flex gap-2.5">
            <input
              id="hero-name"
              className="flex-1 px-3.5 py-[11px] bg-surface-2 border-[1.5px] border-border rounded-lg text-text font-[inherit] text-[16px] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-text-3 focus:border-[var(--blue-500)] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] focus:bg-surface"
              type="text"
              value={heroName}
              onChange={e => setHeroName(e.target.value)}
              placeholder="Escribe un nombre..."
              maxLength={20}
              required
              autoComplete="off"
            />
            <button
              type="button"
              className="flex items-center justify-center w-11 h-11 rounded-lg border-[1.5px] border-border bg-surface-2 text-text-3 hover:text-text hover:border-[var(--blue-400)] transition-colors flex-shrink-0"
              onClick={() => setHeroName(randomName())}
              title="Nombre aleatorio"
            >
              <Dices size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Clase inicial — informativa, no elegible */}
        <div className="mb-7">
          <span className="block text-[12px] font-semibold tracking-[0.08em] uppercase text-text-2 mb-3">
            Tu primer héroe
          </span>
          <div className="flex flex-col gap-2 p-4 border-[1.5px] border-[var(--blue-500)] bg-[var(--blue-50)] rounded-[10px] shadow-[0_0_0_3px_rgba(59,130,246,0.12)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[15px] font-bold text-[var(--blue-700)]">Caudillo</span>
              <span className="text-[11px] font-semibold text-text-3 bg-surface px-2 py-0.5 rounded-full border border-border">
                Slot 1
              </span>
            </div>
            <p className="text-[13px] text-text-2 mb-2 leading-snug">
              Guerrero implacable que aplasta a sus enemigos con fuerza bruta y voluntad de hierro.
            </p>
            <div className="flex flex-col gap-[5px]">
              {CAUDILLO_STATS.map(s => (
                <StatBar key={s.label} {...s} />
              ))}
            </div>
            <p className="text-[11px] text-text-3 mt-1">
              Conforme expandas tu base desbloquearás nuevas clases: Sombra, Arcanista, Domador y Universal.
            </p>
          </div>
        </div>

        {error && (
          <p className="text-[14px] text-[#dc2626] mb-4 text-center">{error}</p>
        )}

        <button
          type="submit"
          className="w-full px-6 py-[13px] bg-btn-primary border-0 rounded-[10px] text-white font-[inherit] text-[15px] font-semibold tracking-[0.01em] transition-[background,box-shadow,transform] duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:not-disabled:bg-btn-primary-hover hover:not-disabled:shadow-[0_4px_16px_rgba(37,99,235,0.35)] active:not-disabled:translate-y-px active:not-disabled:shadow-none"
          disabled={loading || !heroName.trim()}
        >
          {loading ? 'Forjando tu leyenda...' : 'Comenzar la aventura'}
        </button>
      </form>
    </div>
  )
}

export default Onboarding
