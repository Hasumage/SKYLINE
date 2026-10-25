import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-blue-600",
        secondary:
          "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 focus-visible:outline-slate-500",
        ghost:
          "text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-500",
        success:
          "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-5 text-base",
        icon: "size-10 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

type LinkCardProps = ComponentPropsWithoutRef<"a"> & {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  status: "ready" | "planned" | "draft";
};

const statusTone = {
  ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  planned: "bg-amber-50 text-amber-700 ring-amber-200",
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
};

const statusText = {
  ready: "Готов к просмотру",
  planned: "Следующий",
  draft: "Черновик",
};

export function LinkCard({
  icon,
  eyebrow,
  title,
  description,
  status,
  className,
  ...props
}: LinkCardProps) {
  return (
    <a
      className={cn(
        "group grid min-h-48 content-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md",
        className,
      )}
      {...props}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-slate-100 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-700">
            {icon}
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium ring-1",
              statusTone[status],
            )}
          >
            {statusText[status]}
          </span>
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-normal text-slate-950">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <span className="mt-5 text-sm font-medium text-blue-700">
        Открыть интерфейс
      </span>
    </a>
  );
}

export function Shell({
  children,
  eyebrow,
  title,
  description,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <main className="min-h-screen bg-[var(--skyline-bg)] text-slate-950">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-6 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-blue-600 text-sm font-bold text-white">
              SK
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                {eyebrow}
              </p>
              <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
                {title}
              </h1>
            </div>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            {description}
          </p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8">{children}</div>
    </main>
  );
}

export function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        defaultValue={value}
      />
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
