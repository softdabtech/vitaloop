function pad(n) {
  return String(n).padStart(2, '0')
}

function toICSDate(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
}

function icsEscape(text) {
  return String(text || '').replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')
}

export function downloadICS({ title, description, date }) {
  if (typeof window === 'undefined' || !date) return

  const dt = toICSDate(date)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VITALOOP//Checkup Reminder//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}-checkup@vitaloop.today`,
    `DTSTAMP:${toICSDate(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${dt}`,
    `DTEND;VALUE=DATE:${dt}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'vitaloop-checkup-reminder.ics'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function googleCalendarUrl({ title, description, date }) {
  if (!date) return null

  const nextDay = new Date(date)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toICSDate(date)}/${toICSDate(nextDay)}`,
    details: description,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// Parses the first integer out of a free-text timing window (e.g. "8-12
// weeks" -> 8, "After ~10 weeks" -> 10) -- these strings are clinician-
// authored ranges, not exact dates, so this only gives a reasonable default
// the user can still adjust before saving the event.
export function parseWeeksFromTiming(timing) {
  const match = String(timing || '').match(/(\d+)/)
  return match ? Number(match[1]) : null
}

export function addWeeks(baseDate, weeks) {
  const date = new Date(baseDate)
  date.setUTCDate(date.getUTCDate() + weeks * 7)
  return date
}
