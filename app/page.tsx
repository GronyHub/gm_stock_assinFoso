import { redirect } from 'next/navigation'
export default function RootPage() { redirect('/stock/counts?tab=Daily') }
