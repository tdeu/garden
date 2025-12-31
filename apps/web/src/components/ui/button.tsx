import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-emerald-600 text-white hover:bg-emerald-700': variant === 'default',
            'border border-neutral-700 bg-transparent hover:bg-neutral-800': variant === 'outline',
            'bg-transparent hover:bg-neutral-800': variant === 'ghost',
            'bg-neutral-800 text-white hover:bg-neutral-700': variant === 'secondary',
          },
          {
            'h-10 px-4 py-2': size === 'default',
            'h-9 px-3 text-sm': size === 'sm',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
