import { NavLink, useNavigate } from 'react-router-dom'

const links = [
  { to: '/dashboard',     label: 'Field Overview',   icon: '◉' },
  { to: '/crop-analysis', label: 'Crop Analysis',    icon: '◈' },
  { to: '/analyze',       label: 'Disease Analysis', icon: '⬡' },
  { to: '/drone',         label: 'Drone Management', icon: '◎' },
  { to: '/water',         label: 'Water Supply',     icon: '◐' },
  { to: '/chat',          label: 'AI Assistant',     icon: '◆' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  return (
    <aside className="w-56 min-h-screen bg-white border-r border-slate-100 flex flex-col py-5 shrink-0">
      {/* Logo */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2.5 px-5 mb-7 text-left hover:opacity-80 transition-opacity"
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold">A</span>
        </div>
        <div>
          <span className="font-extrabold text-slate-900 text-base leading-none block">AgriSense</span>
          <span className="text-xs text-slate-400 leading-none">Crop Intelligence</span>
        </div>
      </button>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">Navigation</p>
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/dashboard'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`text-base leading-none ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>{link.icon}</span>
                {link.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Farm Setup */}
      <div className="px-5 pt-4 border-t border-slate-100">
        <NavLink
          to="/calibration"
          className={({ isActive }) =>
            `flex items-center gap-2 text-xs font-medium transition-colors ${
              isActive ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-700'
            }`
          }
        >
          <span>⚙</span> Farm Setup
        </NavLink>
      </div>
    </aside>
  )
}
