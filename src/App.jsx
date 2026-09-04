import { useEffect, useRef, useState } from 'react'
import Dashboard from './components/Dashboard.jsx'
import HallOfFame from './components/HallOfFame.jsx'
import PenaltyRoulette from './components/PenaltyRoulette.jsx'
import RivalMatch from './components/RivalMatch.jsx'
import RoundForm from './components/RoundForm.jsx'
import RoundList from './components/RoundList.jsx'
import SeasonRanking from './components/SeasonRanking.jsx'
import WinnerCelebration from './components/WinnerCelebration.jsx'
import { roundOutcomes } from './lib/awards.js'
import { computeStats } from './lib/handicap.js'
import { exportFile, importFile, load, save } from './lib/storage.js'

const TABS = [
  { id: 'home', label: '홈' },
  { id: 'rounds', label: '라운드' },
  { id: 'fame', label: '랭킹' },
  { id: 'input', label: '입력' },
]

export default function App() {
  const [data, setData] = useState(load)
  const [tab, setTab] = useState('home')
  const [message, setMessage] = useState(null)
  const [celebrateId, setCelebrateId] = useState(null)  // 방금 저장한 라운드
  const [rouletteId, setRouletteId] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => { save(data) }, [data])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(t)
  }, [message])

  const rounds = data.rounds
  const roundCount = rounds.length
  const { stats } = computeStats(rounds)

  const addRounds = (list) => {
    setData((d) => ({ ...d, rounds: [...d.rounds, ...list] }))
    setMessage({ kind: 'info', text: `${list.length}개 라운드가 저장되었습니다.` })

    // 오늘 친 결과를 넣었을 때만 발표한다.
    // 과거 스코어카드를 여러 장 몰아 넣는 중이라면 축포는 방해만 된다.
    if (list.length === 1) setCelebrateId(list[0].id)
  }

  const updateRound = (next) =>
    setData((d) => ({ ...d, rounds: d.rounds.map((r) => (r.id === next.id ? { ...r, ...next } : r)) }))

  const deleteRound = (id) =>
    setData((d) => ({ ...d, rounds: d.rounds.filter((r) => r.id !== id) }))

  const setPenalties = (penalties) => setData((d) => ({ ...d, penalties }))

  const assignPenalty = (roundId, text, members) =>
    setData((d) => ({
      ...d,
      rounds: d.rounds.map((r) => (r.id === roundId ? { ...r, penalty: { text, members } } : r)),
    }))

  const outcomes = roundOutcomes(rounds)
  const celebrating = celebrateId ? outcomes.find((o) => o.id === celebrateId) : null
  const rouletteRound = rouletteId ? outcomes.find((o) => o.id === rouletteId) : null

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

        {tab === 'input' && <RoundForm onSave={addRounds} stats={stats} />}

        {tab !== 'input' && (
          <p className="foot-note">
            기록은 이 브라우저에만 저장됩니다. 다른 멤버와 공유하려면 “내보내기”로 받은 JSON 파일을
            전달하고, 받는 쪽에서 “불러오기”로 열면 됩니다.
          </p>
        )}
      </main>

      {celebrating && (
        <WinnerCelebration
          round={celebrating}
          onClose={() => setCelebrateId(null)}
          onPenalty={() => {
            setRouletteId(celebrating.id)
            setCelebrateId(null)
          }}
        />
      )}

      {rouletteRound && (
        <PenaltyRoulette
          losers={rouletteRound.losers}
          penalties={data.penalties}
          onChangePenalties={setPenalties}
          onClose={() => setRouletteId(null)}
          onDecided={(text) => {
            assignPenalty(rouletteRound.id, text, rouletteRound.losers)
            setRouletteId(null)
            setMessage({ kind: 'info', text: `${rouletteRound.losers.join(', ')} 벌칙: ${text}` })
          }}
        />
      )}
    </div>
  )
}
