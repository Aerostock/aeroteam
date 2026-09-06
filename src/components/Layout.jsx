import { NavLink } from 'react-router-dom'
import { Plane, LogOut } from 'lucide-react'
import { useApp } from '../context/AppContext'

const navItems = [
  { to: '/', label: 'Tableau de bord', end: true },
  { to: '/import', label: 'Import Victory' },
  { to: '/taches', label: 'Tâches' },
  { to: '/equipes', label: 'Équipes' },
  { to: '/affectation', label: 'Affectation' },
  { to: '/export', label: 'Export' },
  { to: '/preparation', label: 'Préparation vac suivante' },
  { to: '/notes', label: 'Bloc-notes' },
]

export default function Layout({ children }) {
  const { activeProfile, disconnect, isAdmin, saveState, resolveConflict } = useApp()

  const items = isAdmin
    ? [...navItems, { to: '/admin', label: 'Administration' }]
    : navItems

  const switchProfile = () => {
    if (window.confirm(`Quitter le profil « ${activeProfile?.name} » ? (les données sont sauvegardées dans le cloud)`)) {
      disconnect()
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-slate-900 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Plane className="h-7 w-7 text-sky-400" />
            <span className="text-xl font-bold">AeroTeam</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right leading-tight">
              <p className="text-[10px] sm:text-xs text-slate-400">Profil</p>
              <p className="text-xs sm:text-sm font-semibold text-sky-300 max-w-[30vw] sm:max-w-[200px] truncate">{activeProfile?.name}</p>
              {activeProfile?.aircraft && (
                <p className="text-[10px] sm:text-xs text-slate-400 truncate max-w-[30vw] sm:max-w-[200px]">✈ {activeProfile.aircraft}</p>
              )}
              {saveState === 'saving' && (
                <p className="text-[10px] sm:text-xs text-amber-300 animate-pulse">Sauvegarde…</p>
              )}
              {saveState === 'offline' && (
                <p
                  className="text-[10px] sm:text-xs text-red-400 font-semibold"
                  title="La sauvegarde a échoué : nouvelle tentative automatique toutes les 30 secondes. Vérifiez la connexion et restez sur cette page."
                >
                  Hors ligne ⚠
                </p>
              )}
            </div>
            <button
              onClick={switchProfile}
              className="text-slate-300 hover:text-white hover:bg-slate-800 p-2 rounded-md"
              title="Changer de profil"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
        {saveState === 'conflict' && (
          <div className="mx-auto max-w-7xl px-4 py-2 flex flex-wrap items-center justify-between gap-3 bg-amber-500 text-white text-sm">
            <span className="font-semibold">
              ⚠ Conflit de sauvegarde : vos modifications locales et celles enregistrées par un autre appareil divergent.
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => resolveConflict('reload')}
                className="bg-white text-amber-700 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-amber-50"
              >
                Recharger depuis le serveur
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Écraser les données du serveur avec celles de cet appareil ? Cette action est irréversible.')) {
                    resolveConflict('overwrite')
                  }
                }}
                className="bg-amber-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-amber-800"
              >
                Écraser avec mes données
              </button>
            </div>
          </div>
        )}
        <div className="mx-auto max-w-7xl px-2 pb-2 flex overflow-x-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm whitespace-nowrap font-medium transition-colors shrink-0 ${
                  isActive
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}
