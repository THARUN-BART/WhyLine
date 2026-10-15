import React from 'react';

export function WhylineLogo({ className = 'h-8 w-auto' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32" className={className} fill="none">
      <g transform="translate(2, 4)">
        {/* Connected decision nodes icon */}
        <path d="M 6 12 L 14 6 L 22 12 L 14 18 Z" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="6" cy="12" r="3" fill="#4F46E5" />
        <circle cx="14" cy="6" r="3" fill="#06B6D4" />
        <circle cx="22" cy="12" r="3" fill="#10B981" />
        <circle cx="14" cy="18" r="3" fill="#8B5CF6" />
        <path d="M 6 12 L 22 12" stroke="#6366F1" strokeWidth="1.5" strokeDasharray="2 2" />
        <circle cx="14" cy="12" r="1.5" fill="#FFFFFF" />
      </g>
      <text x="36" y="21" fontFamily="Inter, -apple-system, sans-serif" fontWeight="700" fontSize="16" letterSpacing="-0.02em" fill="#0F172A">
        Whyline
      </text>
    </svg>
  );
}
