// 기기끼리 맞추기 — 방 이름 하나에 문서 한 장. 자세한 것은 api/sync.js 참고.

import { loadPhotos, savePhotos } from './photos.js'

const ROOM_KEY = 'nakwon.room'

/** 이 기기가 붙어 있는 방. 없으면 동기화를 안 한다 */
export function loadRoom() {
  try {
    return localStorage.getItem(ROOM_KEY) || ''
  } catch {
    return ''
  }
}

export function saveRoom(room) {
  try {
    if (room) localStorage.setItem(ROOM_KEY, room)
    else localStorage.removeItem(ROOM_KEY)
  } catch { /* 담을 자리가 없어도 이번 화면에서는 돌아간다 */ }
}

/**
 * 새 방 이름 — 여섯 글자.
 *
 * 사람이 다른 기기에 **손으로 옮겨 적는** 값이라, 헷갈리는 글자를 뺀다
 * (0·O, 1·l·I). 여섯 글자면 32^6 ≈ 10억 가지라 남이 맞힐 일이 없다.
 */
export function newRoom() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += abc[Math.floor(Math.random() * abc.length)]
  return out
}

/** 서버에 얹혀 있는 문서. 방이 비어 있으면 null */
export async function pull(room) {
  const r = await fetch(`/api/sync?room=${encodeURIComponent(room)}`)
  if (r.status === 503) throw new Error('아직 서버에 저장소가 연결되지 않았습니다.')
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `불러오지 못했습니다 (${r.status})`)
  return r.json()
}

/** 지금 것을 올린다. 사진도 함께 — 기기를 옮기면 얼굴도 따라와야 한다 */
export async function push(room, data) {
  const body = JSON.stringify({ ...data, photos: loadPhotos(), updatedAt: Date.now() })
  const r = await fetch(`/api/sync?room=${encodeURIComponent(room)}`, {
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
