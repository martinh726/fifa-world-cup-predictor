import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { GlassCard } from '../ui/GlassCard'
import { Button } from '../ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('Render error caught by ErrorBoundary:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <GlassCard className="p-8 sm:p-10 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-14 h-14 rounded-2xl grid place-items-center bg-white/[0.05] border border-[var(--glass-border)] text-host-red">
            <AlertTriangle size={26} strokeWidth={1.8} />
          </span>
          <div className="font-display text-lg uppercase tracking-[0.12em] text-ink-100">
            Something went wrong
          </div>
          <p className="text-sm text-ink-400 max-w-sm break-all">
            {this.state.error.message}
          </p>
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
        </div>
      </GlassCard>
    )
  }
}
