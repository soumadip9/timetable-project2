'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
// Removed localStorage - using API calls instead
import type { Class } from '@/types';
import CRUDTable from '@/components/CRUDTable';
import EntityModal from '@/components/EntityModal';

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const res = await fetch('/api/classes');
      const result = await res.json();
      setClasses(result.success ? result.data : []);
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingClass(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: Class) => {
    setEditingClass(item);
    setIsModalOpen(true);
  };

  const handleSave = async (data: Record<string, any>) => {
    try {
      const classData = {
        name: data.name as string,
        section: data.section as string,
        grade: typeof data.grade === 'number' ? data.grade : Number(data.grade),
      };
      const res = editingClass
        ? await fetch('/api/classes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingClass.id, ...classData }),
          })
        : await fetch('/api/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(classData),
          });

      if (res.ok) {
        await loadClasses();
        setIsModalOpen(false);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save class');
      }
    } catch (error) {
      console.error('Error saving class:', error);
      alert('Failed to save class');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/classes?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadClasses();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete class');
      }
    } catch (error) {
      console.error('Error deleting class:', error);
      alert('Failed to delete class');
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
          title="Classes"
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'section', label: 'Section' },
            { key: 'grade', label: 'Grade' },
          ]}
          data={classes}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
          getDisplayName={(item) => `${item.name} - ${item.section}`}
        />
        <EntityModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          title={editingClass ? 'Edit Class' : 'Add New Class'}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'section', label: 'Section', required: true },
            { key: 'grade', label: 'Grade', required: true },
          ]}
          initialData={editingClass || undefined}
        />
      </div>
    </div>
  );
}

