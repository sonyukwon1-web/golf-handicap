/**
 * 스코어카드를 읽고 나서 **미심쩍은 자리를 짚어 주는 알림.**
 *
 * 읽은 값을 표에 채워 놓고 '확인하고 저장하세요' 라고만 두었더니, 열여덟 칸이
 * 다 그럴듯해 보여 그냥 저장했다. 못 읽은 칸도 카드와 합이 안 맞는 나인도
 * 표 아래 작은 글씨에만 적혀 있었다.
 *
 * 잘못될 수 있는 곳이 하나라도 있으면 **읽자마자 가로막고** 어디를 봐야 하는지
 * 적는다. 표의 그 칸들은 빨갛게 물들어 있으므로, 닫으면 바로 눈에 들어온다.
 */
export default function ReadCheck({ items, onClose }) {
  if (!items?.length) return null

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="readcheck-title">
        <h2 id="readcheck-title" className="modal-title">읽은 값을 확인해 주세요</h2>
        <p className="modal-desc">
          카드와 맞지 않는 곳이 <b>{items.length}군데</b> 있습니다. 아래 자리는 표에서
          <b> 빨갛게</b> 물들어 있으니 카드와 견주어 고쳐 주세요.
        </p>

        <ul className="readcheck-list">
          {items.map((it, i) => (
            <li key={i}>
              <span className="rc-who">{it.member} {it.nine}</span>
              <span className="rc-what">{it.text}</span>
            </li>
          ))}
        </ul>

        <div className="modal-foot">
          <button type="button" className="btn primary" onClick={onClose}>표에서 고치기</button>
        </div>
      </div>
    </div>
  )
}
