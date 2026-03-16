import { useState, useEffect } from 'react'

export interface CountdownResult {
  secondsLeft: number
  h: number
  m: number
  s: number
}

export function useCountdown(target: string | null): CountdownResult | null {
  const [secondsLeft, setSecondsLeft] = useState<number>(0)

  useEffect(() => {
    if (!target) return
    const targetDate = new Date(target)
    function tick() {
      const diff = Math.max(0, Math.floor((targetDate.getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])

  if (!target) return null

  return {
    secondsLeft,
    h: Math.floor(secondsLeft / 3600),
    m: Math.floor((secondsLeft % 3600) / 60),
    s: secondsLeft % 60,
  }
}
