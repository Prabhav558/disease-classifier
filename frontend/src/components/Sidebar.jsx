import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Main page' },
  { to: '/crop-analysis', label: 'Crop analysis' },
  { to: '/disease-analysis', label: 'Disease analysis' },
  { to: '/drone', label: 'Drone management' },
]

export default function Sidebar() {
  return (
    <aside className="w-52 min-h-screen bg-gradient-to-b from-teal-600 to-cyan-400 flex flex-col py-4">
      <h1 className="text-lg font-bold px-4 mb-4 text-white">AgriSense</h1>
      <nav className="flex flex-col gap-1">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-teal-800 text-white'
                  : 'text-white/90 hover:bg-teal-700/50'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
