import { useEffect, useRef, useState, type DragEvent } from 'react';
import { CheckCircle2, CloudUpload, ImagePlus, Lock, X } from 'lucide-react';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/api/products';

export type UploadPhase = 'idle' | 'uploading' | 'done';

interface ImageUploaderProps {
  tenantName: string;
  existingUrl: string | null;
  /** Called with the chosen file, or null when the image is removed. Uploading is up to the parent. */
  onChange: (file: File | null) => void;
  phase: UploadPhase;
  progress: number;
  disabled?: boolean;
}

export function ImageUploader({ tenantName, existingUrl, onChange, phase, progress, disabled }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(existingUrl);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Revoke object URLs we created to avoid leaking memory.
  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const selectFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(candidate.type)) {
      setError('Only PNG, JPEG or WebP images are allowed.');
      return;
    }
    if (candidate.size > MAX_IMAGE_BYTES) {
      setError('Image must be 5 MB or smaller.');
      return;
    }
    setError(null);
    setFile(candidate);
    setPreview(URL.createObjectURL(candidate));
    onChange(candidate);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) selectFile(e.dataTransfer.files[0]);
  };

  const clear = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">Product image</span>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        className="hidden"
        onChange={(e) => selectFile(e.target.files?.[0])}
      />

      {preview ? (
        <div className="flex gap-4 rounded-xl border border-slate-200 bg-white p-3">
          <img src={preview} alt="Preview" className="h-24 w-24 shrink-0 rounded-lg border border-slate-100 object-cover" />
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{file?.name ?? 'Current image'}</p>
                {phase === 'idle' && file && (
                  <p className="mt-0.5 text-xs text-slate-500">Uploads to {tenantName}'s private storage when you save</p>
                )}
                {phase === 'uploading' && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-accent">
                    <Lock className="h-3 w-3" />
                    Uploading to {tenantName}'s S3…
                  </p>
                )}
                {phase === 'done' && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Stored under {tenantName}'s isolated key prefix
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={clear}
                disabled={disabled || phase === 'uploading'}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {phase === 'idle' ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Replace
                </button>
              </div>
            ) : (
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${phase === 'done' ? 'bg-emerald-500' : 'bg-accent'}`}
                  style={{ width: `${phase === 'done' ? 100 : progress}%` }}
                />
              </div>
            )}
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          } ${dragging ? 'border-accent bg-accent/5' : 'border-slate-300 bg-slate-50 hover:border-slate-400'}`}
        >
          <CloudUpload className={`h-8 w-8 ${dragging ? 'text-accent' : 'text-slate-400'}`} />
          <p className="mt-2 text-sm font-medium text-slate-700">
            Drag &amp; drop an image, or <span className="text-accent">browse</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">PNG, JPEG or WebP · up to 5 MB</p>
          {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
