'use client';

import { useState, useEffect } from 'react';
import { Download, Trash2, AlertTriangle, Loader2, Database, FileJson, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { recipeApi } from '@/lib/api/recipes';
import { mealPlanApi } from '@/lib/api/mealplans';
import { pantryApi } from '@/lib/api/pantry';
import toast from 'react-hot-toast';

type DataStats = {
  recipesCount: number;
  mealPlansCount: number;
  pantryItemsCount: number;
  shoppingListsCount: number;
};

export function DataSettings() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DataStats | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    fetchDataStats();
  }, []);

  const fetchDataStats = async () => {
    try {
      const [recipesResponse, mealPlansResponse, pantryResponse] = await Promise.all([
        recipeApi.getAll(),
        mealPlanApi.getAll(),
        pantryApi.getAll(),
      ]);

      setStats({
        recipesCount: recipesResponse.items.length,
        mealPlansCount: mealPlansResponse.items.length,
        pantryItemsCount: pantryResponse.items.length,
        shoppingListsCount: 0, // Shopping lists are session-based
      });
    } catch (error) {
      console.error('Failed to fetch data stats:', error);
    }
  };

  const exportData = async (format: 'json' | 'csv') => {
    setLoading(true);
    try {
      const [recipesResponse, mealPlansResponse, pantryResponse] = await Promise.all([
        recipeApi.getAll(),
        mealPlanApi.getAll(),
        pantryApi.getAll(),
      ]);

      const data = {
        recipes: recipesResponse.items,
        mealPlans: mealPlansResponse.items,
        pantryItems: pantryResponse.items,
        exportedAt: new Date().toISOString(),
      };

      if (format === 'json') {
        downloadJSON(data);
      } else {
        downloadCSV(data);
      }

      toast.success(`Data exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const downloadJSON = (data: any) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kitcha-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadCSV = (data: any) => {
    // Convert recipes to CSV
    const recipesCSV = convertToCSV(data.recipes, [
      'id', 'name', 'description', 'difficulty', 'prepTimeMinutes', 'cookTimeMinutes', 'servings'
    ]);

    // Convert meal plans to CSV
    const mealPlansCSV = convertToCSV(data.mealPlans, [
      'id', 'name', 'startDate', 'endDate', 'totalCostCents'
    ]);

    // Convert pantry items to CSV
    const pantryCSV = convertToCSV(data.pantryItems, [
      'id', 'name', 'quantity', 'unit', 'category', 'expiryDate'
    ]);

    const csvContent = `# Recipes\n${recipesCSV}\n\n# Meal Plans\n${mealPlansCSV}\n\n# Pantry Items\n${pantryCSV}`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kitcha-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const convertToCSV = (data: any[], fields: string[]) => {
    if (!data || data.length === 0) return 'No data';

    const header = fields.join(',');
    const rows = data.map(item =>
      fields.map(field => {
        const value = item[field];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
        return value;
      }).join(',')
    );

    return [header, ...rows].join('\n');
  };

  const deleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') {
      toast.error('Please type the confirmation text exactly');
      return;
    }

    setLoading(true);
    try {
      await apiClient.delete('/api/v1/users/account');
      toast.success('Account deleted successfully');
      // Redirect to login page
      window.location.href = '/login';
    } catch (error: any) {
      console.error('Delete account error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Statistics */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Your Data</h2>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Overview of your stored data in the application
        </p>

        {stats && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 mb-1">Recipes</p>
              <p className="text-2xl font-bold text-blue-900">{stats.recipesCount}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600 mb-1">Meal Plans</p>
              <p className="text-2xl font-bold text-green-900">{stats.mealPlansCount}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-purple-600 mb-1">Pantry Items</p>
              <p className="text-2xl font-bold text-purple-900">{stats.pantryItemsCount}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-orange-600 mb-1">Shopping Lists</p>
              <p className="text-2xl font-bold text-orange-900">{stats.shoppingListsCount}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Export Data */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Export Data</h2>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Download your data in JSON or CSV format
        </p>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => exportData('json')}
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileJson className="h-4 w-4" />
            )}
            Export as JSON
          </Button>
          <Button
            onClick={() => exportData('csv')}
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Export as CSV
          </Button>
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Your exported data includes all recipes, meal plans, and pantry items.
            You can use this backup to import your data later or for record keeping.
          </p>
        </div>
      </Card>

      {/* Delete Account */}
      <Card className="p-6 border-2 border-red-200">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Once you delete your account, there is no going back. Please be certain.
        </p>

        {!showDeleteConfirm ? (
          <Button
            onClick={() => setShowDeleteConfirm(true)}
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium mb-2">
                This action cannot be undone. This will permanently delete your account and remove all your data.
              </p>
              <p className="text-sm text-red-700">
                Please type <strong>DELETE MY ACCOUNT</strong> to confirm.
              </p>
            </div>

            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              className="block w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-red-500 focus:border-red-500"
            />

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                variant="outline"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={deleteAccount}
                disabled={loading || deleteConfirmText !== 'DELETE MY ACCOUNT'}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete My Account
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
