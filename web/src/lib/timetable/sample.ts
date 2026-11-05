// 데모용 가상 유학생 시간표(실제 사람의 시간표가 아님). 캡처 이미지 docs/superpowers/specs/assets/demo-timetable.png와 같은 내용
import type { ParsedCourse } from '../ai'

/** 데모 캡처(demo-timetable.png)의 정답. 키 없는 대역 인식 결과로도 쓴다 */
export const SAMPLE_TIMETABLE: ParsedCourse[] = [
  { name: '한국어회화1', place: '인문사회과학관 강의실[105호]', day: 0, start: '10:00', end: '12:00' },
  { name: '자료구조', place: '제1공학관 강의실[203호]', day: 0, start: '13:00', end: '16:00' },
  { name: '컴퓨터네트워크', place: '5공학관 네트워크실험실[304호]', day: 1, start: '09:00', end: '12:00' },
  { name: '데이터베이스실습', place: '5공학관 컴퓨터멀티미디어실[405호]', day: 1, start: '14:00', end: '18:00' },
  { name: '운영체제', place: '제2공학관 강의실[301호]', day: 2, start: '09:00', end: '12:00' },
  { name: '한국문화의이해', place: '인문사회과학관 강의실[106호]', day: 2, start: '14:00', end: '16:00' },
  { name: '대학영어', place: '그린에너지연구관 강의실[303호]', day: 4, start: '10:00', end: '12:00' },
  { name: '배드민턴', place: '체육관[101호]', day: 4, start: '13:00', end: '15:00' },
]
