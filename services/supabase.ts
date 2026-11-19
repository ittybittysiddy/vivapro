// services/supabase.ts
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';


//creates a supabase object to connect to the database. exporting it to every other file will be able to use it
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// TYPE HELPERS  the tables and the cols inside the tables 
// ─────────────────────────────────────────────────────────────────────────────

//cols of the classes table - used by createclass and loadappdata
export type DBClass = {
  id: string;
  name: string;
  subject: string;
  teacher_id: string;
  teacher_name: string;
  join_code: string;
  created_at: number;
};

//used by addmember and removemember
export type DBClassMember = {
  id?: string;
  class_id: string; //FK 
  user_id: string; //FUI of student
  name: string;
  email: string;
  joined_at: number;
};

//addpendingrequest,deletependingrequest
export type DBPendingRequest = {
  id?: string;
  class_id: string; //FK
  user_id: string;
  name: string;
  email: string;
  requested_at: number;
  method: 'code' | 'email';
};
//used by createAssignment, loadappdata

export type DBAssignment = {
  id: string;
  name: string;
  class_id: string;
  teacher_id: string;
  status: 'Draft' | 'Published';
  questions: { id: string; question: string; modelAnswer: string }[];
  created_at: number;
  allowed_modes?: string[];
  time_limit_minutes?: number | null;  // null = no limit
};

//used by createsubmission and updatesubmissionGrade
export type DBSubmission = {
  id: string;
  assignment_id: string; //fk
  student_id: string;
  student_name: string;
  student_email: string;
  answers: string[];
  results: { score: number; feedback: string }[] | null;
  status: 'Pending' | 'Graded';
  violations: number; //total violations count
  submitted_at: number;
  graded_at?: number;
  answer_edit_flags: string[];      // per-question: 'none' | 'edited' | 'replaced'
  original_answers: string[];       // raw voice transcript before student edited
  follow_up_questions?: string[];   // AI-generated follow-up questions from student's assignment
};

//used by createContestRequest, updateContestRequest, loadAppData
export type DBContestRequest = {
  id: string;
  student_id: string;
  student_name: string;
  assignment_id: string;
  assignment_name: string;
  submission_id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: number;
  teacher_id: string;
  teacher_note?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// LOAD ALL APP DATA  (called once after login in APP.tsx)
// ─────────────────────────────────────────────────────────────────────────────

//promise.all = running all db queries at the same time which is faster than sequential
export async function loadAppData() {
  const [
    { data: classes },
    { data: members },
    { data: pending },
    { data: assignments },
    { data: submissions },
    { data: contestRequests },
  ] = await Promise.all([
    supabase.from('classes').select('*'),
    supabase.from('class_members').select('*'),
    supabase.from('pending_requests').select('*'),
    supabase.from('assignments').select('*'),
    supabase.from('submissions').select('*'),
    supabase.from('contest_requests').select('*'),  //load contest requests for both teacher and student
  ]);

//joins tables to find the members whose class_id matches the this certain class id in members and join them
//using it to correctly sort the student in the correct class
  const stitchedClasses = (classes || []).map((c: DBClass) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    teacherId: c.teacher_id,
    teacherName: c.teacher_name,
    joinCode: c.join_code,
    createdAt: c.created_at,
    members: (members || [])
      .filter((m: DBClassMember) => m.class_id === c.id)
      .map((m: DBClassMember) => ({ userId: m.user_id, name: m.name, email: m.email, joinedAt: m.joined_at })),
    pendingRequests: (pending || [])
      .filter((p: DBPendingRequest) => p.class_id === c.id)
      .map((p: DBPendingRequest) => ({ userId: p.user_id, name: p.name, email: p.email, requestedAt: p.requested_at, method: p.method })),
  }));

