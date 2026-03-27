import { useEffect, useRef, useState } from 'react'
import api from '../api/client'

const ACTION_ICONS = {
  dismiss_alert: '🔕',
  start_water_supply: '💧',
  stop_water_supply: '🚱',
  create_schedule: '🕐',
  delete_schedule: '🗑️',
  list_schedules: '📋',
  list_alerts: '🔔',
  get_sensor_readings: '📡',
  get_farm_info: '🌾',
  get_water_status: '💧',
}

function ActionBadge({ action }) {
  const icon = ACTION_ICONS[action.tool] || '⚙️'
  return (
    <div className="mt-2 bg-gray-900 border border-gray-700 rounded p-2 text-xs text-gray-400">
      <span className="text-yellow-400 font-mono">{icon} {action.tool}</span>
      {Object.keys(action.args).length > 0 && (
        <span className="ml-2 text-gray-500">
          ({Object.entries(action.args).map(([k, v]) => `${k}: ${v}`).join(', ')})
        </span>
      )}
      <div className="mt-1 text-green-400 truncate" title={action.result}>
        ✓ {action.result.length > 80 ? action.result.slice(0, 80) + '…' : action.result}
      </div>
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-teal-600 flex items-center justify-center text-xs font-bold">A</div>
            <span className="text-xs text-gray-400">AgriBot</span>
          </div>
        )}
        <div className={`rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? 'bg-teal-700 text-white rounded-br-none'
            : 'bg-gray-800 text-gray-100 rounded-bl-none'
        }`}>
          {msg.content}
        </div>
        {msg.actions && msg.actions.length > 0 && (
          <div className="mt-1 space-y-1">
            {msg.actions.map((a, i) => <ActionBadge key={i} action={a} />)}
          </div>
        )}
      </div>
    </div>
  )
}

const SUGGESTIONS = [
  'What alerts are active right now?',
  'Start irrigation for zone 1',
  'Schedule watering at 6:00 AM daily',
  'Stop all irrigation',
  'Show me the sensor readings for zone 2',
  'The alert in zone 3 is a false alarm, dismiss it',
  'What is the current farm setup?',
  'Show all schedules',
]

export default function ChatPage() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm AgriBot, your AI agricultural assistant. I can answer questions about your crops and also take actions — like dismissing alerts, starting irrigation, or setting up schedules.\n\nWhat can I help you with today?",
      actions: [],
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const userText = (text || input).trim()
    if (!userText) return

    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))

    setMessages(prev => [...prev, { role: 'user', content: userText, actions: [] }])
    setInput('')
    setLoading(true)

    try {
      const { data } = await api.post('/chat', { message: userText, history })
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.reply, actions: data.actions_taken || [] },
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${err.response?.data?.detail || err.message}`,
          actions: [],
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">AI Assistant</h2>
        <p className="text-sm text-gray-400 mt-1">
          Ask questions or give commands — AgriBot can dismiss alerts, control irrigation, set schedules, and more.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto pr-1">
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}

        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-800 rounded-lg px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
              <span className="animate-pulse">●</span>
              <span className="animate-pulse delay-75">●</span>
              <span className="animate-pulse delay-150">●</span>
              <span className="ml-1">AgriBot is thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions (only on fresh chat) */}
      {messages.length <= 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s)}
              className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-full px-3 py-1 text-gray-300 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t border-gray-700">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AgriBot anything, or give a command…"
          rows={2}
          className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-teal-500"
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 text-white px-4 rounded-lg transition-colors font-medium text-sm"
        >
          Send
        </button>
      </div>
    </div>
  )
}
