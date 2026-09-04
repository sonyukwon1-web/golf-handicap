import { useRef, useState } from 'react'
import { MEMBERS } from '../lib/handicap.js'
import { headerStrip, recognize } from '../lib/ocr.js'
import { parseScorecard, resolveMembers } from '../lib/scorecard.js'
import NameResolver from './NameResolver.jsx'

const EMPTY = { phase: 'idle', progress: 0, note: '', error: '' }

/** 스코어카드 사진을 읽어 라운드 초안을 만든다. 결과는 항상 입력 폼에서 확인·수정할 수 있다. */
export default function ScorecardImport({ stats, onDraft }) {
  const [state, setState] = useState(EMPTY)
  const [pending, setPending] = useState(null) // 이름 구분이 필요한 중간 결과
  const [rawText, setRawText] = useState('')
  const [showText, setShowText] = useState(false)
  const fileRef = useRef(null)

  const finish = (parsed, scores) => {
    onDraft({
      date: parsed.date,
      course: parsed.course,
      scores: Object.fromEntries(MEMBERS.map((m) => [m, scores[m] ?? ''])),
    })
    setState({ ...EMPTY, phase: 'done', note: '읽은 내용을 아래에 채웠습니다. 확인 후 저장하세요.' })
  }

  const run = async (file) => {
    if (!file) return
    setPending(null)
    setRawText('')
    setState({ phase: 'working', progress: 0.02, note: '준비 중', error: '' })

    try {
      const report = (progress, note) =>
        setState((s) => (s.phase === 'working' ? { ...s, progress, note } : s))

      const text = await recognize(file, report)
      report(0.75, '스코어카드 읽는 중')
      let parsed = parseScorecard(text)
      let raw = text

      // 날짜·골프장은 상단 머리글에 작게 박혀 있어 통째로 읽으면 자주 누락된다.
      if (!parsed.date || !parsed.course) {
        report(0.85, '날짜·골프장 다시 읽는 중')
        try {
          const header = parseScorecard(await recognize(await headerStrip(file), report))
          raw += `\n\n[머리글 확대 재시도]\n${header.lines.join('\n')}`
          parsed = {
            ...parsed,
            date: parsed.date || header.date,
            course: parsed.course || header.course,
          }
        } catch {
          // 보조 수단이라 실패해도 원본 결과로 진행한다
        }
      }

      report(1, '완료')
      setRawText(raw)

      if (parsed.rows.length === 0) {
        setState({
          ...EMPTY,
          phase: 'error',
          error: '스코어카드에서 타수를 찾지 못했습니다. 사진을 더 밝고 반듯하게 찍어 다시 시도하거나, 아래에 직접 입력하세요.',
        })
        setShowText(true)
        return
      }

      const { scores, ambiguous } = resolveMembers(parsed.rows)
      if (ambiguous.length > 0) {
        setState({ ...EMPTY, phase: 'resolving' })
        setPending({ parsed, scores, ambiguous })
        return
      }
      finish(parsed, scores)
    } catch (e) {
      setState({
        ...EMPTY,
        phase: 'error',
        error: `스코어카드를 읽지 못했습니다: ${e.message}. 인터넷 연결을 확인하거나 아래에 직접 입력하세요.`,
      })
    }
  }

  const onPick = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    run(file)
  }

  const busy = state.phase === 'working'

  return (
    <div className="card ocr-card">
      <div className="ocr-head">
        <h3>스코어카드 사진으로 입력</h3>
        <span className="hint">읽은 값은 저장 전에 고칠 수 있어요</span>
      </div>

      <button type="button" className="btn primary block" onClick={() => fileRef.current?.click()} disabled={busy}>
        {busy ? '읽는 중…' : '📷 사진 선택'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        className="sr-only"
        aria-label="스코어카드 사진 선택"
      />

      {busy && (
        <div className="ocr-progress" role="status">
          <div className="bar"><span style={{ width: `${Math.round(state.progress * 100)}%` }} /></div>
          <p>{state.note} · {Math.round(state.progress * 100)}%</p>
        </div>
      )}

      {state.phase === 'done' && <div className="notice info" role="status">{state.note}</div>}
      {state.phase === 'error' && <div className="notice error" role="alert">{state.error}</div>}

      {rawText && (
        <>
          <button type="button" className="link-btn" onClick={() => setShowText((v) => !v)}>
            {showText ? '인식된 글자 숨기기' : '인식된 글자 보기'}
          </button>
          {showText && <pre className="ocr-raw">{rawText}</pre>}
        </>
      )}

      <p className="foot-note">
        처음 한 번은 한글 인식 모델을 내려받느라 시간이 걸립니다. 이후에는 바로 인식돼요.
      </p>

      {pending && (
        <NameResolver
          groups={pending.ambiguous}
          stats={stats}
          onCancel={() => {
            // 구분을 미루더라도 읽어낸 나머지 값은 살려서 채워 준다
            finish(pending.parsed, pending.scores)
            setPending(null)
          }}
          onConfirm={(resolved) => {
            finish(pending.parsed, { ...pending.scores, ...resolved })
            setPending(null)
          }}
        />
      )}
    </div>
  )
}
