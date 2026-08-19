/** 화학공학부 학생 기준 관심 분야 분류. 추천 점수와 알림 매칭에 공용으로 쓴다. */
export type InterestKey =
  | "ACADEMIC"
  | "SCHOLARSHIP"
  | "CAREER"
  | "INTERNSHIP"
  | "GRAD_RESEARCH"
  | "CONTEST"
  | "EXCHANGE"
  | "STUDENT_LIFE"
  | "CERTIFICATE"
  | "ADMIN";

export interface Interest {
  key: InterestKey;
  label: string;
  description: string;
  keywords: string[];
}

export const INTERESTS: Interest[] = [
  {
    key: "ACADEMIC",
    label: "수강신청·학사",
    description: "수강신청, 전공배정, 선후수과목, 학점, 졸업요건",
    keywords: [
      "수강신청", "수강", "전공배정", "전공지망", "타전공", "선후수", "선수강",
      // "학사"는 학사학위와 혼동되므로 단독으로 쓰지 않는다.
      "학사일정", "학사안내", "학사공지", "학사경고",
      "학점", "졸업요건", "졸업사정", "이수", "교육과정", "성적", "재수강", "계절학기",
      "휴학", "복학", "학적", "시간표", "폐강", "수강정정",
    ],
  },
  {
    key: "SCHOLARSHIP",
    label: "장학금",
    description: "교내외 장학금, 국가장학, 근로장학, 학자금",
    keywords: [
      "장학", "장학금", "국가장학", "근로장학", "학자금", "등록금", "성적우수",
      "장학사정", "감면", "지원금", "생활비",
    ],
  },
  {
    key: "CAREER",
    label: "취업·채용",
    description: "기업 채용, 취업 특강, 채용설명회, 직무 정보",
    keywords: [
      "취업", "채용", "모집", "신입", "경력", "입사", "면접", "자기소개서",
      "이력서", "채용설명회", "취업특강", "잡페어", "커리어", "구인", "연구원 채용",
    ],
  },
  {
    key: "INTERNSHIP",
    label: "인턴·현장실습",
    description: "현장실습학기제, 인턴십, IPP, 산학협력 프로그램",
    keywords: [
      "현장실습", "인턴", "인턴십", "IPP", "산학", "실습학기", "채용연계",
      "직무체험", "해외인턴", "현장견학",
    ],
  },
  {
    key: "GRAD_RESEARCH",
    label: "대학원·연구",
    description: "대학원 진학, 연구실, 논문, 학술대회, BK21",
    keywords: [
      "대학원", "석사", "박사", "연구실", "연구원", "논문", "학술대회", "학회",
      "BK21", "연구과제", "세미나", "지도교수", "보충과목", "학위",
    ],
  },
  {
    key: "CONTEST",
    label: "공모전·대회",
    description: "공모전, 경진대회, 해커톤, 창업 경진",
    keywords: [
      "공모전", "경진대회", "대회", "콘테스트", "해커톤", "창업", "아이디어",
      "현상공모", "수상", "출품", "캡스톤",
    ],
  },
  {
    key: "EXCHANGE",
    label: "교환학생·어학",
    description: "교환학생, 해외연수, 어학시험, 어학성적",
    keywords: [
      "교환학생", "해외연수", "어학", "토익", "TOEIC", "TOEFL", "OPIc", "IELTS",
      "어학성적", "국제", "해외파견", "글로벌", "유학",
    ],
  },
  {
    key: "STUDENT_LIFE",
    label: "학생활동·행사",
    description: "동아리, 학생회, 축제, 특강, 상담, 건강",
    keywords: [
      "동아리", "학생회", "축제", "특강", "행사", "상담", "멘토링", "봉사",
      "체육대회", "MT", "간담회", "설명회", "워크숍", "건강", "심리",
    ],
  },
  {
    key: "CERTIFICATE",
    label: "자격증·교육",
    description: "자격증 과정, 직무교육, 온라인 강의, 프로그램 수료",
    keywords: [
      "자격증", "기사", "산업기사", "교육과정", "온라인교육", "수료", "이수증",
      "직무교육", "역량", "아카데미", "부트캠프", "청렴교육", "안전교육",
    ],
  },
  {
    key: "ADMIN",
    label: "병역·행정",
    description: "예비군, 공인출석, 증명서, 각종 신청·제출 행정",
    keywords: [
      "예비군", "병역", "군", "공인출석", "출석", "증명서", "제출", "신청서",
      "서류", "등록", "납부", "설문", "확인서", "코로나", "학생증",
    ],
  },
];

export const INTEREST_MAP: Record<string, Interest> = Object.fromEntries(
  INTERESTS.map((i) => [i.key, i]),
);

export function interestLabel(key: string): string {
  return INTEREST_MAP[key]?.label ?? key;
}

/** 학업 상태 */
export const ACADEMIC_STATUSES = [
  { key: "ENROLLED", label: "재학" },
  { key: "LEAVE", label: "휴학" },
  { key: "GRADUATING", label: "졸업예정" },
  { key: "GRAD_STUDENT", label: "대학원생" },
] as const;

export type AcademicStatus = (typeof ACADEMIC_STATUSES)[number]["key"];

export function academicStatusLabel(key: string | null | undefined): string {
  return ACADEMIC_STATUSES.find((s) => s.key === key)?.label ?? "미설정";
}

/** 출처 카테고리 */
export const SOURCE_CATEGORIES = [
  { key: "DEPT", label: "학부공지" },
  { key: "GRAD", label: "대학원" },
  { key: "SCHOLARSHIP", label: "장학" },
  { key: "INTERNSHIP", label: "현장실습" },
  { key: "CAREER", label: "취업" },
  { key: "UNIV", label: "학교 전체" },
  { key: "EVENT", label: "학술·행사" },
] as const;

export function sourceCategoryLabel(key: string): string {
  return SOURCE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/** 피드백 종류 */
export const FEEDBACK_KINDS = [
  { key: "RECOMMEND_GOOD", label: "추천이 유용해요" },
  { key: "RECOMMEND_BAD", label: "나와 관련 없어요" },
  { key: "SUMMARY_WRONG", label: "요약이 부정확해요" },
  { key: "CONTENT_ERROR", label: "내용에 오류가 있어요" },
] as const;

export function feedbackKindLabel(key: string): string {
  return FEEDBACK_KINDS.find((f) => f.key === key)?.label ?? key;
}
