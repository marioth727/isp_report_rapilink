
import React from 'react';


interface TicketTimelineProps {
    comments: any[]; // Raw comments from API
    ticketDate: string;
    ticketAuthor: string;
}

export const TicketTimeline: React.FC<TicketTimelineProps> = ({ comments, ticketDate, ticketAuthor }) => {
    // Aquí procesaremos los comentarios para darles formato de timeline
    // Por ahora, estructura básica
    return (
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {/* Start Node */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-green-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                    <svg className="fill-current text-white" xmlns="http://www.w3.org/2000/svg" width="12" height="10" viewBox="0 0 12 10">
                        <path fillRule="nonzero" d="M10.422 1.257 4.655 7.025 2.553 4.923A.916.916 0 0 0 1.257 6.22l2.75 2.75a.916.916 0 0 0 1.296 0l6.415-6.416a.916.916 0 0 0-1.296-1.296Z" />
                    </svg>
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card p-4 rounded-xl border border-border shadow-sm">
                    <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className="font-bold text-foreground">Ticket Creado</div>
                        <time className="font-caveat font-medium text-indigo-500 text-xs">{ticketDate}</time>
                    </div>
                    <div className="text-muted-foreground text-sm">Creado por {ticketAuthor}</div>
                </div>
            </div>

            {/* Comments Stream */}
            {comments.map((comment, index) => (
                <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                        <span className="text-[10px] font-black text-slate-600">{index + 1}</span>
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card p-4 rounded-xl border border-border shadow-sm">
                        <div className="flex flex-col mb-1">
                            <div className="font-bold text-foreground text-sm">{comment.nombre_tecnico || 'Sistema'}</div>
                            <time className="text-[10px] text-muted-foreground">{comment.fecha}</time>
                        </div>
                        <div className="text-foreground text-sm mt-2" dangerouslySetInnerHTML={{ __html: comment.descripcion }} />
                    </div>
                </div>
            ))}
        </div>
    );
};
