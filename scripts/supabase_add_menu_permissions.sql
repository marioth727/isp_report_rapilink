
-- Añadir columna de permisos de menú a la tabla de perfiles
-- El valor por defecto es solo el Dashboard
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS allowed_menus JSONB DEFAULT '["Dashboard"]';

-- Actualizar usuarios existentes para que tengan acceso a todo por defecto (opcional, para no bloquear a nadie)
UPDATE profiles 
SET allowed_menus = '["Dashboard", "Escalamiento", "Gestión Operativa", "Gestión Comercial", "Reportes"]'
WHERE allowed_menus IS NULL OR allowed_menus = '["Dashboard"]';
