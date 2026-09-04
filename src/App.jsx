import { useEffect, useRef, useState } from 'react'
import Dashboard from './components/Dashboard.jsx'
import RoundForm from './components/RoundForm.jsx'
import RoundList from './components/RoundList.jsx'
import { computeStats } from './lib/handicap.js'
import { exportFile, importFile, load, save } from './lib/storage.js'

const TABS = [
  { id: 'home', label: '홈' },
  { id: 'rounds', label: '라운드' },
  { id: 'input', label: '입력' },
]

export default function App() {
  const [data, setData] = useState(load)
  const [tab, setTab] = useState('home')
  const [message, setMessage] = useState(null)
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
  }

  const updateRound = (next) =>
    setData((d) => ({ ...d, rounds: d.rounds.map((r) => (r.id === next.id ? { ...r, ...next } : r)) }))

  const deleteRound = (id) =>
    setData((d) => ({ ...d, rounds: d.rounds.filter((r) => r.id !== id) }))

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
              <h1>⛳ 골프 모임 핸디캡</h1>
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

        {tab === 'input' && <RoundForm onSave={addRounds} stats={stats} />}

        {tab !== 'input' && (
          <p className="foot-note">
            기록은 이 브라우저에만 저장됩니다. 다른 멤버와 공유하려면 “내보내기”로 받은 JSON 파일을
            전달하고, 받는 쪽에서 “불러오기”로 열면 됩니다.
          </p>
        )}
      </main>
    </div>
  )
}
