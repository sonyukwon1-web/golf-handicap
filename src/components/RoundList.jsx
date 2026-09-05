import { useState } from 'react'
import { MEMBERS, computeRoundDetails, fmtDate } from '../lib/handicap.js'
import { FRONT, HOLES, grossOf, hasHoleData, overTotal, parTotal } from '../lib/holes.js'

const fmtOver = (v) => (v > 0 ? `+${v}` : String(v))
import RoundFields from './RoundFields.jsx'

const NINES = [
  { key: 'front', label: '전반', from: 0, to: FRONT },
  { key: 'back', label: '후반', from: FRONT, to: HOLES },
]

/** 저장된 홀별 기록을 읽기 전용 표로 보여준다 */
function HoleTable({ round }) {
  const has = (m) => (round.holes?.[m] || []).some((v) => Number.isFinite(v))
  // 카드에 적혀 있던 순서를 그대로 따른다
  const players = (round.order?.length ? round.order : MEMBERS).filter(has)
    .concat(MEMBERS.filter((m) => has(m) && !(round.order || []).includes(m)))
    .filter((m, i, a) => a.indexOf(m) === i)

  return (
    <details className="round-holes">
      <summary>홀별 기록 보기</summary>
      {NINES.map(({ key, label, from, to }) => (
        <div className="table-scroll" key={key}>
          <table className="score-grid readonly">
            <colgroup>
              <col className="name" />
              {Array.from({ length: to - from }, (_, k) => <col className="hole" key={k} />)}
              <col className="over" />
              <col className="total" />
            </colgroup>
            <caption>
              {label} 9홀
              {key === 'front' && round.courseFront ? ` · ${round.courseFront}` : ''}
              {key === 'back' && round.courseBack ? ` · ${round.courseBack}` : ''}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="rowhead">HOLE</th>
                {Array.from({ length: to - from }, (_, k) => <th scope="col" key={k}>{from + k + 1}</th>)}
                <th scope="col" className="ocol" title="파 대비 오버 합계">±</th>
                <th scope="col" className="tcol">T</th>
              </tr>
            </thead>
            <tbody>
              <tr className="par-row">
                <th scope="row" className="rowhead">PAR</th>
                {Array.from({ length: to - from }, (_, k) => <td key={k}>{round.pars[from + k]}</td>)}
                <td className="ocol" />
                <td className="tcol">{parTotal(round.pars, from, to)}</td>
              </tr>
              {players.map((m) => (
                <tr key={m}>
                  <th scope="row" className="rowhead">{m}</th>
                  {Array.from({ length: to - from }, (_, k) => {
                    const v = round.holes[m][from + k]
                    return (
                      <td key={k} className={v < 0 ? 'under' : v >= 3 ? 'blowup' : ''}>
                        {Number.isFinite(v) ? v : '·'}
                      </td>
                    )
                  })}
                  <td className="ocol">{fmtOver(overTotal(round.holes[m], from, to))}</td>
                  <td className="tcol">{grossOf(round.pars, round.holes[m], from, to).strokes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </details>
  )
}

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
                  {r.course || '골프장 미입력'}
                  {r.courseFront && ` · ${r.courseFront}${r.courseBack ? `-${r.courseBack}` : ''}`}
                  {r.teeTime && ` · ${r.teeTime}`}
                  {' · '}{r.entries.length}명
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
                    {hasHoleData(r) && <HoleTable round={r} />}
                    {r.penalty && (
                      <p className="penalty-tag">
                        🎯 <b>{r.penalty.members.join(', ')}</b> — {r.penalty.text}
                      </p>
                    )}
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
