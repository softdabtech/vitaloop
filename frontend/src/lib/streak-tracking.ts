export interface StreakData {
  currentStreak: number
  longestStreak: number
  lastCheckInDate: Date | null
  checkInDates: string[]
  totalCheckIns: number
  weeklyData: Record<string, boolean> // "YYYY-MM-DD": true/false
}

export function calculateStreak(checkInDates: string[]): StreakData {
  const sortedDates = checkInDates
    .map(d => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime())

  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0

  // Start from today and go backwards
  let currentDate = new Date()
  currentDate.setHours(0, 0, 0, 0)

  // Check if today has a check-in
  const todayStr = currentDate.toISOString().split('T')[0]
  const hasTodayCheckIn = checkInDates.some(d => d.startsWith(todayStr))

  // Determine starting point for streak
  let checkIndex = 0
  if (!hasTodayCheckIn) {
    // If no check-in today, look for yesterday
    currentDate.setDate(currentDate.getDate() - 1)
  }

  // Count consecutive days
  while (checkIndex < sortedDates.length) {
    const checkDate = new Date(sortedDates[checkIndex])
    checkDate.setHours(0, 0, 0, 0)

    const dayDiff = Math.floor((currentDate.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24))

    if (dayDiff === 0) {
      tempStreak++
      currentDate.setDate(currentDate.getDate() - 1)
      checkIndex++
    } else if (dayDiff === 1) {
      tempStreak++
      currentDate.setDate(currentDate.getDate() - 1)
      checkIndex++
    } else {
      break
    }
  }

  currentStreak = tempStreak

  // Calculate longest streak (brute force for now, can optimize with binary search)
  let tempLongestStreak = 0
  tempStreak = 0

  for (let i = sortedDates.length - 1; i >= 0; i--) {
    if (i === sortedDates.length - 1) {
      tempStreak = 1
    } else {
      const curr = new Date(sortedDates[i])
      const next = new Date(sortedDates[i + 1])
      curr.setHours(0, 0, 0, 0)
      next.setHours(0, 0, 0, 0)

      const dayDiff = Math.floor((next.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24))

      if (dayDiff === 1) {
        tempStreak++
      } else {
        tempLongestStreak = Math.max(tempLongestStreak, tempStreak)
        tempStreak = 1
      }
    }
  }

  longestStreak = Math.max(tempLongestStreak, tempStreak)

  return {
    currentStreak,
    longestStreak,
    lastCheckInDate: sortedDates[0] || null,
    checkInDates,
    totalCheckIns: sortedDates.length,
    weeklyData: generateWeeklyData(checkInDates),
  }
}

function generateWeeklyData(checkInDates: string[]): Record<string, boolean> {
  const data: Record<string, boolean> = {}

  // Last 7 weeks
  for (let i = 0; i < 49; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    data[dateStr] = checkInDates.some(d => d.startsWith(dateStr))
  }

  return data
}

export function getStreakMessage(streak: number): string {
  if (streak === 0) return 'Start your streak today!'
  if (streak === 1) return '🔥 Keep it going!'
  if (streak < 7) return '🔥 You\'re on fire!'
  if (streak < 30) return '🌟 Unstoppable!'
  if (streak < 100) return '🏆 Legend status!'
  return '👑 All-time legend!'
}

export function getStreakEmoji(streak: number): string {
  if (streak === 0) return '❄️'
  if (streak < 3) return '🔥'
  if (streak < 7) return '🔥🔥'
  if (streak < 14) return '🔥🔥🔥'
  if (streak < 30) return '⭐'
  if (streak < 100) return '🏆'
  return '👑'
}
