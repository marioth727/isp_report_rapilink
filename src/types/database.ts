export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            inventory_categories: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    unit_type: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    unit_type?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string | null
                    unit_type?: string | null
                    created_at?: string | null
                }
            }
            inventory_items: {
                Row: {
                    id: string
                    category_id: string | null
                    name: string
                    sku: string | null
                    min_stock_level: number | null
                    brand: string | null
                    model_name: string | null
                    description_technical: string | null
                    unit_cost: number | null
                    currency: string | null
                    warranty_days: number | null
                    image_url: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    category_id?: string | null
                    name: string
                    sku?: string | null
                    min_stock_level?: number | null
                    brand?: string | null
                    model_name?: string | null
                    description_technical?: string | null
                    unit_cost?: number | null
                    currency?: string | null
                    warranty_days?: number | null
                    image_url?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    category_id?: string | null
                    name?: string
                    sku?: string | null
                    min_stock_level?: number | null
                    brand?: string | null
                    model_name?: string | null
                    description_technical?: string | null
                    unit_cost?: number | null
                    currency?: string | null
                    warranty_days?: number | null
                    image_url?: string | null
                    created_at?: string | null
                }
            }
            inventory_assets: {
                Row: {
                    id: string
                    item_id: string | null
                    serial_number: string
                    mac_address: string | null
                    status: string | null
                    current_holder_id: string | null
                    current_location: string | null
                    last_movement_id: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    item_id?: string | null
                    serial_number: string
                    mac_address?: string | null
                    status?: string | null
                    current_holder_id?: string | null
                    current_location?: string | null
                    last_movement_id?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    item_id?: string | null
                    serial_number?: string
                    mac_address?: string | null
                    status?: string | null
                    current_holder_id?: string | null
                    current_location?: string | null
                    last_movement_id?: string | null
                    created_at?: string | null
                }
            }
            inventory_movements: {
                Row: {
                    id: string
                    asset_id: string | null
                    origin_holder_id: string | null
                    destination_holder_id: string | null
                    client_reference: string | null
                    movement_type: string
                    created_at: string | null
                    notes: string | null
                }
                Insert: {
                    id?: string
                    asset_id?: string | null
                    origin_holder_id?: string | null
                    destination_holder_id?: string | null
                    client_reference?: string | null
                    movement_type: string
                    created_at?: string | null
                    notes?: string | null
                }
                Update: {
                    id?: string
                    asset_id?: string | null
                    origin_holder_id?: string | null
                    destination_holder_id?: string | null
                    client_reference?: string | null
                    movement_type?: string
                    created_at?: string | null
                    notes?: string | null
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}
