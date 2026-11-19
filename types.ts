//dictionary used by app.tsx to route to the correct dashboard in login.tsx to set role 
//on signup and layout.tsx to display right dashbaord

//this file defines the shape of every data to catch mismatches at compile time to avoid run time crashes

export enum UserRole {
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  NONE = 'NONE'
}

//each question that the teacher writes has a question and model answer
//here the model answer is sent to gemini with study response to auto grade

export interface QuestionPair {
  id: string;
  question: string;
  modelAnswer: string;
}


export interface QuestionResult {
  score: number;
  feedback: string;
}


export interface StudentSubmission {
  id: string;
  studentName: string;
  studentId: string;
  answers: string[];
  results?: QuestionResult[];
  status: 'Pending' | 'Graded';
  submittedAt: number;
  gradedAt?: number;          // set when teacher saves grades — used for 7-day contest window
  violations: number;
  tabViolations?: number;     // tab/window switching count
  proctoringViolations?: number; // camera-based violation count
  videoViolationLog?: string[]; // detailed log of each camera event
  modeUsed?: 'text' | 'voice' | 'video';
  proctoringEvents?: ProctoringEvent[];
  faceFlags?: number;
  gazeFlags?: number;
}


export interface Assignment {
  id: string;
  name: string;
  questions: QuestionPair[];
  submissions: StudentSubmission[];
  classId: string;
  teacherId: string;
  status: 'Draft' | 'Published';
  createdAt: number;
  allowedModes?: ('text' | 'voice' | 'video')[];
}

export interface ClassMember {
  userId: string;
  name: string;
  email: string;
  joinedAt: number;
}

export interface JoinRequest {
  userId: string;
  name: string;
  email: string;
  requestedAt: number;
  method: 'code' | 'email'; // how they requested to join
}

export interface Class {
  id: string;
  name: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  joinCode: string;       // 6-char alphanumeric code
  members: ClassMember[]; // approved students
  pendingRequests: JoinRequest[]; // awaiting teacher approval
  createdAt: number;
}

//a student's request to have their grade reviewed by the teacher
//created when student submits from the Contest Grade tab (within 7 days of grading)
export interface ContestRequest {
  id: string;
  studentId: string;
  studentName: string;
  assignmentId: string;
  assignmentName: string;
  submissionId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: number;
  teacherId: string;
  teacherNote?: string; // optional note from teacher shown to student on approval
}

export interface AppData {
  classes: Class[];
  assignments: Assignment[];
  contestRequests?: ContestRequest[]; // optional so existing data without it won't crash
}

//each time flask server detects violation a proctoringevent is created and stored in the submission 
export interface ProctoringEvent {
  id?: string;
  timestamp: string;
  type: 'no_face' | 'multiple_faces' | 'looking_away' | 'object_detected';
  details: string;
}