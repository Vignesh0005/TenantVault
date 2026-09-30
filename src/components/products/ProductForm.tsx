import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Spinner';
import { ResourceErrorState } from '@/components/security/AccessDeniedCard';
import { ImageUploader, type UploadPhase } from './ImageUploader';
import { useCurrentTenant } from '@/context/TenantContext';
import { useCategories, useCreateProduct, useProduct, useUpdateProduct } from '@/hooks/useProducts';
import type { Product, ProductInput } from '@/types';

const numberField = (label: string) =>
  z.number({ invalid_type_error: `${label} is required`, required_error: `${label} is required` });

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  sku: z
    .string()
    .trim()
    .min(2, 'SKU must be at least 2 characters')
    .regex(/^[A-Z0-9-]+$/, 'SKU may only contain uppercase letters, numbers and dashes'),
  category: z.string().trim().optional(),
  price: numberField('Price').min(0, 'Price must be 0 or more'),
  quantity: numberField('Quantity').int('Quantity must be a whole number').min(0, 'Quantity must be 0 or more'),
});

export type ProductFormValues = z.infer<typeof productSchema>;

// `undefined` = image untouched, `null` = explicitly removed.
type ImageChange = File | null | undefined;

interface ProductFormFieldsProps {
  product?: Product;
}

function ProductFormFields({ product }: ProductFormFieldsProps) {
  const tenant = useCurrentTenant();
  const navigate = useNavigate();
  const isEdit = Boolean(product);
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct(product?.id ?? '');
  const { data: categories = [] } = useCategories();
  const [image, setImage] = useState<ImageChange>(undefined);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          sku: product.sku,
          category: product.category ?? '',
          price: product.price,
          quantity: product.quantity,
        }
      : { name: '', sku: '', category: '', price: 0, quantity: 0 },
  });

  const mutation = isEdit ? updateMutation : createMutation;

  const onSubmit = handleSubmit(async (values) => {
    const input: ProductInput = {
      name: values.name,
      sku: values.sku,
      category: values.category ? values.category : null,
      price: values.price,
      quantity: values.quantity,
    };

    try {
      const { product: saved } = await mutation.mutateAsync({
        input,
        image,
        onUploadProgress: (percent) => {
          setUploadPhase('uploading');
          setProgress(percent);
        },
      });
      if (image) setUploadPhase('done');
      navigate(`/products/${saved.id}`);
    } catch (err) {
      setUploadPhase('idle');
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 409) setError('sku', { message: `SKU already exists in ${tenant.name}` });
    }
  });

  const onImageChange = useCallback((file: File | null) => {
    setImage(file);
    setUploadPhase('idle');
    setProgress(0);
  }, []);

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-5 card p-6 shadow-sm lg:col-span-2">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Name" required placeholder="Wireless Keyboard" error={errors.name?.message} {...register('name')} />
          </div>
          <Input
            label="SKU"
            required
            placeholder="KB-WL-001"
            className="font-mono uppercase"
            hint="Uppercase letters, numbers and dashes"
            error={errors.sku?.message}
            {...register('sku', { setValueAs: (v: string) => v.toUpperCase() })}
          />
          <Input
            label="Category"
            placeholder="Peripherals"
            list="tv-categories"
            error={errors.category?.message}
            {...register('category')}
          />
          <datalist id="tv-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Input
            label="Price (USD)"
            type="number"
            step="0.01"
            min={0}
            error={errors.price?.message}
            {...register('price', { valueAsNumber: true })}
          />
          <Input
            label="Quantity"
            type="number"
            step="1"
            min={0}
            error={errors.quantity?.message}
            {...register('quantity', { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="space-y-5">
        <div className="card p-6 shadow-sm">
          <ImageUploader
            tenantName={tenant.name}
            existingUrl={product?.imageUrl ?? null}
            onChange={onImageChange}
            phase={uploadPhase}
            progress={progress}
            disabled={mutation.isPending}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            className="flex-1"
            loading={mutation.isPending}
            icon={<Save className="h-4 w-4" />}
          >
            {isEdit ? 'Save changes' : 'Create product'}
          </Button>
          <Button variant="secondary" onClick={() => navigate(product ? `/products/${product.id}` : '/products')}>
            Cancel
          </Button>
        </div>
        {uploadPhase === 'uploading' && (
          <p className="text-center text-xs text-slate-500">Product saved. Uploading image… {progress}%</p>
        )}
      </div>
    </form>
  );
}

function FormSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-5 card p-6 lg:col-span-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

/** Routed at `/products/new` (create) and `/products/:id/edit` (edit). */
export function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const tenant = useCurrentTenant();
  const { data: product, isLoading, error } = useProduct(id);

  useEffect(() => {
    document.title = `${id ? 'Edit product' : 'New product'} · TenantVault`;
  }, [id]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={id ? `/products/${id}` : '/products'}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{id ? 'Edit product' : 'Add product'}</h1>
        <p className="text-sm text-slate-500">
          {id ? 'Changes apply only to' : 'This product will be created in'}{' '}
          <span className="font-medium text-accent">{tenant.name}</span>.
        </p>
      </div>

      {!id && <ProductFormFields />}
      {id && isLoading && <FormSkeleton />}
      {id && error && (
        <ResourceErrorState error={error} resourceLabel="Product" resourceId={id} backTo="/products" backLabel="Back to products" />
      )}
      {id && product && <ProductFormFields key={product.id} product={product} />}
    </div>
  );
}
