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
        <path d="M7.5 3.5c1.3 0 2.3.7 3.2 1.2.8.5 1.8.5 2.6 0 .9-.5 1.9-1.2 3.2-1.2 2.8 0 4.5 2.4 4.5 5.3 0 2-.8 3.5-1.7 5.1-.8 1.5-1.3 3.1-1.7 4.8-.3 1.5-.9 2.8-2.1 2.8-1.3 0-1.7-1.4-2.1-3-.3-1.4-.7-2.7-1.4-2.7s-1.1 1.3-1.4 2.7c-.4 1.6-.8 3-2.1 3-1.2 0-1.8-1.3-2.1-2.8-.4-1.7-.9-3.3-1.7-4.8C3.8 12.3 3 10.8 3 8.8c0-2.9 1.7-5.3 4.5-5.3z" />
        <path d="M9 8.2c1.8.9 4.2.9 6 0" />
    </svg>
);
