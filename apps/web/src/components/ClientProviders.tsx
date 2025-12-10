'use client';

import { type ReactNode } from 'react';
import { Providers } from './providers';

interface ClientProvidersProps {
  children: ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return <Providers>{children}</Providers>;
}
