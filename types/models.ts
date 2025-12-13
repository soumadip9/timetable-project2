// MongoDB-style document types and shared enums
// This file provides types for compatibility with @/types/models imports

export type Id = string;

export type ClassDoc = {
  id: Id;
  name: string; // e.g. "10 A"
  section: string; // e.g. "A"
  grade: number; // e.g. 10
};

export type TeacherDoc = {
  id: Id;
  name: string;
  email: string;
  specialization: string; // e.g. "Mathematics"
};

export type SubjectDoc = {
  id: Id;
  name: string;
  code: string; // e.g. "MAT101"
};

export type RoomDoc = {
  id: Id;
  name: string; // e.g. "Room 201"
  capacity: number;
  building: string; // e.g. "Main Block"
};

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

export type TimeSlot =
  | '09:00-10:00'
  | '10:00-11:00'
  | '11:00-12:00'
  | '12:00-13:00'
  | '13:00-14:00'
  | '14:00-15:00'
  | '15:00-16:00'
  | '16:00-17:00';

export type TimetableDoc = {
  id: Id;
  classId: Id;
  day: DayOfWeek;
  timeSlot: TimeSlot;
  subjectId: Id;
  teacherId: Id;
  roomId: Id;
};

export type Collections = {
  classes: ClassDoc[];
  teachers: TeacherDoc[];
  subjects: SubjectDoc[];
  rooms: RoomDoc[];
  timetables: TimetableDoc[];
};
