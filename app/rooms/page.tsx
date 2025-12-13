'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
// Removed localStorage - using API calls instead
import type { Room } from '@/types';
import CRUDTable from '@/components/CRUDTable';
import EntityModal from '@/components/EntityModal';

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      const result = await res.json();
      setRooms(result.success ? result.data : []);
    } catch (error) {
      console.error('Error loading rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingRoom(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: Room) => {
    setEditingRoom(item);
    setIsModalOpen(true);
  };

  const handleSave = async (data: Record<string, any>) => {
    try {
      const roomData = {
        name: data.name as string,
        capacity: typeof data.capacity === 'number' ? data.capacity : Number(data.capacity),
        building: data.building as string,
      };
      const res = editingRoom
        ? await fetch('/api/rooms', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingRoom.id, ...roomData }),
          })
        : await fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(roomData),
          });

      if (res.ok) {
        await loadRooms();
        setIsModalOpen(false);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save room');
      }
    } catch (error) {
      console.error('Error saving room:', error);
      alert('Failed to save room');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/rooms?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadRooms();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete room');
      }
    } catch (error) {
      console.error('Error deleting room:', error);
      alert('Failed to delete room');
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
          title="Rooms"
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'capacity', label: 'Capacity' },
            { key: 'building', label: 'Building' },
          ]}
          data={rooms}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
          getDisplayName={(item) => `${item.name} (${item.building})`}
        />
        <EntityModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          title={editingRoom ? 'Edit Room' : 'Add New Room'}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'capacity', label: 'Capacity', type: 'number', required: true },
            { key: 'building', label: 'Building', required: true },
          ]}
          initialData={editingRoom || undefined}
        />
      </div>
    </div>
  );
}

