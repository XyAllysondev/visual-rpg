import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// cn — combina classes condicionais (clsx) e resolve conflitos de utilities do Tailwind
// (tailwind-merge). Helper padrão usado por todos os componentes shadcn. Ver ADR-0007.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
