/**
 * 순위를 어떻게 매길지 — **순위가 있는 화면마다 맨 위에 선다.**
 *
 * 홈에만 두었더니, 랭킹이나 라운드 목록을 보다가 '이거 핸디 적용된 건가?' 를
 * 확인하려면 홈으로 돌아가야 했다. 순위를 보는 자리에 켜고 끄는 자리가 함께
 * 있어야, 바꾼 결과를 그 자리에서 본다.
 *
 * 담기는 값은 하나뿐이라(App 의 ranking) 어느 화면에서 켜든 전부 따라온다.
 */
export default function RankOptions({ ranking, onRanking, stats, members = [] }) {
  /* 기준(0)이 앞, 그 뒤로 적게 깎이는 순 — 홈 화면 핸디 목록과 같은 차례다 */
  const 깎임 = members
    .map((m) => stats?.[m])
    .filter((s) => s && s.handicap !== null)
    .sort((a, b) => a.handicap - b.handicap)

  return (
    <div className="rank-opts card">
      <button
        type="button"
        className={`toggle ${ranking.useHandicap ? 'on' : ''}`}
        role="switch"
        aria-checked={ranking.useHandicap}
        onClick={() => onRanking({ useHandicap: !ranking.useHandicap })}
      >
        <i aria-hidden="true" />
        <span>핸디 적용해서 순위 보기</span>
      </button>

      {/*
        **골라 넣는다.** 숫자 칸이었더니 휴대폰에서 숫자판이 떴다 닫혔다 하고,
        54 같은 뜻 없는 값도 들어갔다. 쓸 만한 범위(1~15타)만 목록으로 세운다.
      */}
      <label className="cap">
        <span>핸디 상한</span>
        <select
          className="compact"
          value={ranking.cap ?? ''}
          onChange={(e) => onRanking({ cap: e.target.value === '' ? null : Number(e.target.value) })}
        >
          <option value="">없음</option>
          {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}타</option>
          ))}
        </select>
      </label>

      {/*
        ══════════════════════════════════════════════════════════
        **켜면 누가 몇 타 깎이는지 그 자리에서 보인다.**

        여태 스위치만 있고 결과는 홈 화면에 가야 알 수 있었다. 그런데 이 스위치를
        만지는 까닭이 바로 '얼마나 깎이나' 를 보려는 것이다 — 켜기 전에 알아야
        켤지 말지를 정한다. 상한을 고치면 이 수도 그 자리에서 따라 바뀐다.

        끈 상태에서도 적는다. 지금은 안 깎이지만 켜면 이렇게 된다는 예고다.
        ══════════════════════════════════════════════════════════
      */}
      {깎임.length > 0 && (
        <ul className="rank-cuts" aria-label="핸디 적용 시 깎이는 타수">
          {깎임.map(({ member, handicap, isBase }) => (
            <li key={member} data-base={isBase || undefined}>
              <span>{member}</span>
              <b>{handicap}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
