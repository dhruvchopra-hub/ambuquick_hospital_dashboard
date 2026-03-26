'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props { children: React.ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Something went wrong</h2>
          <p className="text-sm text-gray-500 mb-5 max-w-sm">{this.state.message || 'An unexpected error occurred on this page.'}</p>
          <button
            onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload() }}
            className="flex items-center gap-2 bg-ambu-red text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-ambu-red-dark transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
