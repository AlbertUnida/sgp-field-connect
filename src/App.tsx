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
import NuevoEvento from "./pages/NuevoEvento";
import EventoDetalle from "./pages/EventoDetalle";
import Alertas from "./pages/Alertas";
import Perfil from "./pages/Perfil";
import Cobros from "./pages/Cobros";
import Scoring from "./pages/Scoring";
import Monitoreo from "./pages/Monitoreo";
import RutaDia from "./pages/RutaDia";
import AsignarCobranzas from "./pages/AsignarCobranzas";
import DashboardGerencial from "./pages/DashboardGerencial";
import Georreferenciacion from "./pages/Georreferenciacion";
import ResetPassword from "./pages/ResetPassword";
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
    {/* /reset-password va FUERA de PublicRoute: el link de recovery crea sesión antes de redirigir */}
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route index element={<Inicio />} />
      <Route path="clientes" element={<Clientes />} />
      <Route path="clientes/:id" element={<ClienteDetalle />} />
      <Route path="clientes/:id/editar" element={<EditarCliente />} />
      <Route path="clientes/:id/eventos/nuevo" element={<NuevoEvento />} />
      <Route path="clientes/:id/eventos/:eventoId" element={<EventoDetalle />} />
      <Route path="registrar" element={<Registrar />} />
      <Route path="reportes" element={<Reportes />} />
      <Route path="admin" element={<Admin />} />
      <Route path="nuevo-cliente" element={<NuevoCliente />} />
      <Route path="alertas" element={<Alertas />} />
      <Route path="perfil" element={<Perfil />} />
      <Route path="cobros" element={<Cobros />} />
      <Route path="scoring" element={<Scoring />} />
      <Route path="monitoreo" element={<Monitoreo />} />
      <Route path="ruta" element={<RutaDia />} />
      <Route path="cobranzas-asignar" element={<AsignarCobranzas />} />
      <Route path="dashboard" element={<DashboardGerencial />} />
      <Route path="georreferenciacion" element={<Georreferenciacion />} />
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
