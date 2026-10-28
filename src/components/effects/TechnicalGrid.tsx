import React from 'react';

/**
 * Pure Monochrome Engineering Grid
 * High-contrast subtle black and white grid texture.
 */
export const TechnicalGrid: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-20"
    >
      {/* Background technical dot/line pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0),
            linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px, 96px 96px, 96px 96px',
        }}
      />
    </div>
  );
};
