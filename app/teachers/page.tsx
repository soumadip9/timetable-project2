'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
// Removed localStorage - using API calls instead
import type { Teacher } from '@/types';
import CRUDTable from '@/components/CRUDTable';
import EntityModal from '@/components/EntityModal';

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/teachers');
      if (!res.ok) {
        console.error('Failed to load teachers:', res.status);
        setTeachers([]);
        return;
      }
      const result = await res.json();
      setTeachers(result.teachers || []);
    } catch (error) {
      console.error('Error loading teachers:', error);
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingTeacher(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: Teacher) => {
    setEditingTeacher(item);
    setIsModalOpen(true);
  };

  const handleSave = async (data: Record<string, any>) => {
    try {
      const teacherData = {
        name: data.name as string,
        email: data.email as string,
        specialization: data.specialization as string,
      };
      const res = editingTeacher
        ? await fetch('/api/teachers', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingTeacher.id, ...teacherData }),
          })
        : await fetch('/api/teachers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(teacherData),
          });

      if (res.ok) {
        await loadTeachers();
        setIsModalOpen(false);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save teacher');
      }
    } catch (error) {
      console.error('Error saving teacher:', error);
      alert('Failed to save teacher');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this teacher?')) return;
    
    try {
      const res = await fetch('/api/teachers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      
      if (res.ok) {
        await loadTeachers();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete teacher');
      }
    } catch (error) {
      console.error('Error deleting teacher:', error);
      alert('Failed to delete teacher');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="mb-4 text-blue-600 hover:text-blue-800">
          ← Back to Dashboard
        </Link>
        <CRUDTable
          title="Teachers"
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'specialization', label: 'Specialization' },
          ]}
          data={teachers}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
          getDisplayName={(item) => item.name}
        />
        <EntityModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          title={editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'email', label: 'Email', type: 'email', required: true },
            { key: 'specialization', label: 'Specialization', required: true },
          ]}
          initialData={editingTeacher || undefined}
        />
      </div>
    </div>
  );
}

