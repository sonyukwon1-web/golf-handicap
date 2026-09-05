/**
 * 핸디 상한을 정하는 자리 — **핸디가 보이는 화면마다 맨 위에 선다.**
 *
 * 한때 '핸디 적용해서 순위 보기' 스위치가 함께 있었다. 그런데 넷이 제 평균대로
 * 치면 전원 동타가 되는 셈이라 순위를 가리는 데는 쓸모가 없었다. 순위는 늘
 * 친 타수로 매기고, 핸디는 **다음 판을 짤 때 보는 값**으로만 남긴다.
 *
 * 상한을 바꾸면 아래 수가 그 자리에서 따라 바뀐다 — 몇 타까지 봐줄지 눈으로
 * 보면서 정한다.
 */
export default function RankOptions({ ranking, onRanking, stats, members = [] }) {
  /* 기준(0)이 앞, 그 뒤로 적게 깎이는 순 — 홈 화면 핸디 목록과 같은 차례다 */
  const 깎임 = members
    .map((m) => stats?.[m])
    .filter((s) => s && s.handicap !== null)
    .sort((a, b) => a.handicap - b.handicap)

  return (
    <div className="rank-opts card">

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
