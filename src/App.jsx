import { useEffect, useRef, useState } from 'react'
import Dashboard from './components/Dashboard.jsx'
import HallOfFame from './components/HallOfFame.jsx'
import HoleRoundForm from './components/HoleRoundForm.jsx'
import RivalMatch from './components/RivalMatch.jsx'
import RoundForm from './components/RoundForm.jsx'
import DeviceSync from './components/DeviceSync.jsx'
import AverageBoard from './components/AverageBoard.jsx'
import Podium from './components/Podium.jsx'
import RoundList from './components/RoundList.jsx'
import WinnerCelebration from './components/WinnerCelebration.jsx'
import { roundOutcomes } from './lib/awards.js'
import { DEFAULT_RANKING, MEMBERS, computeStats, fmtDate, scoresOf, sortRounds } from './lib/handicap.js'
import { findDuplicate } from './lib/duplicates.js'
import { load, save, normalize } from './lib/storage.js'
import { applyPhotos, decideSync, pull, push } from './lib/sync.js'
import { loadPhotos } from './lib/photos.js'

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

  /*
    ══════════════════════════════════════════════════════════
    **고친 때를 담아 둔다 — 기기끼리 견주는 잣대다.**

    담을 때 시각을 찍는다. 이것이 없으면 이 기기가 언제 것인지 알 수 없어,
    서버 것과 견줄 방법이 없다.

    **처음 한 번은 안 찍는다.** 앱을 열자마자 담기는 것은 방금 읽어 온 그
    값이라, 그때도 찍으면 열기만 해도 이 기기가 늘 '가장 새것' 이 되어
    서버 것을 영영 안 받는다.
    ══════════════════════════════════════════════════════════
  */
  const firstSave = useRef(true)
  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; save(data); return }
    save({ ...data, updatedAt: Date.now() })
  }, [data])

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

  /*
    ══════════════════════════════════════════════════════════
    **기기끼리 맞추기 — 아무것도 안 해도 맞춰진다.**

    열면 서버에서 받아 오고, 무언가 바뀌면 잠깐 기다렸다가 올린다. 늦게 고친
    쪽이 이긴다(updatedAt). 넷이 쓰는 앱이라 방을 나눌 까닭이 없어 서버가
    방 하나를 쓴다.

    **처음 받아 오기에 성공하기 전에는 절대 안 올린다.** 서버가 잠깐 죽었거나
    저장소가 안 붙은 기기에서 뭔가 고치면, 그 빈 상태가 남의 기록을 통째로
    덮어쓴다. 받아 온 적이 없으면 올릴 자격도 없다.

    바로 올리지 않고 1.2초 기다린다 — 홀 표에서 칸을 하나씩 채우는 동안
    글자마다 올리면 스무 번 넘게 오간다. 손이 멈추면 한 번 간다.
    ══════════════════════════════════════════════════════════
  */
  const [syncState, setSyncState] = useState({ kind: 'working' })
  /** 받아 온 적이 있는가 — 이것이 참이 되기 전에는 올리지 않는다 */
  const synced = useRef(false)
  const pushTimer = useRef(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const local = load()
        const remote = await pull()
        if (!alive) return

        /*
          **서버가 비었거나 옛것이면 곧바로 올린다.**

          여태 '무언가 바뀌면 올린다' 뿐이었다. 그런데 이미 기록이 있는 기기는
          열어도 바뀌는 것이 없어서 **영영 안 올라갔다** — 서버는 계속 비어
          있고, 다른 기기는 받아 올 것이 없었다. PC 에 사진이 다 있는데
          휴대폰이 비어 있던 까닭이다.
        */
        const 할일 = decideSync(local, remote, Object.keys(loadPhotos()).length > 0)
        if (할일 === 'pull') {
          applyPhotos(remote)
          setData(normalize(remote))
        } else if (할일 === 'push') {
          await push(local)
        }

        synced.current = true
        setSyncState({ kind: 'ok', at: Date.now() })
      } catch (e) {
        if (alive) setSyncState({ kind: 'error', message: e.message })
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!synced.current) return
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(async () => {
      try {
        await push(data)
        setSyncState({ kind: 'ok', at: Date.now() })
      } catch (e) {
        setSyncState({ kind: 'error', message: e.message })
      }
    }, 1200)
    return () => { if (pushTimer.current) clearTimeout(pushTimer.current) }
  }, [data])
  /** 순위를 어떻게 매기나 — 핸디 켜기·상한. 화면 전부가 이 하나를 본다 */
  const ranking = data.ranking ?? DEFAULT_RANKING
  const setRanking = (patch) => setData((d) => ({ ...d, ranking: { ...ranking, ...patch } }))

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
  const outcomes = roundOutcomes(rounds, ranking)
  const { stats } = computeStats(rounds, ranking)
  /** 방금 저장한 라운드 (저장 직후 우승자를 띄운다) */
  const celebrating = celebrateId ? outcomes.find((o) => o.id === celebrateId) : null
  /** 가장 최근 라운드 — 랭킹 화면 맨 위 시상대가 본다 (outcomes 는 날짜 오름차순) */
  const latest = outcomes.length ? outcomes[outcomes.length - 1] : null

  /*
    ══════════════════════════════════════════════════════════
    **랭킹은 어느 기간을 볼지 고른다.**

    맨 위 시상대만 '가장 최근 라운드' 였고 아래 기록들은 늘 전체였다. 그러면
    '올해는 누가 잘 쳤나' 를 볼 수가 없다 — 3년치가 뭉뚱그려진 값만 남는다.

    고른 기간이 **아래 전부**에 걸린다: 명예의 전당·흑역사관·홀별 기록·개인
    기록·시즌 랭킹·라이벌 매치. 한 화면이 한 기간을 말해야 견줄 수 있다.
    ══════════════════════════════════════════════════════════
  */
  /*
    첫 값은 **비워 둔다.** 'recent' 라는 항목을 따로 두었더니, 목록에 은화삼이
    빤히 있는데도 '최근 라운드' 라는 딴 줄이 골라져 있었다 — 같은 것을 가리키는
    이름이 둘이면 무엇을 보고 있는지 헷갈린다. 비워 두면 아래에서 가장 최근
    라운드의 id 로 메워지고, 자료가 늦게 도착해도 그때 맞춰 따라온다.
  */
  const [기간, set기간] = useState(null)
  const 해목록 = [...new Set(rounds.map((r) => String(r.date).slice(0, 4)).filter(Boolean))]
    .sort((a, b) => (a < b ? 1 : -1))

  /**
   * 평균으로 매긴 순위를 **시상대가 읽을 수 있는 모양**으로 바꾼다.
   *
   * 시상대는 라운드 하나(entries: member·gross·rank)를 받게 되어 있다. 평균도
   * 결국 '누가 몇 타로 몇 등' 이라 같은 모양에 담긴다 — 부품을 새로 만들지 않고
   * 재료만 맞춰 준다.
   */
  const 평균시상대 = (list, perMember) => {
    const 정렬 = sortRounds(list)
    const 줄 = MEMBERS
      .map((m) => {
        /* 아래 평균 판과 **같은 셈**을 써야 시상대와 목록의 수가 안 갈린다 */
        const 친것 = perMember
          ? scoresOf(정렬, m).slice(-perMember)
          : list.map((r) => r.scores?.[m]).filter((v) => typeof v === 'number' && Number.isFinite(v))
        return 친것.length ? { member: m, avg: 친것.reduce((a, b) => a + b, 0) / 친것.length } : null
      })
      .filter(Boolean)
      .sort((a, b) => a.avg - b.avg)
    if (!줄.length) return null
    return {
      date: '',
      course: '',
      entries: 줄.map((r, i) => {
        const 타 = Math.round(r.avg)
        return { member: r.member, gross: 타, net: 타, rank: i + 1 }
      }),
    }
  }

  /*
    **라운드 하나를 날짜로 골라 볼 수 있다.**

    여태 '최근 라운드' 하나만 볼 수 있어, 지난 필드가 어땠는지는 라운드 탭에
    가서 카드를 펴야 했다. 날짜를 고르면 그 날 시상대와 그 날 홀별 기록이
    한 화면에 선다.
  */
  const 최신순 = sortRounds(rounds).slice().reverse()
  /** 고르지 않았으면 가장 최근 라운드 (없으면 최근 5개 평균) */
  const 본기간 = 기간 ?? (최신순[0] ? String(최신순[0].id) : 'last5')
  const 고른라운드 = 최신순.find((r) => String(r.id) === 본기간) || null

  /*
    '최근 5개 라운드' 는 **사람마다 제 마지막 다섯 번**을 뜻한다 (홈 핸디와 같은 셈).
    아래 홀별 기록·라이벌은 라운드 묶음이 있어야 하므로 최근 다섯 라운드를 쓴다.
  */
  const 사람별5 = 본기간 === 'last5' ? 5 : null
  /** 평균을 보고 있는가 — 최근 5개이거나 어느 해이거나 */
  const 평균보기 = 본기간 === 'last5' || /^\d{4}$/.test(본기간)

  const 기간라운드 = (() => {
    if (본기간 === 'last5') return sortRounds(rounds).slice(-5)
    if (/^\d{4}$/.test(본기간)) return rounds.filter((r) => String(r.date).startsWith(본기간))
    if (고른라운드) return [고른라운드]
    return rounds
  })()
  const 평균순위 = 평균보기 ? 평균시상대(사람별5 ? rounds : 기간라운드, 사람별5) : null
  /**
   * 시상대에 세울 라운드 — **라운드를 고른 때만.**
   *
   * 평균을 골라도 맨 위에 '최근 라운드' 시상대가 그대로 남아 있었다. 아래에
   * 평균 시상대가 하나 더 서서 두 개가 겹쳐 뜨고, 맨 위 카드는 그대로라
   * **고른 것이 반영이 안 된 것처럼 보였다.**
   */
  const 볼라운드 = 평균보기 || !고른라운드 ? null : outcomes.find((o) => o.id === 고른라운드.id) || null

  /*
    **고른 것의 이름.** 아래 카드들이 저마다 이 이름을 머리에 단다 — 셈만
    바뀌고 이름은 그대로면, 2026년을 골라 놓고도 무엇을 보고 있는지 알 수 없다.
  */
  const 기간이름 = 평균보기
    ? (본기간 === 'last5' ? '최근 5개 라운드 평균' : `${본기간}년 평균`)
    : 고른라운드
      ? `${fmtDate(고른라운드.date)} · ${고른라운드.course || '골프장 미입력'}`
      : '전체'

  return (
    <div className="app">
      <header className="topbar">
        <div className="shell">
          <div className="topbar-row">
            <div className="brand">
              <h1>⛳ 낙원 골프</h1>
              <span>{roundCount}라운드</span>
            </div>
            {/*
              **여기 있어야 할 것은 새로고침이다.**

              내보내기·불러오기는 기기끼리 손으로 옮기던 때의 자리다. 이제
              저절로 맞춰지므로 쓸 일이 없고, 잘못 누르면 지금 기록을 통째로
              덮어써서 위험하기만 했다.

              대신 홈 화면에 추가해 열면 주소창이 없어 새로고침할 자리가
              없다 — 늘 보이는 이 자리에 둔다.
            */}
            <div className="topbar-actions">
              <button className="ghost-btn" onClick={() => location.reload()}>새로고침</button>
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
            ranking={ranking}
            onRanking={setRanking}
            onGoInput={() => setTab('input')}
            sync={<DeviceSync state={syncState} />}
          />
        )}

        {tab === 'rounds' && (
          <section className="section">
            <div className="section-head">
              <h2>전체 라운드</h2>
              <span className="hint">{roundCount}개</span>
            </div>
            {/* 핸디 상한은 홈 한 곳에서만 정한다 — 같은 상자가 세 화면에 있으면
                어디서 고쳐야 하는지 헷갈리고, 정작 볼 것을 아래로 밀어낸다 */}
            <RoundList rounds={rounds} onUpdate={updateRound} onDelete={deleteRound} />
          </section>
        )}

        {tab === 'fame' && (
          <section className="section fame-stack">
            <div className="section-head">
              {/* 통산 순위를 안 보여줄 때 그 이름을 머리에 달아 두면 거짓말이 된다 */}
              <h2>{평균보기 ? '명예의 전당 & 흑역사관' : '라운드 기록'}</h2>
              {/* 늘 '5라운드 누적' 이라 적혀 있었다 — 무엇을 골랐든 같은 말이었다 */}
              <span className="hint">{기간이름}</span>
            </div>
            {/* 무엇을 볼 것인가 — 아래 기록 전부가 이 값을 따른다 */}
            <label className="period-pick">
              {/*
                평균이 위, 라운드 하나하나가 아래. 여럿을 묶어 보는 것이 먼저
                눈에 들어와야 한다 — 날짜 목록은 길어서 아래에 두어도 찾기 쉽다.
              */}
              <select value={본기간} onChange={(e) => set기간(e.target.value)}>
                <optgroup label="평균">
                  <option value="last5">최근 5개 라운드 평균</option>
                  {해목록.map((y) => <option key={y} value={y}>{y}년 평균</option>)}
                </optgroup>
                <optgroup label="라운드 (날짜순)">
                  {최신순.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {fmtDate(r.date)} · {r.course || '골프장 미입력'}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>

            {/*
              **가장 최근 라운드의 시상대를 맨 위에.**

              이 그림은 라운드를 저장한 그 순간에만 떴다. 닫고 나면 다시 볼
              방법이 없어서, 정작 자랑하고 싶을 때 꺼낼 것이 없었다.
            */}
            {볼라운드 && (
              <div className="card podium-card">
                <div className="fame-head">
                  <h3>🏆 {볼라운드.course || '이 라운드'}</h3>
                  <span className="hint">{fmtDate(볼라운드.date)}</span>
                </div>
                <Podium round={볼라운드} compact />
              </div>
            )}

            {/*
              **평균도 시상대로 세운다.**

              최근 라운드는 트로피 시상대인데 평균은 목록이라, 고를 때마다 화면이
              통째로 다른 앱처럼 보였다. 같은 것을 재는 자리는 같은 모양이어야
              한다 — 평균으로 매긴 1·2·3위도 시상대에 올린다.
            */}
            {평균순위 && (
              <div className="card podium-card">
                <div className="fame-head">
                  <h3>🏆 {본기간 === 'last5' ? '최근 5개 라운드' : `${본기간}년`} 평균</h3>
                  <span className="hint">{기간라운드.length}라운드</span>
                </div>
                <Podium round={평균순위} compact />
              </div>
            )}

            {평균순위 && <AverageBoard rounds={사람별5 ? rounds : 기간라운드} perMember={사람별5} />}

            <HallOfFame rounds={기간라운드} period={기간이름} 통산={평균보기} />
            <RivalMatch rounds={기간라운드} period={기간이름} />
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
            기록과 사진은 <b>기기끼리 저절로 맞춰집니다</b> — 휴대폰에서 넣은 것이 PC 에도 뜹니다.
          </p>
        )}
      </main>

      {celebrating && (
        <WinnerCelebration round={celebrating} onClose={() => setCelebrateId(null)} />
      )}

    </div>
  )
}
