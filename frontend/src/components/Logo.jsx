import React from "react";

// Infyro logo — three thin lines converging into one node.
// "Every market, one thread."
export const LogoMark = ({ size = 24, className = "" }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
    >
        <g
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
        >
            <path d="M4 8 L18 16" />
            <path d="M4 16 L18 16" />
            <path d="M4 24 L18 16" />
        </g>
        <circle cx="22" cy="16" r="3.2" fill="currentColor" />
    </svg>
);

export const Wordmark = ({ className = "" }) => (
    <div className={`inline-flex items-center gap-2 ${className}`}>
        <LogoMark size={22} className="text-primary" />
        <span className="font-display text-lg lowercase tracking-tight text-foreground">
            infyro
        </span>
    </div>
);

export default Wordmark;
