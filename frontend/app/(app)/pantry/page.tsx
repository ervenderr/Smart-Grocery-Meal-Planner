'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { AddPantryItemModal } from '@/components/pantry/add-pantry-item-modal';
import { EditPantryItemModal } from '@/components/pantry/edit-pantry-item-modal';
import { PantryItemCard } from '@/components/pantry/pantry-item-card';
import { pantryApi } from '@/lib/api/pantry';
import toast from 'react-hot-toast';
import type { PantryItem } from '@/types/pantry.types';

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PantryItem | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await pantryApi.getAll({
        category: selectedCategory || undefined,
        search: searchQuery || undefined,
      });
      setItems(response.items || []);
    } catch (error: any) {
      console.error('Fetch pantry items error:', error);
      toast.error('Failed to load pantry items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selectedCategory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  const handleEdit = (item: PantryItem) => {
    setEditingItem(item);
    setShowEditModal(true);
  };

  const handleDelete = async (item: PantryItem) => {
    if (deleteConfirm?.id === item.id) {
      try {
        await pantryApi.delete(item.id);
        toast.success('Item deleted successfully');
        fetchItems();
        setDeleteConfirm(null);
      } catch (error: any) {
        console.error('Delete error:', error);
        toast.error('Failed to delete item');
      }
    } else {
      setDeleteConfirm(item);
      setTimeout(() => setDeleteConfirm(null), 3000);
      toast('Click delete again to confirm', { icon: '⚠️' });
    }
  };

  const getExpiringCount = () => {
    const today = new Date();
    return items.filter((item) => {
      if (!item.expiryDate) return false;
      const daysUntilExpiry = Math.ceil(
        (new Date(item.expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
    }).length;
  };

  const expiringCount = getExpiringCount();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Pantry</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your pantry inventory and track expiration dates
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* Expiring Soon Alert */}
      {expiringCount > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900">
                {expiringCount} item{expiringCount > 1 ? 's' : ''} expiring soon
              </h3>
              <p className="text-sm text-amber-700">
                Check your pantry to avoid food waste
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </form>

          {/* Category Filter */}
          <div className="w-full sm:w-64">
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="protein">Protein</option>
              <option value="vegetable">Vegetables</option>
              <option value="fruit">Fruits</option>
              <option value="dairy">Dairy</option>
              <option value="grains">Grains</option>
              <option value="spices">Spices</option>
              <option value="canned">Canned Goods</option>
              <option value="frozen">Frozen</option>
              <option value="beverages">Beverages</option>
              <option value="condiments">Condiments</option>
              <option value="other">Other</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Items Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="rounded-full bg-gray-100 p-4">
            <Filter className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No items found</h3>
          <p className="mt-2 text-sm text-gray-600">
            {searchQuery || selectedCategory
              ? 'Try adjusting your filters'
              : 'Get started by adding your first pantry item'}
          </p>
          {!searchQuery && !selectedCategory && (
            <Button onClick={() => setShowAddModal(true)} className="mt-4">
              <Plus className="h-4 w-4" />
              Add Your First Item
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <PantryItemCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <AddPantryItemModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchItems}
      />

      <EditPantryItemModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingItem(null);
        }}
        onSuccess={fetchItems}
        item={editingItem}
      />
    </div>
  );
}
