// 기기끼리 맞추기 — 문서 한 장을 주고받는다. 자세한 것은 api/sync.js 참고.

import { loadPhotos, savePhotos } from './photos.js'

/**
 * ══════════════════════════════════════════════════════════════════
 * **아무것도 안 해도 맞춰진다.**
 *
 * 처음에는 연결 코드를 만들어 다른 기기에 옮겨 적게 했다. 그런데 그 한 걸음이
 * 곧 '안 쓰는 이유' 가 됐다 — 넷이 쓰는 앱에 방을 나눌 까닭도 없다.
 * 서버가 방 하나를 쓰고, 앱은 열자마자 그 방을 본다.
 * ══════════════════════════════════════════════════════════════════
 */

/** 서버에 얹혀 있는 문서. 아직 아무도 안 올렸으면 null */
export async function pull() {
  const r = await fetch('/api/sync')
  if (r.status === 503) throw new Error('서버 저장소가 연결되지 않았습니다.')
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `불러오지 못했습니다 (${r.status})`)
  return r.json()
}

/** 지금 것을 올린다. 사진도 함께 — 기기를 옮기면 얼굴도 따라와야 한다 */
export async function push(data) {
  const body = JSON.stringify({ ...data, photos: loadPhotos(), updatedAt: Date.now() })
  const r = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `올리지 못했습니다 (${r.status})`)
  return JSON.parse(body).updatedAt
}

/** 받아 온 문서에서 사진만 따로 담는다 (기록은 storage 의 normalize 가 맡는다) */
export function applyPhotos(remote) {
  if (!remote?.photos || typeof remote.photos !== 'object') return
  savePhotos({ ...loadPhotos(), ...remote.photos })
}
