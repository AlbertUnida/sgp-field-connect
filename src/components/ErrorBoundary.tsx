import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

/**
 * Error Boundary global: atrapa cualquier excepción de render y muestra un
 * fallback recuperable en lugar de una pantalla en blanco (React desmonta todo
 * el árbol ante un error no atrapado). Clave sobre todo sin conexión, donde los
 * fetch pueden devolver datos vacíos/null que algún componente no espera.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("ErrorBoundary atrapó un error:", error);
  }

  private reintentar = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-2xl">⚠️</p>
          <div className="space-y-1">
            <p className="text-base font-bold">Algo salió mal</p>
            <p className="text-sm text-muted-foreground">
              Puede ser un problema de conexión. Reintentá; tus gestiones guardadas
              en el teléfono no se pierden.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={this.reintentar}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Reintentar
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl border border-border bg-secondary px-4 py-2 text-sm font-semibold"
            >
              Recargar app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
