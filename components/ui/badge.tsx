import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Small uppercase technical pills. Tinted variants use a low-opacity brand
// background with high-contrast text (per the design system).
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 font-mono text-xs font-medium tracking-wide transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-primary/20 bg-primary/10 text-primary",
        ai: "border-cyan/30 bg-cyan/10 text-cyan",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };