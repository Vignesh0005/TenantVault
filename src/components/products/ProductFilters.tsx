import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';

interface ProductFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
  canCreate: boolean;
}

export function ProductFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  categories,
  canCreate,
}: ProductFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex-1 sm:max-w-sm">
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or SKU…"
          leftIcon={<Search className="h-4 w-4" />}
          aria-label="Search products"
        />
      </div>
      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        aria-label="Filter by category"
        className="h-9 rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm text-slate-700 shadow-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 sm:w-48"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {canCreate && (
        <Link
          to="/products/new"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white shadow-sm transition-colors duration-300 hover:bg-accent/90 sm:ml-auto"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Link>
      )}
    </div>
  );
}
