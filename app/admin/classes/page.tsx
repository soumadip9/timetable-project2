'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Class } from '@/types';
import CRUDTable from '@/components/CRUDTable';
import EntityModal from '@/components/EntityModal';

export default function AdminClassesPage() {
  const router = useRouter();
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

  const handleSave = async (data: Omit<Class, 'id'>) => {
    try {
      const res = editingClass
        ? await fetch('/api/classes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingClass.id, ...data }),
          })
        : await fetch('/api/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
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
    if (!confirm('Are you sure you want to delete this class? This will also delete all associated timetable entries.')) {
      return;
    }
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

  const handleViewTimetable = (classId: string) => {
    router.push(`/admin/classes/${classId}/timetable`);
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
        <div className="mb-6">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
        </div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Manage Classes</h1>
        </div>
        <CRUDTable
          title="Classes"
          columns={[
            { 
              key: 'name', 
              label: 'Name',
              render: (value, item) => (
                <button
                  onClick={() => handleViewTimetable(item.id)}
                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {value}
                </button>
              ),
            },
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
            { key: 'grade', label: 'Grade', type: 'number', required: true },
          ]}
          initialData={editingClass || undefined}
        />
      </div>
    </div>
  );
}

