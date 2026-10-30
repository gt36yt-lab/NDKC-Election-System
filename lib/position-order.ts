export const POSITION_ORDER = [
  "President",
  "Vice-president",
  "Secretary",
  "Treasurer",
  "Auditor",
  "PIO",
  "Academic Commissioner",
  "Socio-Cultural Commissioner",
  "Sports Commissioner",
  "Youth Ministry Commissioner",
  "Peace Officer",
  "Business Managers",
  "Social Media Managers",
  "Governor",
  "Representative",
];

export const POSITION_OPTIONS = (["SHS", "JHS"] as const).flatMap((division) =>
  POSITION_ORDER.map((position) => {
    const label = position === "Vice-president" ? "Vice President" : position;
    const grades = division === "SHS" ? [11, 12] : [7, 8, 9, 10];
    return { value: `${label} (${division})`, division, grades };
  }),
);

export type CandidateEligibility = {
  position: string;
  allowed_grade_levels: number[] | null;
};

export function candidateDivision(candidate: { division: string | null; position: string; allowed_grade_levels: number[] | null }): "JHS" | "SHS" | "both" {
  if (candidate.division === "JHS" || candidate.division === "SHS") return candidate.division;
  const positionDivision = candidate.position.match(/\b(JHS|SHS)\b/i)?.[1]?.toUpperCase();
  if (positionDivision === "JHS" || positionDivision === "SHS") return positionDivision;
  if (candidate.allowed_grade_levels?.every((grade) => grade <= 10)) return "JHS";
  if (candidate.allowed_grade_levels?.every((grade) => grade >= 11)) return "SHS";
  return "both";
}

export function positionRank(position: string) {
  const normalized = position
    .replace(/\b(?:senior|junior)\s+high\s+school\b/gi, "")
    .replace(/\b(?:shs|jhs)\b/gi, "")
    .replace(/\bgrade\s+(?:[7-9]|1[0-2])\b/gi, "")
    .trim();
  if (/\bvice[-\s]?president\b/i.test(normalized)) {
    return POSITION_ORDER.indexOf("Vice-president");
  }
  const rank = POSITION_ORDER.findIndex((knownPosition) => normalized.toLowerCase().includes(knownPosition.toLowerCase()));
  return rank < 0 ? POSITION_ORDER.length : rank;
}

export function comparePositions(left: string, right: string) {
  const rankDifference = positionRank(left) - positionRank(right);
  return rankDifference || left.localeCompare(right);
}

export function sortPositions<T>(groups: [string, T][]) {
  return groups.sort(([left], [right]) => comparePositions(left, right));
}

export function isMultipleSelectionPosition(position: string) {
  const normalized = position.toLowerCase();
  return normalized.includes("business manager") || normalized.includes("social media manager");
}

export function candidateMatchesGrade<T extends CandidateEligibility>(candidate: T, gradeLevel: number) {
  const allowedGrades = candidate.allowed_grade_levels;
  if (allowedGrades && !allowedGrades.includes(gradeLevel)) return false;

  const positionGrade = candidate.position.match(/\bgrade\s*(7|8|9|10|11|12)\b/i);
  if (positionGrade && Number(positionGrade[1]) !== gradeLevel) return false;

  const normalized = candidate.position.toLowerCase();
  if (/\b(?:jhs|junior high school)\b/.test(normalized) && gradeLevel > 10) return false;
  if (/\b(?:shs|senior high school)\b/.test(normalized) && gradeLevel < 11) return false;

  return true;
}

export function schoolDivision(gradeLevel: number) {
  return gradeLevel >= 11 ? "Senior High School (SHS)" : "Junior High School (JHS)";
}
