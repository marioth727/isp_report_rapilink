import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';

interface MobileSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export function MobileSidebar({ isOpen, onClose, children }: MobileSidebarProps) {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Sidebar Content */}
            <div className="absolute inset-y-0 left-0 w-64 bg-card border-r border-border shadow-2xl transform transition-transform animate-in slide-in-from-left">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <span className="font-bold text-lg">Menú</span>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                {children}
            </div>
        </div>,
        document.body
    );
}
