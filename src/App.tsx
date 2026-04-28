import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import AppLayout from "./layouts/AppLayout";
import Inicio from "./pages/Inicio";
import Clientes from "./pages/Clientes";
import ClienteDetalle from "./pages/ClienteDetalle";
import Registrar from "./pages/Registrar";
import Reportes from "./pages/Reportes";
import Admin from "./pages/Admin";
import NuevoCliente from "./pages/NuevoCliente";
import EditarCliente from "./pages/EditarCliente";
import Alertas from "./pages/Alertas";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

// Ruta protegida: si no hay sesión, manda al login
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gradient-hero">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-primary-foreground/70">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Ruta pública: si ya hay sesión, manda a la app
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gradient-hero">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
    <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
    <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route index element={<Inicio />} />
      <Route path="clientes" element={<Clientes />} />
      <Route path="clientes/:id" element={<ClienteDetalle />} />
      <Route path="clientes/:id/editar" element={<EditarCliente />} />
      <Route path="registrar" element={<Registrar />} />
      <Route path="reportes" element={<Reportes />} />
      <Route path="admin" element={<Admin />} />
      <Route path="nuevo-cliente" element={<NuevoCliente />} />
      <Route path="alertas" element={<Alertas />} />
    </Route>
    <Route path="/index" element={<Navigate to="/" replace />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
