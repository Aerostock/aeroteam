import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Plane, LogIn, KeyRound } from 'lucide-react'

export default function ProfileSelector() {
  const { connectProfile } = useApp()

  const [code, setCode] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')

  const handleConnect = async () => {
    setConnecting(true)
    setConnectError('')
    const res = await connectProfile(code)
    if (!res.ok) setConnectError(res.error)
    setConnecting(false)
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <Plane className="h-8 w-8 text-sky-500" />
          <h1 className="text-2xl font-bold text-slate-900">AeroTeam</h1>
        </div>
        <p className="text-slate-500 mb-6">
          Entrez votre <strong className="text-slate-700">code personnel</strong> pour retrouver votre profil et vos données, sur n'importe quel appareil.
        </p>

        <div className="border border-slate-200 rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-sky-500" /> Se connecter à mon profil
          </h2>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            type="password"
            placeholder="Votre code personnel"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
            autoFocus
          />
          {connectError && <p className="text-sm text-red-600">{connectError}</p>}
          <button
            onClick={handleConnect}
            disabled={connecting || !code.trim()}
            className="w-full bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <LogIn className="h-4 w-4" /> {connecting ? 'Connexion…' : 'Se connecter'}
          </button>
        </div>
      </div>
    </div>
  )
}