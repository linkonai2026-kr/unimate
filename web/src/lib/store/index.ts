// 환경에 맞는 스토어 하나를 프로세스 전체에서 공유(Supabase 키가 있으면 Supabase, 없으면 메모리). 개발 중 모듈을 다시 불러도 데이터가 남게 globalThis에 둔다
import { has } from '../env'
import { createMemoryStore } from './memory'
import { createSupabaseStore } from './supabase'
import type { Store } from './types'

const g = globalThis as typeof globalThis & { __unimateStore?: Store }

export function getStore(): Store {
  return (g.__unimateStore ??= has.db ? createSupabaseStore() : createMemoryStore(true))
}
