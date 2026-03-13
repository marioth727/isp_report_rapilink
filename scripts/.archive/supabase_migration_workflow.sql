-- Migración: Matriz de Escalamiento Operativo
-- Ejecutar en el Editor SQL de Supabase

-- 1. Tabla Maestra de Procesos
CREATE TABLE IF NOT EXISTS workflow_processes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_type TEXT NOT NULL, -- 'WispHubTicket', 'AdminRequest', etc.
    reference_id TEXT, -- ID del ticket o solicitud
    title TEXT NOT NULL,
    priority INTEGER DEFAULT 1,
    status TEXT DEFAULT 'PE', -- PE (Pending), SS (Success), ST (Timeout), ES (Escalated)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- 2. Pasos y Actividades
CREATE TABLE IF NOT EXISTS workflow_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID REFERENCES workflow_processes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'Active', -- Active, Completed
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 3. Asignaciones de Trabajo (WorkItems)
CREATE TABLE IF NOT EXISTS workflow_workitems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID REFERENCES workflow_activities(id) ON DELETE CASCADE,
    participant_id TEXT NOT NULL, -- ID del usuario/staff
    participant_type TEXT NOT NULL, -- 'U' (User), 'SU' (Supervisor), 'SO' (Service Owner)
    status TEXT DEFAULT 'Pending', -- Pending, Completed, Expired
    deadline TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 4. Auditoría e Historial (Logs)
CREATE TABLE IF NOT EXISTS workflow_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID REFERENCES workflow_processes(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'Creation', 'Approval', 'Timeout', 'Escalation'
    description TEXT,
    actor_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Habilitar RLS (Row Level Security) - Ajustar según política de la empresa
ALTER TABLE workflow_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_workitems ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_logs ENABLE ROW LEVEL SECURITY;

-- Política simple: Todos los autenticados pueden leer, solo admins pueden borrar
CREATE POLICY "Allow all authenticated check" ON workflow_processes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all authenticated check" ON workflow_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all authenticated check" ON workflow_workitems FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all authenticated check" ON workflow_logs FOR SELECT TO authenticated USING (true);

-- Insertar un proceso de prueba (Opcional)
-- INSERT INTO workflow_processes (process_type, title, priority) VALUES ('WispHubTicket', 'Prueba de Escalamiento #1', 3);
