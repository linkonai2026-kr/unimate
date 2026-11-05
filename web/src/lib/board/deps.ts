// 서버 액션에서 쓰는 실제 의존성(스토어, 번역, 실시간 발행, 응답 후 실행)
import 'server-only'
import { after } from 'next/server'
import { translate } from '../ai'
import { publish } from '../live/bus'
import { getStore } from '../store'
import type { FlowDeps } from './flow'

export const flowDeps = (): FlowDeps => ({ store: getStore(), translate, publish, defer: fn => after(fn) })
