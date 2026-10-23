"use server";

import { createClient } from "@/lib/supabase/server";
import { candidateMatchesGrade, isMultipleSelectionPosition } from "@/lib/position-order";

type SubmittedVote = { candidate_id: string; position: string };

export async function submitBallot(input: { lrn: string; otp: string; votes: SubmittedVote[] }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Sign in again before voting." };

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("lrn, grade_level, has_voted, has_agreed_terms")
    .eq("id", user.id)
    .maybeSingle();

  if (studentError || !student) return { error: "Your student profile could not be verified." };
  if (!student.has_agreed_terms) return { error: "Please accept the election terms before voting." };
  if (student.has_voted) return { error: "Our records show that your ballot has already been submitted." };
  if (!student.lrn || input.lrn.trim() !== student.lrn) return { error: "The Student ID does not match your student account." };
  if (!input.otp.trim()) return { error: "Enter the OTP provided for your ballot." };
  if (input.votes.length === 0) return { error: "Select at least one candidate before continuing." };

  const candidateIds = [...new Set(input.votes.map((vote) => vote.candidate_id))];
  if (candidateIds.length !== input.votes.length) return { error: "A candidate can only be selected once." };

  const { data: candidates, error: candidateError } = await supabase
    .from("candidates")
    .select("id, position, allowed_grade_levels");

  if (candidateError || !candidates) return { error: "Candidate eligibility could not be verified." };

  const gradeLevel = Number(student.grade_level);
  const eligibleCandidates = candidates.filter((candidate) => candidateMatchesGrade(candidate, gradeLevel));
  const eligiblePositions = new Set(eligibleCandidates.map((candidate) => candidate.position));
  const submittedByPosition = new Map<string, SubmittedVote[]>();
  for (const vote of input.votes) {
    const group = submittedByPosition.get(vote.position) ?? [];
    group.push(vote);
    submittedByPosition.set(vote.position, group);
  }
  for (const [position, positionVotes] of submittedByPosition) {
    const maxSelections = isMultipleSelectionPosition(position) ? 2 : 1;
    if (positionVotes.length > maxSelections) return { error: `${position} allows up to ${maxSelections} selections.` };
    if (!eligiblePositions.has(position)) return { error: "Your ballot contains a position that is not eligible for your grade." };
  }
  const requiredPositions = [...eligiblePositions].filter((position) => !isMultipleSelectionPosition(position));
  if (requiredPositions.some((position) => !submittedByPosition.has(position))) {
    return { error: "Select one candidate for every required position on your ballot." };
  }

  const validVotes = input.votes.every((vote) => {
    const candidate = eligibleCandidates.find((item) => item.id === vote.candidate_id);
    return candidate
      && candidate.position === vote.position
  });
  if (!validVotes) return { error: "Your ballot contains a candidate who is not eligible for your grade." };

  const { error: rpcError } = await supabase.rpc("submit_student_ballot", {
    p_student_id: user.id,
    p_student_lrn: student.lrn,
    p_provided_otp: input.otp.trim(),
    p_votes: input.votes,
  });

  if (rpcError) return { error: "The ballot could not be submitted. Check your OTP and try again." };
  return { success: true };
}