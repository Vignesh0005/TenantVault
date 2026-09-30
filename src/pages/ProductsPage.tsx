import { useEffect, useState } from 'react';
import { PackageOpen, Plus, SearchX } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Button, LinkButton } from '@/components/ui/Button';
import { ProductFilters } from '@/components/products/ProductFilters';
import { ProductTable } from '@/components/products/ProductTable';
import { useCurrentTenant } from '@/context/TenantContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useCategories, useDeleteProduct, useProducts } from '@/hooks/useProducts';
import type { Product } from '@/types';

export function ProductsPage() {
  const tenant = useCurrentTenant();
  const canEdit = tenant.role !== 'viewer';
  const canDelete = tenant.role === 'admin';
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const debouncedSearch = useDebounce(search.trim(), 300);

  const { data, isLoading, isFetching, isPlaceholderData } = useProducts({
    search: debouncedSearch,
    category,
    page,
    pageSize,
  });
  const { data: categories = [] } = useCategories();
  const deleteMutation = useDeleteProduct();

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, pageSize]);

  // Step back a page if the current one was emptied (e.g. after deleting its last item).
  useEffect(() => {
    if (data && data.items.length === 0 && page > 1) setPage((p) => p - 1);
  }, [data, page]);

  const filtered = Boolean(debouncedSearch || category);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMutation.mutateAsync(pendingDelete.id);
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Products"
        description={
          <>
            {data ? `${data.total} products` : 'Products'} in <span className="font-medium text-accent">{tenant.name}</span>
          </>
        }
      />

      <div className="overflow-hidden card shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <ProductFilters
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
            categories={categories}
            canCreate={canEdit}
          />
        </div>

        <ProductTable
          products={data?.items}
          loading={isLoading}
          refreshing={isFetching && isPlaceholderData}
          canEdit={canEdit}
          canDelete={canDelete}
          onDelete={setPendingDelete}
          empty={
            filtered ? (
              <EmptyState
                icon={<SearchX className="h-6 w-6" />}
                title="No matching products"
                message="Try a different search term or category."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setCategory('');
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<PackageOpen className="h-6 w-6" />}
                title="No products in this tenant yet."
                message={`Add the first product to ${tenant.name}'s inventory.`}
                action={
                  canEdit ? (
                    <LinkButton to="/products/new" size="sm" icon={<Plus className="h-4 w-4" />}>
                      Add Product
                    </LinkButton>
                  ) : undefined
                }
              />
            )
          }
        />

        {data && data.total > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={data.total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete product"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Delete <span className="font-medium text-slate-900">{pendingDelete?.name}</span> (
          <span className="font-mono text-xs">{pendingDelete?.sku}</span>) from {tenant.name}? This cannot be undone.
        </p>
      </Modal>
    </>
  );
}
