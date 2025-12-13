'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
// Removed localStorage - using API calls instead
import type { Subject } from '@/types';
import CRUDTable from '@/components/CRUDTable';
import EntityModal from '@/components/EntityModal';

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      const res = await fetch('/api/subjects');
      const result = await res.json();
      setSubjects(result.success ? result.data : []);
    } catch (error) {
      console.error('Error loading subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingSubject(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: Subject) => {
    setEditingSubject(item);
    setIsModalOpen(true);
  };

  const handleSave = async (data: Record<string, any>) => {
    try {
      const subjectData = {
        name: data.name as string,
        code: data.code as string,
      };
      const res = editingSubject
        ? await fetch('/api/subjects', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingSubject.id, ...subjectData }),
          })
        : await fetch('/api/subjects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subjectData),
          });

      if (res.ok) {
        await loadSubjects();
        setIsModalOpen(false);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save subject');
      }
    } catch (error) {
      console.error('Error saving subject:', error);
      alert('Failed to save subject');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/subjects?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadSubjects();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete subject');
      }
    } catch (error) {
      console.error('Error deleting subject:', error);
      alert('Failed to delete subject');
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
          title="Subjects"
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'code', label: 'Code' },
          ]}
          data={subjects}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
          getDisplayName={(item) => `${item.name} (${item.code})`}
        />
        <EntityModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          title={editingSubject ? 'Edit Subject' : 'Add New Subject'}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'code', label: 'Code', required: true },
          ]}
          initialData={editingSubject || undefined}
        />
      </div>
    </div>
  );
}

