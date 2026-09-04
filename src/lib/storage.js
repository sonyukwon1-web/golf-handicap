import { MEMBERS, isScore } from './handicap.js'

const KEY = 'golf-handicap:v1'

export const DEFAULT_PENALTIES = ['밥 사기', '커피 사기', '다음 라운드 캐디피 내기']

export const emptyData = () => ({
  version: 2,
  members: MEMBERS,
  rounds: [],
  penalties: [...DEFAULT_PENALTIES],
})

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 외부(파일/스토리지)에서 들어온 값을 신뢰하지 않고 정규화한다 */
export function normalize(raw) {
  if (!raw || typeof raw !== 'object') return emptyData()
  const rounds = Array.isArray(raw.rounds) ? raw.rounds : []

  const clean = rounds
    .filter((r) => r && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    .map((r, i) => {
      const scores = {}
      for (const m of MEMBERS) {
        const v = Number(r.scores?.[m])
        scores[m] = r.scores?.[m] === null || r.scores?.[m] === '' || !Number.isFinite(v) ? null : v
      }
      // 벌칙은 나중에 붙은 항목이라 없을 수 있다
      const penalty =
        r.penalty && typeof r.penalty.text === 'string' && Array.isArray(r.penalty.members)
          ? { text: r.penalty.text, members: r.penalty.members.filter((m) => MEMBERS.includes(m)) }
          : null

      return {
        id: typeof r.id === 'string' && r.id ? r.id : newId(),
        date: r.date,
        course: typeof r.course === 'string' ? r.course : '',
        scores,
        createdAt: Number.isFinite(Number(r.createdAt)) ? Number(r.createdAt) : i,
        penalty,
      }
    })
    .filter((r) => MEMBERS.some((m) => isScore(r.scores[m])))

  const penalties = Array.isArray(raw.penalties)
    ? [...new Set(raw.penalties.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim()))]
    : [...DEFAULT_PENALTIES]

  return { version: 2, members: MEMBERS, rounds: clean, penalties }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyData()
    return normalize(JSON.parse(raw))
  } catch {
    return emptyData()
  }
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function exportFile(data) {
  const stamp = new Date().toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `낙원골프_${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function importFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        const data = normalize(parsed)
        if (data.rounds.length === 0) throw new Error('유효한 라운드 기록이 없습니다.')
        resolve(data)
      } catch (e) {
        reject(new Error(`파일을 읽을 수 없습니다: ${e.message}`))
      }
    }
    reader.onerror = () => reject(new Error('파일을 읽는 중 오류가 발생했습니다.'))
    reader.readAsText(file)
  })
}
