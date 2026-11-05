'use server'
// 신청 도우미 서버 액션: 공지를 내 마감에 담기(서버가 공지·AI 요약을 다시 읽어 저장), 준비물 체크, 완료, 빼기
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/session'
import { getTaskStore } from '@/lib/deadlines/store'
import { dueMs, parseDue } from '@/lib/deadlines/when'
import { createLimiter } from '@/lib/rate-limit'
import type { NoticeBoard } from '@/lib/school/notices'
import { noticeCards } from '@/lib/school/service'

const saveLimit = createLimiter({ limit: 30, windowMs: 10 * 60_000 })
const isBoard = (v: unknown): v is NoticeBoard => v === 'academic' || v === 'general'
const isId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v)

const refresh = () => {
  revalidatePath('/')
  revalidatePath('/notices')
}

/** 화면이 보낸 값은 공지 번호만 믿는다: 제목·마감·신청 방법은 서버가 공지 목록(캐시)에서 다시 찾는다 */
export async function prepareNotice(board: string, noticeId: string) {
  const me = await requireUser()
  if (!isBoard(board) || !isId(noticeId) || !saveLimit(me.id)) return
  const { items } = await noticeCards(board, me.lang, 8)
  const n = items.find(x => x.id === noticeId)
  if (!n) return
  const due = n.deadline ? parseDue(n.deadline) : null
  await getTaskStore().save({
    userId: me.id, board, noticeId,
    title: n.titleTr || n.title, titleKo: n.title,
    deadline: n.deadline, dueAt: due ? dueMs(due) : null,
    url: n.url, apply: n.apply,
  })
  refresh()
}

export async function toggleTaskItem(taskId: string, index: number) {
  const me = await requireUser()
  if (!isId(taskId) || !Number.isInteger(index) || index < 0 || index > 20) return
  const store = getTaskStore()
  const task = await store.get(me.id, taskId)
  if (!task) return
  const checked = task.checked.includes(index) ? task.checked.filter(i => i !== index) : [...task.checked, index].sort((a, b) => a - b)
  await store.update(me.id, taskId, { checked })
  refresh()
}

export async function setTaskDone(taskId: string, done: boolean) {
  const me = await requireUser()
  if (!isId(taskId)) return
  await getTaskStore().update(me.id, taskId, { done: !!done })
  refresh()
}

export async function removeTask(taskId: string) {
  const me = await requireUser()
  if (!isId(taskId)) return
  await getTaskStore().remove(me.id, taskId)
  refresh()
}
