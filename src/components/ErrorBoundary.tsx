import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * Catches any render error so a child never sees a blank screen. Progress is
 * already persisted, so going home is always safe.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Reader Quest crashed', error, info.componentStack)
  }

  private goHome = () => {
    window.location.hash = '#/'
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-7xl">🙈</div>
        <div className="text-3xl font-extrabold text-grape">Oops! Something went wobbly.</div>
        <div className="text-lg font-bold text-ink/60">Your stars and progress are safe.</div>
        <button onClick={this.goHome} className="btn btn-primary w-full">
          🏠 Let's go home
        </button>
      </div>
    )
  }
}
