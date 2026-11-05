// 비밀번호 변경 화면
import PasswordForm from '@/components/PasswordForm'
import { requireUser } from '@/lib/auth/session'

export default async function PasswordPage() {
  const me = await requireUser()
  return <PasswordForm lang={me.lang} />
}
