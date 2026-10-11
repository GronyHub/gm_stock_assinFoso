import { Component, ReactNode } from 'react'

// Split out of ItemDetailPanel so the page can use it without importing
// ItemDetailPanel (which imports the 150 KB LossTab).
export class ItemDetailErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; errorMsg: string }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }
  static getDerivedStateFromError(error: any) {
    return {
      hasError: true,
      errorMsg: error?.message || String(error) || 'Unknown error in ItemDetail'
    }
  }
  componentDidCatch(e: any) {
    console.error('[ItemDetailPanel] ItemDetail render error:', e)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-700 text-sm font-semibold mb-1">ItemDetail Render Error</p>
          <p className="text-red-600 text-xs whitespace-pre-wrap break-words font-mono">{this.state.errorMsg}</p>
        </div>
      )
    }
    return this.props.children
  }
}
