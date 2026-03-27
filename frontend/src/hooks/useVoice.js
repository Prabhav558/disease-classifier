/**
 * useVoice — Custom hook for browser-native Speech-to-Text and Text-to-Speech.
 *
 * STT uses the Web Speech API (SpeechRecognition).
 * TTS uses the Web Speech API (speechSynthesis).
 *
 * Browser support: Chrome, Edge, Safari. Firefox has partial/no support.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

export default function useVoice() {
  // ── STT state ──────────────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [sttError, setSttError] = useState(null)
  const recognitionRef = useRef(null)

  // ── TTS state ──────────────────────────────────────────────────────────────
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const utteranceRef = useRef(null)

  const sttSupported = !!SpeechRecognition
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // ── STT helpers ────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!sttSupported) {
      setSttError('Speech recognition is not supported in this browser.')
      return
    }

    setSttError(null)
    setTranscript('')

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }
      setTranscript(finalText || interimText)
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        setSttError('No speech detected. Please try again.')
      } else if (event.error === 'not-allowed') {
        setSttError('Microphone access denied. Please allow microphone access.')
      } else {
        setSttError(`Speech error: ${event.error}`)
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [sttSupported])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }, [])

  // ── TTS helpers ────────────────────────────────────────────────────────────
  const speak = useCallback(
    (text) => {
      if (!ttsSupported || !text) return

      // Cancel any ongoing speech
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0
      utterance.pitch = 1.0

      // Try to pick a natural-sounding English voice
      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(
        (v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('natural')
      )
      if (preferred) utterance.voice = preferred

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)

      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [ttsSupported]
  )

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
  }, [ttsSupported])

  const toggleAutoSpeak = useCallback(() => {
    setAutoSpeak((prev) => !prev)
  }, [])

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort()
      if (ttsSupported) window.speechSynthesis.cancel()
    }
  }, [ttsSupported])

  return {
    // STT
    isListening,
    transcript,
    sttError,
    sttSupported,
    startListening,
    stopListening,

    // TTS
    isSpeaking,
    autoSpeak,
    ttsSupported,
    speak,
    stopSpeaking,
    toggleAutoSpeak,
  }
}
