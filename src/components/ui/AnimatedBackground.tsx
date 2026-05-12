import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface AnimatedBackgroundProps {
  className?: string;
  gridSize?: number;
  dotSize?: number;
  highlightColor?: string;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  className,
  gridSize = 40,
  dotSize = 1.5,
  highlightColor = 'rgba(245, 158, 11, 0.08)', // amber-500 with very low opacity
}) => {
  return (
    <div 
      className={cn(
        "fixed inset-0 pointer-events-none z-[-1] overflow-hidden bg-slate-50",
        className
      )}
    >
      {/* Subtle Dot Grid */}
      <div 
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #cbd5e1 ${dotSize}px, transparent 0)`,
          backgroundSize: `${gridSize}px ${gridSize}px`,
        }}
      />

      {/* Floating Animated Gradients (Mesh/Aurora Effect) */}
      <motion.div
        animate={{
          x: [0, 50, -30, 0],
          y: [0, 30, 60, 0],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute top-[10%] left-[10%] w-[60%] h-[60%] rounded-full blur-[120px] will-change-transform"
        style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%)' }}
      />

      <motion.div
        animate={{
          x: [0, -40, 20, 0],
          y: [0, -60, -20, 0],
        }}
        transition={{
          duration: 35,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute bottom-[10%] right-[10%] w-[70%] h-[70%] rounded-full blur-[150px] will-change-transform"
        style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, transparent 70%)' }}
      />

      {/* Subtle vignettes */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-50/80 via-transparent to-slate-50/20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(248,250,252,0.4)_100%)]" />
    </div>
  );
};
