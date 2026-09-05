import { useEffect, useRef, useState } from 'react'
import Dashboard from './components/Dashboard.jsx'
import HallOfFame from './components/HallOfFame.jsx'
import HoleRoundForm from './components/HoleRoundForm.jsx'
import RivalMatch from './components/RivalMatch.jsx'
import RoundForm from './components/RoundForm.jsx'
import RoundList from './components/RoundList.jsx'
import SeasonRanking from './components/SeasonRanking.jsx'
import WinnerCelebration from './components/WinnerCelebration.jsx'
import { roundOutcomes } from './lib/awards.js'
import { computeStats } from './lib/handicap.js'
import { findDuplicate } from './lib/duplicates.js'
import { exportFile, importFile, load, save } from './lib/storage.js'

const TABS = [
  { id: 'home', label: '홈' },
  { id: 'fame', label: '랭킹' },
  { id: 'rounds', label: '라운드' },
  { id: 'input', label: '입력' },
]

/** 새로고침해도 보던 탭에 그대로 머물도록 주소(#입력) 에 담아 둔다 */
const tabFromHash = () => {
  const id = typeof location !== 'undefined' ? location.hash.replace('#', '') : ''
  return TABS.some((t) => t.id === id) ? id : 'home'
}

export default function App() {
  const [data, setData] = useState(load)
  const [tab, setTab] = useState(tabFromHash)
  const [message, setMessage] = useState(null)
  const [celebrateId, setCelebrateId] = useState(null)  // 방금 저장한 라운드
  const [inputMode, setInputMode] = useState('holes')
  const fileRef = useRef(null)

  useEffect(() => { save(data) }, [data])

  // 탭을 바꾸면 주소에 남기고, 뒤로 가기로 돌아오면 그 탭을 연다
  useEffect(() => {
    if (location.hash.replace('#', '') !== tab) {
      history.replaceState(null, '', tab === 'home' ? location.pathname + location.search : `#${tab}`)
    }
  }, [tab])

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(t)
  }, [message])

  const rounds = data.rounds
  const roundCount = rounds.length

  /**
   * 이미 등록된 라운드는 건너뛴다. 무엇이 저장되고 무엇이 걸렸는지 돌려주어
   * 입력 화면이 그 자리에서 알려줄 수 있게 한다.
   */
  const addRounds = (list) => {
    const added = []
    const skipped = []
    let pool = rounds

    for (const round of list) {
      const dup = findDuplicate(pool, round)
      if (dup) skipped.push({ round, existing: dup })
      else { added.push(round); pool = [...pool, round] }
    }

    if (added.length > 0) {
      setData((d) => ({ ...d, rounds: [...d.rounds, ...added] }))
      setMessage({ kind: 'info', text: `${added.length}개 라운드가 저장되었습니다.` })
      // 오늘 친 결과를 넣었을 때만 발표한다.
      // 과거 스코어카드를 여러 장 몰아 넣는 중이라면 축포는 방해만 된다.
      if (added.length === 1) setCelebrateId(added[0].id)
    }

    return { added, skipped }
  }

  const updateRound = (next) =>
    setData((d) => ({ ...d, rounds: d.rounds.map((r) => (r.id === next.id ? { ...r, ...next } : r)) }))

  const deleteRound = (id) =>
    setData((d) => ({ ...d, rounds: d.rounds.filter((r) => r.id !== id) }))

  /* 라운드마다의 순위·꼴찌 — 우승 발표 화면이 이걸 본다 */
  const outcomes = roundOutcomes(rounds)
  const { stats } = computeStats(rounds)
  /** 방금 저장한 라운드 (저장 직후 우승자를 띄운다) */
  const celebrating = celebrateId ? outcomes.find((o) => o.id === celebrateId) : null

  const onExport = () => {
    if (roundCount === 0) {
      setMessage({ kind: 'error', text: '내보낼 기록이 없습니다.' })
      return
    }
    exportFile(data)
  }

  const onImport = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (roundCount > 0 && !confirm(`현재 ${roundCount}개의 라운드 기록이 불러온 파일로 대체됩니다. 계속할까요?`)) return

    try {
      const next = await importFile(file)
      setData(next)
      setTab('home')
      setMessage({ kind: 'info', text: `${next.rounds.length}개 라운드를 불러왔습니다.` })
    } catch (err) {
      setMessage({ kind: 'error', text: err.message })
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="shell">
          <div className="topbar-row">
            <div className="brand">
              <h1>⛳ 낙원 골프</h1>
              <span>{roundCount}라운드</span>
            </div>
            <div className="topbar-actions">
              <button className="ghost-btn" onClick={onExport}>내보내기</button>
              <button className="ghost-btn" onClick={() => fileRef.current?.click()}>불러오기</button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                onChange={onImport}
                className="sr-only"
                aria-label="JSON 파일 불러오기"
              />
            </div>
          </div>

          <nav className="tabs" role="tablist" aria-label="화면 전환">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                aria-controls="tab-panel"
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="shell" id="tab-panel" role="tabpanel">
        {message && (
          <div className={`notice ${message.kind}`} role="status">{message.text}</div>
        )}

        {tab === 'home' && (
          <Dashboard
            rounds={rounds}
            onUpdate={updateRound}
            onDelete={deleteRound}
            onGoInput={() => setTab('input')}
          />
        )}

        {tab === 'rounds' && (
          <section className="section">
            <div className="section-head">
              <h2>전체 라운드</h2>
              <span className="hint">{roundCount}개</span>
            </div>
            <RoundList rounds={rounds} onUpdate={updateRound} onDelete={deleteRound} />
          </section>
        )}

        {tab === 'fame' && (
          <section className="section fame-stack">
            <div className="section-head">
              <h2>명예의 전당 &amp; 흑역사관</h2>
              <span className="hint">{roundCount}라운드 누적</span>
            </div>
            <HallOfFame rounds={rounds} />
            <SeasonRanking rounds={rounds} />
            <RivalMatch rounds={rounds} />
          </section>
        )}

        {tab === 'input' && (
          <section className="section">
            <div className="section-head">
              <h2>라운드 기록 입력</h2>
              <span className="hint">빠진 사람은 비워두세요</span>
            </div>

            <div className="mode-switch" role="tablist" aria-label="입력 방식">
              <button
                type="button" role="tab" aria-selected={inputMode === 'holes'}
                onClick={() => setInputMode('holes')}
              >
                홀별 기록
              </button>
              <button
                type="button" role="tab" aria-selected={inputMode === 'total'}
                onClick={() => setInputMode('total')}
              >
                총 타수만
              </button>
            </div>

            {inputMode === 'holes'
              ? <HoleRoundForm onSave={addRounds} stats={stats} rounds={rounds} />
              : <RoundForm onSave={addRounds} />}
          </section>
        )}

        {tab !== 'input' && (
          <p className="foot-note">
            기록은 이 브라우저에만 저장됩니다. 다른 멤버와 공유하려면 “내보내기”로 받은 JSON 파일을
            전달하고, 받는 쪽에서 “불러오기”로 열면 됩니다.
          </p>
        )}
      </main>

      {celebrating && (
        <WinnerCelebration round={celebrating} onClose={() => setCelebrateId(null)} />
      )}

    </div>
  )
}
