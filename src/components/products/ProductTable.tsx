import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, ImageOff, Pencil, Trash2 } from 'lucide-react';
import { Table, type Column } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { Product } from '@/types';

interface ProductTableProps {
  products: Product[] | undefined;
  loading: boolean;
  refreshing: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (product: Product) => void;
  empty: ReactNode;
  defaultLowStockThreshold?: number;
}

function Thumbnail({ product }: { product: Product }) {
  if (!product.imageUrl) {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
        <ImageOff className="h-4 w-4" />
      </span>
    );
  }
  return (
    <img
      src={product.imageUrl}
      alt=""
      loading="lazy"
      className="h-10 w-10 rounded-lg border border-slate-200 object-cover"
    />
  );
}

const actionClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900';

export function ProductTable({
  products,
  loading,
  refreshing,
  canEdit,
  canDelete,
  onDelete,
  empty,
  defaultLowStockThreshold = 10,
}: ProductTableProps) {
  const navigate = useNavigate();

  const columns: Column<Product>[] = [
    { key: 'image', header: <span className="sr-only">Image</span>, render: (p) => <Thumbnail product={p} />, className: 'w-14' },
    { key: 'sku', header: 'SKU', render: (p) => <span className="font-mono text-xs text-slate-600">{p.sku}</span> },
    {
      key: 'name',
      header: 'Name',
      render: (p) => <span className="font-medium text-slate-900">{p.name}</span>,
      className: 'max-w-[240px] truncate',
    },
    {
      key: 'category',
      header: 'Category',
      render: (p) => (p.category ? <Badge>{p.category}</Badge> : <span className="text-slate-400">—</span>),
    },
    {
      key: 'price',
      header: 'Price',
      render: (p) => formatCurrency(p.price),
      className: 'text-right tabular-nums',
      headerClassName: 'text-right',
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (p) => {
        const threshold = p.lowStockThreshold ?? defaultLowStockThreshold;
        const low = p.quantity <= threshold;
        return (
          <span className={`tabular-nums ${low ? 'font-semibold text-red-600' : ''}`}>
            {formatNumber(p.quantity)}
            {low && <span className="ml-1.5 text-[10px] font-semibold uppercase">low</span>}
          </span>
        );
      },
      className: 'text-right',
      headerClassName: 'text-right',
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (p) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Link to={`/products/${p.id}`} className={actionClass} title="View" aria-label={`View ${p.name}`}>
            <Eye className="h-4 w-4" />
          </Link>
          {canEdit && (
            <Link to={`/products/${p.id}/edit`} className={actionClass} title="Edit" aria-label={`Edit ${p.name}`}>
              <Pencil className="h-4 w-4" />
            </Link>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(p)}
              className={`${actionClass} hover:bg-red-50 hover:text-red-600`}
              title="Delete"
              aria-label={`Delete ${p.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={products}
      rowKey={(p) => p.id}
      loading={loading}
      dimmed={refreshing}
      skeletonRows={8}
      empty={empty}
      onRowClick={(p) => navigate(`/products/${p.id}`)}
    />
  );
}
