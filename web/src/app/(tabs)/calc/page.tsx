// 학점계산기 화면(학기별 과목·학점·성적·전공 입력, 전체·전공 평점과 취득 학점)
import GradeEditor from '@/components/GradeEditor'
import { requireUser } from '@/lib/auth/session'
import { getStore } from '@/lib/store'

export default async function CalcPage() {
  const me = await requireUser()
  return <GradeEditor lang={me.lang} initial={await getStore().getGrades(me.id)} />
}
