import { useMemo, useState } from 'react'
import { trashTalk } from '../lib/trashtalk.js'

/** 상황을 보고 한 마디 얹는다. 새로고침 버튼으로 다른 멘트를 뽑는다. */
export default function TrashTalk({ rounds }) {
  const lines = useMemo(() => trashTalk(rounds), [rounds])
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1000))

  if (lines.length === 0) return null
  const line = lines[seed % lines.length]

  return (
    <div className="trash-talk">
      <span className="tt-mic" aria-hidden="true">📢</span>
      <p>{line.text}</p>
      <button
        type="button"
        className="tt-more"
        onClick={() => setSeed((s) => s + 1 + Math.floor(Math.random() * (lines.length - 1 || 1)))}
        aria-label="다른 멘트 보기"
        title="다른 멘트 보기"
      >
        ↻
      </button>
    </div>
  )
}
