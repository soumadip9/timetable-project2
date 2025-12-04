import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      role: 'ADMIN' | 'TEACHER';
      teacherId?: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'teacher';
    image?: string | null;
    teacherId?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'admin' | 'teacher';
    teacherId?: string | null;
  }
}

