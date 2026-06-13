import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mt-4 text-sm text-red-600">
          <p>Unable to load this section.</p>
          <pre className="whitespace-pre-wrap">{String(this.state.error)}</pre>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
