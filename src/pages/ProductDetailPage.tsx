import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, History, ImageOff, Pencil, Trash2 } from 'lucide-react';
import { Button, LinkButton } from '@/components/ui/Button';
import { Badge, MovementBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Spinner';
import { Table, type Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ResourceErrorState } from '@/components/security/AccessDeniedCard';
import { useCurrentTenant } from '@/context/TenantContext';
import { useDeleteProduct, useProduct, useProductMovements } from '@/hooks/useProducts';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import type { StockMovement } from '@/types';

const movementColumns: Column<StockMovement>[] = [
  { key: 'when', header: 'When', render: (m) => formatDateTime(m.createdAt) },
  { key: 'type', header: 'Type', render: (m) => <MovementBadge type={m.type} /> },
  {
    key: 'qty',
    header: 'Qty',
    render: (m) => (
      <span className="tabular-nums font-medium">
        {m.type === 'out' ? '−' : '+'}
        {formatNumber(Math.abs(m.quantity))}
      </span>
    ),
    className: 'text-right',
    headerClassName: 'text-right',
  },
  { key: 'actor', header: 'By', render: (m) => <span className="text-slate-500">{m.actorEmail ?? 'System'}</span> },
  {
    key: 'note',
    header: 'Note',
    render: (m) => <span className="text-slate-500">{m.note ?? '—'}</span>,
    className: 'max-w-[240px] truncate',
  },
];

function DetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <div className="space-y-4 card p-6 lg:col-span-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-3 gap-4 pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProductDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const tenant = useCurrentTenant();
  const navigate = useNavigate();
  const canEdit = tenant.role !== 'viewer';
  const canDelete = tenant.role === 'admin';
  const { data: product, isLoading, error } = useProduct(id);
  const movements = useProductMovements(id, Boolean(product));
  const deleteMutation = useDeleteProduct();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      navigate('/products', { replace: true });
    } finally {
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Link to="/products" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" />
        Products
      </Link>

      {isLoading && <DetailSkeleton />}

      {error && (
        <ResourceErrorState error={error} resourceLabel="Product" resourceId={id} backTo="/products" backLabel="Back to products" />
      )}

      {product && (
        <>
          <PageHeader
            title={product.name}
            description={
              <span className="flex items-center gap-2">
                <span className="font-mono">{product.sku}</span>
                {product.category && <Badge>{product.category}</Badge>}
                <Badge variant="accent">{tenant.name}</Badge>
              </span>
            }
            actions={
              (canEdit || canDelete) && (
                <>
                  {canEdit && (
                    <LinkButton to={`/products/${product.id}/edit`} variant="secondary" icon={<Pencil className="h-4 w-4" />}>
                      Edit
                    </LinkButton>
                  )}
                  {canDelete && (
                    <Button variant="danger" onClick={() => setConfirmOpen(true)} icon={<Trash2 className="h-4 w-4" />}>
                      Delete
                    </Button>
                  )}
                </>
              )
            }
          />

          <div className="stagger grid gap-6 lg:grid-cols-3">
            <div className="group overflow-hidden card shadow-sm">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="aspect-square w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-50 to-accent/5 text-slate-400 dark:from-slate-800/60">
                  <ImageOff className="h-10 w-10 animate-float" />
                  <span className="text-sm">No image</span>
                </div>
              )}
            </div>

            <div className="space-y-6 lg:col-span-2">
              <div className="stagger grid gap-4 sm:grid-cols-3">
                {[
                  { label: 'Price', value: formatCurrency(product.price) },
                  {
                    label: 'On hand',
                    value: formatNumber(product.quantity),
                    danger: product.lowStockThreshold !== null && product.quantity <= product.lowStockThreshold,
                  },
                  { label: 'Stock value', value: formatCurrency(product.price * product.quantity) },
                ].map((stat) => (
                  <div key={stat.label} className="card card-lift p-5">
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <p className={`mt-1 text-2xl font-semibold tabular-nums ${stat.danger ? 'text-red-600' : 'text-slate-900'}`}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              <dl className="grid gap-4 card p-5 text-sm shadow-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Low-stock threshold</dt>
                  <dd className="font-medium text-slate-900">{product.lowStockThreshold ?? 'Tenant default'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Tenant</dt>
                  <dd className="font-medium text-slate-900">{tenant.name}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Created</dt>
                  <dd className="font-medium text-slate-900">{formatDate(product.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Last updated</dt>
                  <dd className="font-medium text-slate-900">{formatDateTime(product.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <section className="mt-6 overflow-hidden card shadow-sm">
            <h2 className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-900">
              <History className="h-4 w-4 text-slate-400" />
              Stock movements
            </h2>
            <Table
              columns={movementColumns}
              rows={movements.data}
              rowKey={(m) => m.id}
              loading={movements.isLoading}
              empty={
                <EmptyState
                  icon={<History className="h-6 w-6" />}
                  title="No movements recorded"
                  message="Stock changes for this product will be listed here."
                  action={
                    canEdit ? (
                      <LinkButton to={`/products/${product.id}/edit`} size="sm" variant="secondary">
                        Adjust quantity
                      </LinkButton>
                    ) : undefined
                  }
                />
              }
            />
          </section>

          <Modal
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            title="Delete product"
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button variant="danger" loading={deleteMutation.isPending} onClick={onDelete}>
                  Delete
                </Button>
              </>
            }
          >
            <p className="text-sm text-slate-600">
              Permanently delete <span className="font-medium text-slate-900">{product.name}</span> from {tenant.name}?
            </p>
          </Modal>
        </>
      )}
    </>
  );
}