//the submitted assignments use assignment_id
  const stitchedAssignments = (assignments || []).map((a: DBAssignment) => ({
    id: a.id,
    name: a.name,
    classId: a.class_id,
    teacherId: a.teacher_id,
    status: a.status,
    questions: a.questions,
    createdAt: a.created_at,
    allowedModes: (a.allowed_modes && a.allowed_modes.length > 0) ? a.allowed_modes : ['text', 'voice'],//removed video
    timeLimitMinutes: a.time_limit_minutes ?? null,
    submissions: (submissions || [])
      .filter((s: DBSubmission) => s.assignment_id === a.id)
      .map((s: DBSubmission) => ({
        id: s.id,
        studentId: s.student_id,
        studentName: s.student_name,
        studentEmail: s.student_email,
        answers: s.answers,
        results: s.results,
        status: s.status,
        violations: s.violations,
        submittedAt: s.submitted_at,
        gradedAt: s.graded_at,  // maps to the 7-day contest window check in StudentDashboard
        modeUsed: (s as any).mode_used || 'text',
        answerEditFlags: s.answer_edit_flags || [],
        originalAnswers: s.original_answers || [],
        followUpQuestions: s.follow_up_questions || [],
      })),
  }));

  //map snake_case db cols back to camelCase for the frontend
  const stitchedContestRequests = (contestRequests || []).map((r: DBContestRequest) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    assignmentId: r.assignment_id,
    assignmentName: r.assignment_name,
    submissionId: r.submission_id,
    reason: r.reason,
    status: r.status,
    requestedAt: r.requested_at,
    teacherId: r.teacher_id,
    teacherNote: r.teacher_note ?? undefined,
  }));

  return { classes: stitchedClasses, assignments: stitchedAssignments, contestRequests: stitchedContestRequests };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLASS OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

//go to the classes table in the supabase and insert another row
export async function createClass(cls: DBClass) {
  await supabase.from('classes').insert({
    id: cls.id,
    name: cls.name,
    subject: cls.subject,
    teacher_id: cls.teacher_id,
    teacher_name: cls.teacher_name,
    join_code: cls.join_code,
    created_at: cls.created_at,
  });
}

export async function deleteClass(classId: string) {
  // Cascades to members, pending_requests, assignments, submissions via FK
  await supabase.from('classes').delete().eq('id', classId);
}

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER / PENDING REQUEST OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function addPendingRequest(req: DBPendingRequest) {
  await supabase.from('pending_requests').insert({
    class_id: req.class_id,
    user_id: req.user_id,
    name: req.name,
    email: req.email,
    requested_at: req.requested_at,
    method: req.method,
  });
}

export async function deletePendingRequest(classId: string, userId: string) {
//.eq( sql equiqvalent) here chaining converts it to an AND condition
  await supabase.from('pending_requests').delete().eq('class_id', classId).eq('user_id', userId);
}

export async function addMember(member: DBClassMember) {
  await supabase.from('class_members').insert({
    class_id: member.class_id,
    user_id: member.user_id,
    name: member.name,
    email: member.email,
    joined_at: member.joined_at,
  });
}

