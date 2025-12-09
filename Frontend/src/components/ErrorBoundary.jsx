import React from 'react'

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        // Podrías enviar el error a un servicio de logging aquí
        // console.error('ErrorBoundary:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="alert alert-danger" role="alert">
                    <h6 className="mb-2">Ocurrió un error en esta vista.</h6>
                    <div className="text-body-secondary small">{String(this.state.error)}</div>
                    {this.props.fallback}
                </div>
            )
        }
        return this.props.children
    }
}
