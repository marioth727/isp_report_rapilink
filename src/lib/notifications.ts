import { supabase } from './supabase';

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: 'sla_warning' | 'task_assigned' | 'system' | 'followup';
    is_read: boolean;
    link?: string;
    created_at: string;
}

export const NotificationService = {
    async getNotifications(userId: string): Promise<Notification[]> {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('[NotificationService] Error fetching notifications:', error);
            return [];
        }
        return data || [];
    },

    async markAsRead(notificationId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        return !error;
    },

    async markAllAsRead(userId: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        return !error;
    },

    subscribeToNotifications(userId: string, onNotification: (payload: any) => void) {
        return supabase
            .channel('public:notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    onNotification(payload.new);
                }
            )
            .subscribe();
    },

    async createNotification(data: {
        user_id: string;
        title: string;
        message: string;
        type: Notification['type'];
        link?: string;
    }) {
        const { error } = await supabase
            .from('notifications')
            .insert([data]);

        return !error;
    }
};
