/**
 * 순위를 어떻게 매길지 — **순위가 있는 화면마다 맨 위에 선다.**
 *
 * 홈에만 두었더니, 랭킹이나 라운드 목록을 보다가 '이거 핸디 적용된 건가?' 를
 * 확인하려면 홈으로 돌아가야 했다. 순위를 보는 자리에 켜고 끄는 자리가 함께
 * 있어야, 바꾼 결과를 그 자리에서 본다.
 *
 * 담기는 값은 하나뿐이라(App 의 ranking) 어느 화면에서 켜든 전부 따라온다.
 */
export default function RankOptions({ ranking, onRanking }) {
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

      <label className="cap">
        <span>상한</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="54"
          placeholder="없음"
          value={ranking.cap ?? ''}
          onChange={(e) => {
            const v = e.target.value.trim()
            const n = Number(v)
            onRanking({ cap: v === '' || !Number.isFinite(n) || n < 0 ? null : Math.round(n) })
          }}
        />
        <span className="unit">타</span>
      </label>
    </div>
  )
}