export async function removeMember(classId: string, userId: string) {
  await supabase.from('class_members').delete().eq('class_id', classId).eq('user_id', userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNMENT OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createAssignment(asgn: DBAssignment) {
  await supabase.from('assignments').insert({
    id: asgn.id,
    name: asgn.name,
    class_id: asgn.class_id,
    teacher_id: asgn.teacher_id,
    status: asgn.status,
    questions: asgn.questions,
    created_at: asgn.created_at,
    allowed_modes: asgn.allowed_modes || ['text', 'voice'],
    time_limit_minutes: asgn.time_limit_minutes ?? null,
  });
}

export async function updateAssignmentStatus(asgnId: string, status: 'Draft' | 'Published') {
  await supabase.from('assignments').update({ status }).eq('id', asgnId);
}

export async function updateAssignmentTimeLimit(asgnId: string, timeLimitMinutes: number | null) {
  await supabase.from('assignments').update({ time_limit_minutes: timeLimitMinutes }).eq('id', asgnId);
}

export async function deleteAssignment(asgnId: string) {
  await supabase.from('assignments').delete().eq('id', asgnId);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBMISSION OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createSubmission(sub: DBSubmission & { mode_used?: string; follow_up_questions?: string[] }) {
  await supabase.from('submissions').insert({
    id: sub.id,
    assignment_id: sub.assignment_id,
    student_id: sub.student_id,
    student_name: sub.student_name,
    student_email: sub.student_email,
    answers: sub.answers,
    results: sub.results,
    status: sub.status,
    violations: sub.violations,
    submitted_at: sub.submitted_at,
    mode_used: sub.mode_used || 'text',
    answer_edit_flags: sub.answer_edit_flags || [],
    original_answers: sub.original_answers || [],
    follow_up_questions: sub.follow_up_questions || [],
  });
}

//used in teacher dashboard after geminiservice returns the grades 
//takes subid and array result and update the submission row in submissions table
export async function updateSubmissionGrade(
  subId: string,
  results: { score: number; feedback: string }[]
) {
  await supabase
    .from('submissions')
    .update({ results, status: 'Graded', graded_at: Date.now() })
    .eq('id', subId);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEST REQUEST OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

//called when student submits a contest request from their Contest Grade tab
export async function createContestRequest(req: DBContestRequest) {
  await supabase.from('contest_requests').insert({
    id: req.id,
    student_id: req.student_id,
    student_name: req.student_name,
    assignment_id: req.assignment_id,
    assignment_name: req.assignment_name,
    submission_id: req.submission_id,
    reason: req.reason,
    status: req.status,
    requested_at: req.requested_at,
    teacher_id: req.teacher_id,
    teacher_note: req.teacher_note || null,
  });
}

//called when teacher approves (with optional note) or rejects a contest request
export async function updateContestRequest(
  contestId: string,
  status: 'approved' | 'rejected',
  teacherNote?: string
) {
  await supabase
    .from('contest_requests')
    .update({ status, teacher_note: teacherNote || null })
    .eq('id', contestId);
}

// ─────────────────────────────────────────────────────────────────────────────
// VIOLATION SCREENSHOT OPERATIONS  (stored for 7 days only)
// Bucket: violation-screenshots   (public read, authenticated write)
// File path pattern: {submissionId}/{timestamp}.jpg
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a single violation screenshot to Supabase Storage.
 * Called fire-and-forget from StudentDashboard when a camera violation fires.
 * Returns the public URL, or null on failure (never throws).
 */
export async function uploadViolationScreenshot(
  submissionId: string,
  jpegBlob: Blob, //actual image file
): Promise<string | null> {
  try {
    const fileName = `${submissionId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from('violation-screenshots')
      //upsert means do not overwrite existing file
      .upload(fileName, jpegBlob, { contentType: 'image/jpeg', upsert: false });
    if (error) { console.error('Screenshot upload failed:', error); return null; }
    const { data } = supabase.storage
      .from('violation-screenshots')
      //allowing teacher to view that screenshot
      .getPublicUrl(fileName);
    return data?.publicUrl ?? null;
  } catch (err) {
    console.error('Screenshot upload exception:', err);
    return null;
  }
}

/**
 * Fetch all violation screenshot URLs for a given submission.
 * Returns an array of public URLs (may be empty if none exist or bucket is empty).
 * Used by TeacherDashboard in Grades and Contests tabs.
 */
export async function getViolationScreenshots(submissionId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage
      .from('violation-screenshots')
      .list(submissionId, { sortBy: { column: 'name', order: 'asc' } });
    if (error || !data) return [];
    return data.map(file => {
      const { data: urlData } = supabase.storage
        .from('violation-screenshots')
        .getPublicUrl(`${submissionId}/${file.name}`);
      return urlData?.publicUrl ?? '';
    }).filter(Boolean);
  } catch (err) {
    console.error('Failed to fetch violation screenshots:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VIOLATION LOG OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function logViolation(entry: {
  user_id: string;
  assignment_id: string;
  submission_id?: string;
  type: string;
  mode: 'text' | 'voice' ;
  notes?: string;
  evidence_url?: string;
}) {
  const { error } = await supabase.from('violation_logs').insert({
    user_id: entry.user_id,
    assignment_id: entry.assignment_id,
    submission_id: entry.submission_id || null,
    type: entry.type,
    mode: entry.mode,
    timestamp: Date.now(),
    notes: entry.notes || '',
    evidence_url: entry.evidence_url || null,
  });
  if (error) throw new Error(`violation_logs insert failed: ${error.message}`);
}
