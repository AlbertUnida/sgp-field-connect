-- Agrega 'debito' a los métodos de pago permitidos en cobros.
-- El formulario de cobro (CobroLocalForm) ofrece "Débito", que no estaba en el
-- check original (efectivo, transferencia, cheque, tarjeta, otro).

ALTER TABLE public.cobros DROP CONSTRAINT IF EXISTS cobros_metodo_pago_check;

ALTER TABLE public.cobros ADD CONSTRAINT cobros_metodo_pago_check
  CHECK (metodo_pago = ANY (ARRAY['efectivo', 'transferencia', 'cheque', 'tarjeta', 'debito', 'otro']));
