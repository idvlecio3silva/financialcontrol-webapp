-- Seed: categorias do sistema e conta demo
-- Executado automaticamente pelo docker-entrypoint-initdb.d

-- Extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categorias do sistema (sem utilizador específico)
INSERT INTO categories (id, name, color, icon, is_system, is_active, created_at)
VALUES
  (uuid_generate_v4(), 'Habitação',       '#3b82f6', 'home',          true, true, NOW()),
  (uuid_generate_v4(), 'Alimentação',     '#10b981', 'utensils',      true, true, NOW()),
  (uuid_generate_v4(), 'Transporte',      '#f59e0b', 'car',           true, true, NOW()),
  (uuid_generate_v4(), 'Saúde',           '#ef4444', 'heart',         true, true, NOW()),
  (uuid_generate_v4(), 'Educação',        '#8b5cf6', 'book',          true, true, NOW()),
  (uuid_generate_v4(), 'Lazer',           '#ec4899', 'music',         true, true, NOW()),
  (uuid_generate_v4(), 'Vestuário',       '#14b8a6', 'shirt',         true, true, NOW()),
  (uuid_generate_v4(), 'Comunicações',    '#6366f1', 'phone',         true, true, NOW()),
  (uuid_generate_v4(), 'Serviços Públicos','#f97316','zap',           true, true, NOW()),
  (uuid_generate_v4(), 'Seguros',         '#84cc16', 'shield',        true, true, NOW()),
  (uuid_generate_v4(), 'Impostos',        '#dc2626', 'landmark',      true, true, NOW()),
  (uuid_generate_v4(), 'Dívidas',         '#9f1239', 'credit-card',   true, true, NOW()),
  (uuid_generate_v4(), 'Investimentos',   '#059669', 'trending-up',   true, true, NOW()),
  (uuid_generate_v4(), 'Poupança',        '#0891b2', 'piggy-bank',    true, true, NOW()),
  (uuid_generate_v4(), 'Outros',          '#6b7280', 'tag',           true, true, NOW())
ON CONFLICT DO NOTHING;
