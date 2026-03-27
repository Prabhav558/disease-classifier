import { useEffect, useRef, useState } from 'react'
import api from '../api/client'
import useVoice from '../hooks/useVoice'
import PageTransition from '../components/PageTransition'

const ACTION_ICONS = {
  dismiss_alert:       '🔕',
  start_water_supply:  '💧',
  stop_water_supply:   '🚱',
  create_schedule:     '🕐',
  delete_schedule:     '🗑️',
  list_schedules:      '📋',
  list_alerts:         '🔔',
  get_sensor_readings: '📡',
  get_farm_info:       '🌾',
  get_water_status:    '💧',
}

function ActionBadge({ action }) {
  return (
    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-500">
      <span className="text-amber-600 font-mono font-semibold">
        {ACTION_ICONS[action.tool] || '⚙'} {action.tool}
      </span>
      {Object.keys(action.args).length > 0 && (
        <span className="ml-2 text-slate-400">
          ({Object.entries(action.args).map(([k, v]) => `${k}: ${v}`).join(', ')})
        </span>
      )}
      <div className="mt-1 text-emerald-600 truncate" title={action.result}>
        ✓ {action.result.length > 80 ? action.result.slice(0, 80) + '…' : action.result}
      </div>
    </div>
  )
}

function Message({ msg, onSpeak, isSpeaking }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white">A</div>
            <span className="text-xs text-slate-400 font-medium">AgriBot</span>
            <button
              onClick={() => onSpeak(msg.content)}
              className="text-xs text-slate-300 hover:text-emerald-500 transition-colors"
              title="Read aloud"
            >
              {isSpeaking ? '🔊' : '🔈'}
            </button>
          </div>
        )}
        <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
          isUser
            ? 'bg-emerald-600 text-white rounded-br-sm'
            : 'bg-white border border-slate-100 text-slate-800 shadow-sm rounded-bl-sm'
        }`}>
          {msg.content}
        </div>
        {msg.actions?.length > 0 && (
          <div className="mt-1 space-y-1">
            {msg.actions.map((a, i) => <ActionBadge key={i} action={a} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function WaveformIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0,1,2,3,4].map(i => (
        <div key={i} className="voice-wave-bar" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
      <span className="ml-2 text-sm text-red-500 font-medium animate-pulse">Listening…</span>
    </div>
  )
}

const SUGGESTIONS = [
  'What alerts are active right now?',
  'Start irrigation for zone 1',
  'Schedule watering at 6:00 AM daily',
  'Stop all irrigation',
  'Show sensor readings for zone 2',
  'What is the current farm setup?',
]

export default function ChatPage() {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: "Hi! I'm AgriBot, your AI agricultural assistant. I can answer questions about your crops and take actions — like dismissing alerts, starting irrigation, or setting up schedules.\n\nWhat can I help you with today?",
    actions: [],
  }])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  const { isListening, transcript, sttError, sttSupported, startListening, stopListening,
          isSpeaking, autoSpeak, ttsSupported, speak, stopSpeaking, toggleAutoSpeak } = useVoice()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (transcript) setInput(transcript) }, [transcript])

  const prevListening = useRef(false)
  useEffect(() => {
    if (prevListening.current && !isListening && transcript.trim()) sendMessage(transcript.trim())
    prevListening.current = isListening
  }, [isListening])

  const sendMessage = async (text) => {
    const userText = (text || input).trim()
    if (!userText) return
    const history = messages.filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { role: 'user', content: userText, actions: [] }])
    setInput(''); setLoading(true)
    try {
      const { data } = await api.post('/chat', { message: userText, history })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, actions: data.actions_taken || [] }])
      if (autoSpeak && data.reply) speak(data.reply)
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.response?.data?.detail || err.message}`,
        actions: [],
      }])
    } finally { setLoading(false) }
  }

  return (
    <PageTransition className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">AI Assistant</h2>
          <p className="text-sm text-slate-500 mt-1">
            Ask questions or give commands — AgriBot can dismiss alerts, control irrigation, set schedules, and more.
          </p>
        </div>
        {ttsSupported && (
          <button
            onClick={toggleAutoSpeak}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              autoSpeak
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            {autoSpeak ? '🔊' : '🔇'} Auto-speak
          </button>
        )}
      </div>

      {sttError && (
        <div className="mb-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{sttError}</div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto pr-1">
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} onSpeak={speak} isSpeaking={isSpeaking} />
        ))}
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
              <span className="ml-2 text-sm text-slate-400">AgriBot is thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {isListening && <WaveformIndicator />}

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => sendMessage(s)}
              className="text-xs bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-full px-3 py-1.5 text-slate-600 transition-colors font-medium">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="flex gap-2 pt-3 border-t border-slate-100">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder={isListening ? 'Listening… speak now' : 'Ask AgriBot anything, or give a command…'}
          rows={2}
          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-slate-400"
        />
        {sttSupported && (
          <button
            onClick={() => isListening ? stopListening() : startListening()}
            disabled={loading}
            className={`w-10 rounded-xl transition-all flex items-center justify-center text-lg disabled:opacity-40 ${
              isListening ? 'bg-red-500 hover:bg-red-600 voice-pulse-ring' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            {isListening ? '⏹️' : '🎙️'}
          </button>
        )}
        {isSpeaking && (
          <button onClick={stopSpeaking}
            className="w-10 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors flex items-center justify-center text-lg">
            🔇
          </button>
        )}
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white px-5 rounded-xl transition-colors font-semibold text-sm"
        >
          Send
        </button>
      </div>
    </PageTransition>
  )
}
