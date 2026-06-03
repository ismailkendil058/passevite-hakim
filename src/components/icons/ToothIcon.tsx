import React from 'react';

export const ToothIcon = ({ className = "h-6 w-6", ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
    >
        {/* Dental Implant Icon Inspired by User Provided Image */}
        {/* Tooth Crown (Top Part) */}
        <path d="M7 4C4.8 4 3 5.8 3 8C3 10.2 4.8 12 7 12H17C19.2 12 21 10.2 21 8C21 5.8 19.2 4 17 4C16 4 15 4.5 14 5C13 4.5 12 4 11 4C10 4 9 4.5 8 5C7 4.5 6 4 5 4Z" opacity="0" />
        {/* Redrawing the crown to match the lobed bean shape better */}
        <path d="M5 8c0-2.2 1.8-4 4-4 1.1 0 2.1.5 2.8 1.2.1.1.3.1.4 0C13 4.5 14 4 15.1 4c2.2 0 4 1.8 4 4 0 2.2-1.8 4-4 4H9c-2.2 0-4-1.8-4-4z" />

        {/* Implant Post Connector (Neck) */}
        <path d="M9 12v1.5c0 .3.2.5.5.5h5c.3 0 .5-.2.5-.5V12" />

        {/* Screw Shank */}
        <path d="M11 14v7l1 2 1-2v-7" />

        {/* Screw Threads (Diagonal lines) */}
        <path d="M10 16l4 1.5" />
        <path d="M10 18l4 1.5" />
        <path d="M10 20l2 0.75" />
    </svg>
);
