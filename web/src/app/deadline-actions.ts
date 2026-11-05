'use server'
// 신청 도우미 서버 액션: "신청 준비해 줘" 한 번에 내 마감에 담고 준비 화면(체크리스트·캘린더·제출처·메일 초안)으로 보낸다.
// 준비물 체크, 완료, 빼기, 담당 부서 메일 초안(AI)
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { draftApplyMail, type MailDraft } from '@/lib/ai'
import { requireUser } from '@/lib/auth/session'
import { mailtoHref } from '@/lib/deadlines/links'
import { mailInput, officeEmails } from '@/lib/deadlines/mail'
import { getTaskStore } from '@/lib/deadlines/store'
import { dueMs, parseDue } from '@/lib/deadlines/when'
import { createLimiter } from '@/lib/rate-limit'
import type { NoticeBoard } from '@/lib/school/notices'
import { noticeCards } from '@/lib/school/service'
import { cleanText } from '@/lib/profile'

const saveLimit = createLimiter({ limit: 30, windowMs: 10 * 60_000 })
const mailLimit = createLimiter({ limit: 10, windowMs: 10 * 60_000 })
const isBoard = (v: unknown): v is NoticeBoard => v === 'academic' || v === 'general'
const isId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v)

const refresh = () => {
  revalidatePath('/')
  revalidatePath('/notices')
  revalidatePath('/deadlines/[id]', 'page')
}

/** 화면이 보낸 값은 공지 번호만 믿는다: 제목·마감·신청 방법은 서버가 공지 목록(캐시)에서 다시 찾는다 */
export async function prepareNotice(board: string, noticeId: string) {
  const me = await requireUser()
  if (!isBoard(board) || !isId(noticeId) || !saveLimit(me.id)) return
  const { items } = await noticeCards(board, me.lang, 8)
  const n = items.find(x => x.id === noticeId)
  if (!n) return
  const due = n.deadline ? parseDue(n.deadline) : null
  const task = await getTaskStore().save({
    userId: me.id, board, noticeId,
    title: n.titleTr || n.title, titleKo: n.title,
    deadline: n.deadline, dueAt: due ? dueMs(due) : null,
    url: n.url, apply: n.apply,
  })
  refresh()
  // 한 번에 이어서: 준비 화면에서 캘린더 등록을 바로 띄우고, 제출처 안내와 메일 초안을 보여 준다
  redirect(`/deadlines/${task.id}?new=1`)
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

export type MailState =
  | { ok: true; draft: MailDraft; to: string; mailto: string; values: MailValues }
  | { ok: false; error: 'limit' | 'missing'; values?: MailValues }
  | undefined
type MailValues = { name: string; major: string; studentId: string; to: string }

const field = (f: FormData, k: string, max: number) => (cleanText(f.get(k)) ?? '').slice(0, max)

/**
 * 담당 부서에 보낼 메일 초안. 학생이 확인한 이름·학과·학번과, 서버가 다시 읽은 공지 내용으로 AI가 쓴다.
 * 받는 사람은 공지 본문에 실제로 적힌 주소 중에서만 고를 수 있다(본문에 없으면 비워 두고 메일 앱에서 넣는다)
 */
export async function draftMail(taskId: string, _: MailState, f: FormData): Promise<MailState> {
  const me = await requireUser()
  const values = { name: field(f, 'name', 30), major: field(f, 'major', 30), studentId: field(f, 'studentId', 20), to: field(f, 'to', 120) }
  if (!isId(taskId)) return { ok: false, error: 'missing', values }
  if (!mailLimit(me.id)) return { ok: false, error: 'limit', values }
  const task = await getTaskStore().get(me.id, taskId)
  if (!task) return { ok: false, error: 'missing', values }
  const allowed = await officeEmails(task)
  const to = allowed.includes(values.to.toLowerCase()) ? values.to.toLowerCase() : allowed[0] ?? ''
  const draft = await draftApplyMail(await mailInput(task, { name: values.name, major: values.major, studentId: values.studentId }), me.lang)
  return { ok: true, draft, to, mailto: mailtoHref(to, draft.subject, draft.body), values: { ...values, to } }
}
