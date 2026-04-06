import { Component } from 'react'

/**
 * Evita que un error en una sección mate toda la app.
 * Uso: <ErrorBoundary><MiSeccion /></ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
          <p style={{ marginBottom: 12 }}>Algo salió mal en esta sección.</p>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => this.setState({ error: null })}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
