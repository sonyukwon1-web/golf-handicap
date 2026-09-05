import { useEffect, useRef, useState } from 'react'
import { josaWith } from '../lib/josa.js'

const NINE = 9

/** 한 나인의 오버 합계 — 못 읽은 칸은 0으로 본다 */
const overOf = (arr) => arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
/** +3 · E · -1 꼴로 (파는 숫자 0 보다 E 가 골프장 표기다) */
const fmtOver = (n) => (n === 0 ? 'E' : n > 0 ? `+${n}` : String(n))

/**
 * 성이 겹쳐 카드로 구분할 수 없는 줄의 주인을 고르는 팝업.
 *
 * 총타수가 같아도 홀별 기록은 다르므로, 각 줄의 스코어카드를 함께 보여 준다.
 * 그걸 봐야 누가 누군지 가릴 수 있다.
 */
export default function NamePicker({ rows, card, onConfirm, onCancel }) {
  const [picks, setPicks] = useState(() => rows.map(() => ''))
  const dialogRef = useRef(null)

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  /** 두 줄에 같은 사람을 넣을 수 없다. 하나를 고르면 나머지는 저절로 정해진다. */
  const choose = (index, member) =>
    setPicks((prev) => {
      const next = prev.map((p) => (p === member ? '' : p))
      next[index] = member

      const pair = rows[index].candidates
      if (rows.length === 2 && pair.length === 2) {
        const other = index === 0 ? 1 : 0
        next[other] = pair.find((m) => m !== member) || ''
      }
      return next
    })

  const tied = rows.length === 2 && rows[0].total === rows[1].total
  const ready = picks.every(Boolean) && new Set(picks).size === picks.length

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal picker" role="dialog" aria-modal="true" aria-labelledby="picker-title" tabIndex={-1} ref={dialogRef}>
        <h2 id="picker-title" className="modal-title">누구의 기록인지 골라 주세요</h2>
        {/*
          ══════════════════════════════════════════════════════════
          **어느 카드를 보고 고르는 것인지 늘 적는다.**

          여태 읽은 값만 이어 붙여 적었더니, 넷 다 못 읽으면 줄 자체가 사라져
          **아무 표시 없이** 이름만 고르게 됐다. 여러 장을 이어 올릴 때는 지금
          몇 번째 카드인지조차 알 수 없다.

          못 읽은 것은 지우지 않고 **'모름' 이라고 적는다** — 비어 있다는 사실이
          그 자리에서 보여야 저장 전에 채울 수 있다.
          ══════════════════════════════════════════════════════════
        */}
        {card && (
          <dl className="picker-card">
            {[
              ['날짜', card.date],
              ['골프장', card.course],
              ['코스', [card.courseFront, card.courseBack].filter(Boolean).join(' - ')],
              ['티오프', card.teeTime],
            ].map(([label, v]) => (
              <div key={label} className="pc-item">
                <dt>{label}</dt>
                <dd data-unread={!v || undefined}>{v || '모름'}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="modal-desc">
          카드에 <b>{josaWith(rows[0].label, '이/가')}</b> 두 줄이라 앱이 구분할 수 없습니다.{' '}
          {tied
            ? <>두 분의 <b>총타수가 같으니</b> 홀별 기록을 보고 골라 주세요.</>
            : <>타수를 보고 이름을 눌러 주세요.</>}
        </p>

        {rows.map((row, i) => (
          <div className={`pick-row ${picks[i] ? 'done' : ''}`} key={i}>
            <div className="pick-head">
              <span className="pick-total">{row.total ?? '–'}<small>타</small></span>
              <div className="segmented" role="group" aria-label={`${row.total ?? ''}타를 친 사람`}>
                {row.candidates.map((m) => (
                  <button
                    type="button"
                    key={m}
                    aria-pressed={picks[i] === m}
                    onClick={() => choose(i, picks[i] === m ? '' : m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <table className="map-card">
              <colgroup>
                <col className="name" />
                {Array.from({ length: NINE }, (_, k) => <col className="hole" key={k} />)}
                <col className="over" />
                <col className="total" />
              </colgroup>
              <thead>
                <tr>
                  <th />
                  {Array.from({ length: NINE }, (_, k) => <th key={k}>{k + 1}</th>)}
                  {/* 오버 합계는 T 바로 앞에 — '몇 오버로 몇 타' 가 한 눈에 이어진다 */}
                  <th className="ov">±</th>
                  <th className="t">T</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: '전반', from: 0, total: row.frontTotal },
                  { label: '후반', from: NINE, total: row.backTotal },
                ].map(({ label, from, total }) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {row.overs.slice(from, from + NINE).map((v, k) => (
                      <td key={k} className={v === null ? 'miss' : v < 0 ? 'under' : v >= 3 ? 'blowup' : ''}>
                        {v === null ? '·' : v}
                      </td>
                    ))}
                    <td className="ov">{fmtOver(overOf(row.overs.slice(from, from + NINE)))}</td>
                    <td className="t">{Number.isFinite(total) ? total : '–'}</td>
                  </tr>
                ))}
                {/* 카드에 없는 줄이지만, 고를 때 보는 것은 결국 이 두 수다 */}
                <tr className="sum">
                  <th scope="row">합계</th>
                  <td colSpan={NINE} />
                  <td className="ov">{fmtOver(overOf(row.overs))}</td>
                  <td className="t">{row.total ?? '–'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onCancel}>나중에</button>
          <button type="button" className="btn primary" onClick={() => onConfirm(picks)} disabled={!ready}>
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
