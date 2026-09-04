import { useEffect, useMemo, useRef, useState } from 'react'
import { suggestAssignment } from '../lib/scorecard.js'

/**
 * 스코어카드에 성만 찍혀 나온 탓에 누가 누군지 알 수 없는 묶음을 사람이 골라주는 팝업.
 * (최진규 / 최문창처럼 성이 같은 경우. 동타면 애초에 여기까지 오지 않는다)
 */
export default function NameResolver({ groups, stats, onConfirm, onCancel }) {
  const suggestions = useMemo(
    () => groups.map((g) => suggestAssignment(g, stats)),
    [groups, stats],
  )

  // picks[groupIndex][entryIndex] = 멤버 이름
  const [picks, setPicks] = useState(() =>
    groups.map((g, gi) => {
      const suggested = suggestions[gi]
      if (!suggested) return g.entries.map(() => null)
      return g.entries.map((e) => {
        const hit = Object.entries(suggested).find(([, score]) => score === e.score)
        return hit ? hit[0] : null
      })
    }),
  )

  const dialogRef = useRef(null)
  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  /** 같은 사람을 두 번 고를 수 없으므로, 이미 쓰인 자리와 서로 바꾼다 */
  const choose = (gi, ei, member) =>
    setPicks((prev) =>
      prev.map((row, i) => {
        if (i !== gi) return row
        const taken = row.indexOf(member)
        const next = [...row]
        if (taken !== -1 && taken !== ei) next[taken] = next[ei]
        next[ei] = member
        return next
      }),
    )

  const complete = picks.every((row, gi) => {
    const chosen = row.filter(Boolean)
    return chosen.length === groups[gi].entries.length && new Set(chosen).size === chosen.length
  })

  const confirm = () => {
    const result = {}
    groups.forEach((g, gi) =>
      g.entries.forEach((e, ei) => {
        if (picks[gi][ei]) result[picks[gi][ei]] = e.score
      }),
    )
    onConfirm(result)
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolver-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <h2 id="resolver-title" className="modal-title">누구의 타수인지 골라 주세요</h2>
        <p className="modal-desc">
          스코어카드에 성만 찍혀 있어 구분할 수 없습니다. 타수마다 이름을 눌러 지정하세요. 건너뛰면 이 두 칸만 비워 둡니다.
        </p>

        {groups.map((g, gi) => (
          <div className="resolve-group" key={g.surname}>
            {g.entries.map((e, ei) => (
              <div className="resolve-row" key={`${e.score}-${ei}`}>
                <span className="resolve-score">
                  {e.score}
                  <small>타</small>
                </span>
                <div className="segmented" role="group" aria-label={`${e.score}타를 친 멤버`}>
                  {g.candidates.map((m) => {
                    const selected = picks[gi][ei] === m
                    const recommended = suggestions[gi]?.[m] === e.score
                    return (
                      <button
                        type="button"
                        key={m}
                        aria-pressed={selected}
                        onClick={() => choose(gi, ei, m)}
                      >
                        {m}
                        {recommended && <span className="rec">추천</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}

        {suggestions.some(Boolean) && (
          <p className="modal-hint">추천은 최근 평균 타수가 낮은 분에게 낮은 타수를 붙인 것입니다.</p>
        )}

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onCancel}>건너뛰기</button>
          <button type="button" className="btn primary" onClick={confirm} disabled={!complete}>
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
