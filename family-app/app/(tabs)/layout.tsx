import TabNav from '@/components/TabNav'

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1">
      <TabNav />
      {children}
    </div>
  )
}
