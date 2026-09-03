import { NavLink } from 'react-router-dom'
import { Plane, LogOut } from 'lucide-react'
import { useApp } from '../context/AppContext'

const navItems = [
  { to: '/', label: 'Tableau de bord', end: true },
  { to: '/import', label: 'Importer Excel' },
  { to: '/taches', label: 'Tâches' },
  { to: '/equipes', label: 'Équipes' },
  { to: '/affectation', label: 'Affectation' },
  { to: '/export', label: 'Export' },
]

export default function Layout({ children }) {
  const { activeProfile, disconnect } = useApp()

  const switchProfile = () => {
    if (window.confirm(`Quitter le profil « ${activeProfile?.name} » ? (les données sont sauvegardées dans le cloud)`)) {
      disconnect()
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-slate-900 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Plane className="h-7 w-7 text-sky-400" />
            <span className="text-xl font-bold">Maintenance Aviation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex space-x-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
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
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right leading-tight">
              <p className="text-xs text-slate-400">Profil</p>
              <p className="text-sm font-semibold text-sky-300">{activeProfile?.name}</p>
              {activeProfile?.aircraft && (
                <p className="text-xs text-slate-400">✈ {activeProfile.aircraft}</p>
              )}
            </div>
            <button
              onClick={switchProfile}
              className="text-slate-300 hover:text-white hover:bg-slate-800 p-2 rounded-md"
              title="Changer de profil"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="lg:hidden flex overflow-x-auto px-2 pb-2 space-x-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm whitespace-nowrap font-medium ${
                  isActive
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
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
