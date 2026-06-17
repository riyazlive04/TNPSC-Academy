import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Top-level error boundary so a render-time throw shows a recoverable screen
 * (with the brand chrome) instead of a blank white page.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[TNPSC Mentor] Unhandled UI error:', error, info.componentStack)
  }

  private handleReload = () => {
    this.setState({ error: null })
    window.location.assign('/test-arena')
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-primary px-4 text-center">
          <h1 className="font-heading text-3xl font-bold text-accent">
            Something went wrong
          </h1>
          <p className="max-w-sm font-body text-sm text-white/70">
            An unexpected error interrupted the page. Your progress is saved where
            possible - try reloading.
          </p>
          <button
            onClick={this.handleReload}
            className="rounded-full bg-accent px-6 py-2.5 font-heading font-bold uppercase text-navytext"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
