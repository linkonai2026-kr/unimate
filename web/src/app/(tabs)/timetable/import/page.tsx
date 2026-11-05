// 시간표 캡처 업로드 화면(?t=시간표 id, 없으면 이번 학기 기본 시간표)
import ImportTimetable from '@/components/ImportTimetable'
import { requireUser } from '@/lib/auth/session'
import { resolveTable } from '@/lib/timetable/view'

export default async function ImportPage({ searchParams }: PageProps<'/timetable/import'>) {
  const me = await requireUser()
  const { table } = await resolveTable(me.id, await searchParams)
  return <ImportTimetable lang={me.lang} tableId={table.id} />
}
