import { useState } from 'react'
import { MEMBERS, computeRoundDetails, fmtDate } from '../lib/handicap.js'
import RoundFields from './RoundFields.jsx'

function toDraft(round) {
  return {
    date: round.date,
    course: round.course || '',
    scores: Object.fromEntries(MEMBERS.map((m) => [m, round.scores[m] ?? ''])),
  }
}

function RoundDetail({ round }) {
  return (
    <div className="table-scroll">
      <table className="data">
        <caption className="sr-only">{fmtDate(round.date)} 라운드 순위</caption>
        <thead>
          <tr>
            <th scope="col">순위</th>
            <th scope="col">그로스</th>
            <th scope="col">핸디</th>
            <th scope="col">넷</th>
          </tr>
        </thead>
        <tbody>
          {round.entries.map((e) => (
            <tr key={e.member}>
              <th scope="row">
                <span className="rank-cell">
                  <span className="rank-no" data-first={e.rank === 1}>{e.rank}</span>
                  {e.member}
                </span>
              </th>
              <td>{e.gross}</td>
              <td>{e.handicap > 0 ? `-${e.handicap}` : '0'}</td>
              <td className="net-val">{e.net}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RoundEditor({ round, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => toDraft(round))
  const [error, setError] = useState('')

  const submit = () => {
    if (!draft.date) return setError('날짜를 입력해 주세요.')
    const entered = MEMBERS.map((m) => draft.scores[m]).filter((v) => v !== '' && v !== null)
    if (entered.length === 0) return setError('최소 한 명의 타수를 입력해 주세요.')
    if (entered.some((v) => !Number.isFinite(Number(v)) || Number(v) < 50 || Number(v) > 200))
      return setError('타수는 50~200 사이의 숫자로 입력해 주세요.')

    const scores = {}
    for (const m of MEMBERS) {
      const v = draft.scores[m]
      scores[m] = v === '' || v === null ? null : Number(v)
    }
    onSave({ ...round, date: draft.date, course: draft.course.trim(), scores })
  }

  return (
    <div style={{ padding: '12px 0 4px' }}>
      {error && <div className="notice error" role="alert">{error}</div>}
      <RoundFields value={draft} onChange={setDraft} idPrefix={`edit-${round.id}`} />
      <div className="round-actions">
        <button className="btn" onClick={onCancel}>취소</button>
        <button className="btn primary" onClick={submit}>저장</button>
      </div>
    </div>
  )
}

export default function RoundList({ rounds, onUpdate, onDelete, limit }) {
  const [openId, setOpenId] = useState(null)
  const [editId, setEditId] = useState(null)

  const details = computeRoundDetails(rounds).reverse()
  const shown = limit ? details.slice(0, limit) : details

  if (shown.length === 0) {
    return (
      <div className="card empty">
        <strong>아직 기록이 없습니다</strong>
        “입력” 탭에서 첫 라운드를 추가해 보세요.
      </div>
    )
  }

  return (
    <div className="round-list">
      {shown.map((r) => {
        const open = openId === r.id
        const editing = editId === r.id
        const winner = r.entries[0]

        return (
          <div className="round" key={r.id}>
            <button
              className="round-head"
              onClick={() => { setOpenId(open ? null : r.id); setEditId(null) }}
              aria-expanded={open}
            >
              <span>
                <span className="round-date">{fmtDate(r.date)}</span>
                <span className="round-course" style={{ display: 'block' }}>
                  {r.course || '골프장 미입력'} · {r.entries.length}명
                </span>
              </span>
              <span className="round-winner">
                {winner && (
                  <>
                    <span className="trophy" aria-hidden="true">🏆</span>
                    <b>{winner.member}</b>
                    <span className="round-course">넷 {winner.net}</span>
                  </>
                )}
                <span className="chev" data-open={open} aria-hidden="true">▾</span>
              </span>
            </button>

            {open && (
              <div className="round-body">
                {editing ? (
                  <RoundEditor
                    round={r}
                    onCancel={() => setEditId(null)}
                    onSave={(next) => { onUpdate(next); setEditId(null) }}
                  />
                ) : (
                  <>
                    <RoundDetail round={r} />
                    <div className="round-actions">
                      <button className="btn sm" onClick={() => setEditId(r.id)}>수정</button>
                      <button
                        className="btn sm danger"
                        onClick={() => {
                          if (confirm(`${fmtDate(r.date)} 라운드를 삭제할까요?`)) onDelete(r.id)
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
