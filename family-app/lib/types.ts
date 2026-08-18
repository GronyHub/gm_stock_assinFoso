export type LandEntry = {
  id: string
  name: string
  size: string
  location: string
  notes: string
}

export const CATEGORIES = [
  { slug: 'daddy', label: 'Daddy' },
  { slug: 'mommy', label: 'Mommy' },
  { slug: 'children', label: 'Children' },
  { slug: 'building', label: 'Building' },
  { slug: 'other-land', label: 'Other Land' },
] as const
