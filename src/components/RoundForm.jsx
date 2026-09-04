import { useState } from 'react'
import { MEMBERS, fmtDate } from '../lib/handicap.js'
import { newId } from '../lib/storage.js'
import RoundFields from './RoundFields.jsx'

const today = () => new Date().toISOString().slice(0, 10)

const blankDraft = (date = today()) => ({
  key: newId(),
  date,
  course: '',
  scores: Object.fromEntries(MEMBERS.map((m) => [m, ''])),
})

/** 입력값이 라운드로 저장될 수 있는지 (날짜 + 최소 1명의 유효 스코어) */
function draftIssue(d) {
  if (!d.date) return '날짜를 입력해 주세요.'
  const nums = MEMBERS.map((m) => d.scores[m]).filter((v) => v !== '' && v !== null)
  if (nums.length === 0) return '최소 한 명의 타수를 입력해 주세요.'
  if (nums.some((v) => !Number.isFinite(Number(v)) || Number(v) < 50 || Number(v) > 200))
    return '타수는 50~200 사이의 숫자로 입력해 주세요.'
  return null
}

function toRound(d, i) {
  const scores = {}
  for (const m of MEMBERS) {
    const v = d.scores[m]
    scores[m] = v === '' || v === null ? null : Number(v)
  }
  return { id: newId(), date: d.date, course: d.course.trim(), scores, createdAt: Date.now() + i }
}

export default function RoundForm({ onSave }) {
  const [drafts, setDrafts] = useState([blankDraft()])
  const [error, setError] = useState('')

  const update = (key, next) => {
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...next, key } : d)))
    setError('')
  }

  const addRow = () => {
    setDrafts((ds) => [...ds, blankDraft(ds[ds.length - 1]?.date || today())])
  }

  const removeRow = (key) => setDrafts((ds) => (ds.length === 1 ? ds : ds.filter((d) => d.key !== key)))

  const submit = (e) => {
    e.preventDefault()

    // 완전히 비어 있는 행은 조용히 건너뛰고, 부분 입력된 행만 검사한다
    const touched = drafts.filter((d) => MEMBERS.some((m) => d.scores[m] !== '') || d.course.trim())
    if (touched.length === 0) {
      setError('저장할 내용이 없습니다. 타수를 입력해 주세요.')
      return
    }

    for (const [i, d] of touched.entries()) {
      const issue = draftIssue(d)
      if (issue) {
        setError(`${i + 1}번째 라운드: ${issue}`)
        return
      }
    }

    const { added, skipped } = onSave(touched.map(toRound)) || {}

    if (skipped?.length) {
      const { existing } = skipped[0]
      setError(
        `${skipped.length}개가 이미 등록된 라운드입니다 — ${fmtDate(existing.date)}` +
        `${existing.course ? ` ${existing.course}` : ''}. ` +
        (added?.length ? `나머지 ${added.length}개만 저장했습니다.` : '저장하지 않았습니다.'),
      )
      if (!added?.length) return
    } else {
      setError('')
    }

    setDrafts([blankDraft(touched[touched.length - 1].date)])
  }

  return (
    <form onSubmit={submit} noValidate>
      {error && <div className="notice error" role="alert">{error}</div>}

      {drafts.map((d, i) => (
        <div className="card entry-card" key={d.key}>
          <div className="entry-top">
            <span className="entry-no">라운드 {i + 1}</span>
            {drafts.length > 1 && (
              <button type="button" className="btn sm danger" onClick={() => removeRow(d.key)}>
                삭제
              </button>
            )}
          </div>
          <RoundFields value={d} onChange={(next) => update(d.key, next)} idPrefix={`new-${d.key}`} />
        </div>
      ))}

      <div className="form-foot">
        <button type="button" className="btn" onClick={addRow}>+ 라운드 추가</button>
        <button type="submit" className="btn primary">저장</button>
      </div>

      <p className="foot-note">
        과거 스코어카드를 한 번에 넣으려면 “라운드 추가”로 칸을 늘린 뒤 한 번에 저장하세요.
        저장 순서와 관계없이 날짜순으로 정렬됩니다.
      </p>
    </form>
  )
}
